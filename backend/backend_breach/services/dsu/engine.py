"""
services/dsu/engine.py

Full deduplication pipeline:

  1. Load all non-duplicate candidates from the DB
  2. Build pairwise similarity scores
  3. Union pairs scoring >= 0.85 into clusters via UnionFind
  4. For each cluster > 1 member:
       - Choose the MASTER (oldest / most complete record)
       - Mark all others as is_duplicate=True, master_candidate_id=master.candidate_id
       - Merge skills from duplicates into master (additive, never removes)
       - Merge phone/location into master if master is missing them
  5. Return a DeduplicationResult with full audit trail

COMPLEXITY:
  Load:       O(n) DB queries
  Pairwise:   O(n²) comparisons, with two early-exit optimisations:
              - Skip if both have different non-null emails (guaranteed different)
              - Skip if already in same DSU component (transitively connected)
  Each DSU op: O(α·n) ≈ O(1)
  DB writes:  O(duplicates found)

TRANSITIVE CLUSTERING:
  A shares phone with B → union(A,B)
  B shares email with C → union(B,C)
  A and C share nothing directly
  → find(A) == find(C) == same root → all three merged into one Master Profile
"""

import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from itertools import combinations
from typing import List, Optional, Dict

from sqlalchemy.orm import Session

from models.schema import (
    Candidate, ProfessionalInfo, CandidateSkill, Skill,
    ResumeEmbedding, Resume
)
from services.dsu.union_find import UnionFind
from services.dsu.similarity import calculate_similarity, UNION_THRESHOLD

logger = logging.getLogger(__name__)


# ── Result dataclasses ────────────────────────────────────────────────────────

@dataclass
class MergedCluster:
    master_id:      str
    master_name:    str
    duplicate_ids:  List[str]
    source_count:   int
    merged_skills:  List[str]

@dataclass
class DeduplicationResult:
    total_input:       int = 0
    total_output:      int = 0   # unique Master Profiles
    duplicates_marked: int = 0
    clusters_merged:   int = 0   # clusters with > 1 member
    comparisons_run:   int = 0
    comparisons_skipped: int = 0
    clusters:          List[MergedCluster] = field(default_factory=list)
    errors:            List[str]           = field(default_factory=list)


# ── Step 1: Load records from DB ─────────────────────────────────────────────

def _load_candidates(db: Session) -> List[dict]:
    """
    Load all non-duplicate candidates with their skills and professional info.
    Returns plain dicts — no ORM objects leave this function.
    """
    candidates = (
        db.query(Candidate)
        .filter(Candidate.is_duplicate == 'false')
        .order_by(Candidate.created_at.asc())   # oldest first → becomes master
        .all()
    )

    records = []
    for c in candidates:
        skill_names = [cs.skill.skill_name for cs in c.candidate_skills if cs.skill]
        prof = c.professional_info

        records.append({
            'candidate_id':          str(c.candidate_id),
            'full_name':             c.full_name,
            'email':                 c.email,
            'phone':                 c.phone,
            'location':              c.location,
            'total_experience_years': prof.total_experience_years if prof else None,
            'skills':                skill_names,
            '_orm':                  c,   # keep reference for writes
        })

    logger.info(f"[DSU] Loaded {len(records)} non-duplicate candidates")
    return records


# ── Step 2-3: Run DSU ─────────────────────────────────────────────────────────

def _run_dsu(records: List[dict]) -> tuple[UnionFind, int, int]:
    """
    Run all pairwise comparisons, union those >= threshold.
    Returns (dsu, comparisons_run, comparisons_skipped).
    """
    n = len(records)
    dsu = UnionFind(n)
    comparisons = 0
    skipped = 0

    def norm_email(e):
        if not e: return None
        e = e.lower().strip()
        return None if e.endswith('@noemail.local') else e

    for i, j in combinations(range(n), 2):
        # Removed strict email check to allow fuzzy matching (similarities without exact duplicates)
        # Even if emails differ (like personal vs work), the fallback score triggers a union >= 85%

        # Optimisation 2: already in same component → transitively connected
        if dsu.connected(i, j):
            skipped += 1
            continue

        score = calculate_similarity(records[i], records[j])
        comparisons += 1

        if score >= UNION_THRESHOLD:
            merged = dsu.union(i, j)
            if merged:
                logger.debug(
                    f"[DSU] UNION [{records[i]['full_name']}] + "
                    f"[{records[j]['full_name']}] score={score:.3f}"
                )

    logger.info(
        f"[DSU] Comparisons: {comparisons} | Skipped: {skipped} | "
        f"Components: {dsu.num_components}"
    )
    return dsu, comparisons, skipped


# ── Step 4: Write merge results to DB ─────────────────────────────────────────

def _write_merges(db: Session, records: List[dict], dsu: UnionFind) -> tuple[int, int, List[MergedCluster]]:
    """
    For each cluster with > 1 member:
      - Master = first record (oldest, since we sorted by created_at asc)
      - Duplicates: mark is_duplicate='true', set master_candidate_id
      - Merge skills from duplicates → master (additive)
      - Merge phone/location into master if missing

    Returns (duplicates_marked, clusters_merged, cluster_list)
    """
    components = dsu.get_components()
    duplicates_marked = 0
    clusters_merged   = 0
    cluster_list      = []
    now = datetime.now(timezone.utc)

    for root, indices in components.items():
        if len(indices) == 1:
            continue  # already unique, nothing to do

        # The root index IS the master (UnionFind always uses the root as canonical)
        master_record = records[root]
        master_orm: Candidate = master_record['_orm']

        duplicate_ids = []
        all_skills: set = set(s.lower().strip() for s in master_record.get('skills', []))

        for idx in indices:
            if idx == root:
                continue   # skip master itself

            dup_record = records[idx]
            dup_orm: Candidate = dup_record['_orm']

            # Mark as duplicate
            dup_orm.is_duplicate        = 'true'
            dup_orm.master_candidate_id = master_orm.candidate_id
            dup_orm.dedup_merged_at     = now
            duplicate_ids.append(str(dup_orm.candidate_id))
            duplicates_marked += 1

            # Collect skills from duplicate to merge into master
            for skill_name in dup_record.get('skills', []):
                all_skills.add(skill_name.lower().strip())

            # Merge phone into master if master has none
            if not master_orm.phone and dup_orm.phone:
                master_orm.phone = dup_orm.phone

            # Merge location into master if master has none
            if not master_orm.location and dup_orm.location:
                master_orm.location = dup_orm.location

        # Write merged skills back to master
        _merge_skills_into_master(db, master_orm, all_skills)

        clusters_merged += 1
        cluster_list.append(MergedCluster(
            master_id     = str(master_orm.candidate_id),
            master_name   = master_orm.full_name,
            duplicate_ids = duplicate_ids,
            source_count  = len(indices),
            merged_skills = sorted(all_skills),
        ))
        logger.info(
            f"[DSU] Merged {len(indices)} records → master '{master_orm.full_name}' "
            f"({len(duplicate_ids)} duplicates marked)"
        )

    try:
        db.commit()
        logger.info(f"[DSU] Committed {duplicates_marked} duplicate marks to DB")
    except Exception as e:
        db.rollback()
        logger.error(f"[DSU] DB commit failed: {e}")
        raise

    return duplicates_marked, clusters_merged, cluster_list


def _merge_skills_into_master(db: Session, master: Candidate, all_skills: set):
    """Add any new skills to master that came from duplicates."""
    existing_skills = {
        cs.skill.skill_name.lower().strip()
        for cs in master.candidate_skills
        if cs.skill
    }

    for skill_name in all_skills:
        if skill_name in existing_skills:
            continue
        # Get or create skill in master list
        skill = db.query(Skill).filter(Skill.skill_name.ilike(skill_name)).first()
        if not skill:
            skill = Skill(skill_name=skill_name)
            db.add(skill)
            db.flush()
        # Link to master
        link = CandidateSkill(
            candidate_id = master.candidate_id,
            skill_id     = skill.skill_id,
        )
        db.add(link)

    try:
        db.flush()
    except Exception:
        db.rollback()


# ── MAIN ENTRY POINT ─────────────────────────────────────────────────────────

def run_deduplication(db: Session) -> DeduplicationResult:
    """
    Full deduplication pipeline. Safe to call multiple times —
    already-marked duplicates are excluded from input on subsequent runs.

    Returns a DeduplicationResult with full audit details.
    """
    result = DeduplicationResult()

    try:
        # Step 1: Load
        records = _load_candidates(db)
        result.total_input = len(records)

        if len(records) < 2:
            result.total_output = len(records)
            logger.info("[DSU] Not enough candidates to deduplicate")
            return result

        # Steps 2-3: DSU
        dsu, comparisons, skipped = _run_dsu(records)
        result.comparisons_run     = comparisons
        result.comparisons_skipped = skipped

        # Step 4: Write
        dups, clusters, cluster_list = _write_merges(db, records, dsu)
        result.duplicates_marked = dups
        result.clusters_merged   = clusters
        result.clusters          = cluster_list
        result.total_output      = dsu.num_components

    except Exception as e:
        logger.error(f"[DSU] Deduplication failed: {e}", exc_info=True)
        result.errors.append(str(e))

    return result


def run_deduplication_for_new_candidate(
    db: Session, new_candidate_id: str
) -> Optional[str]:
    """
    Lightweight dedup triggered after a single new candidate is ingested.
    Compares the new candidate against all existing non-duplicate records.

    Returns the master_candidate_id if the new candidate was found to be a
    duplicate, or None if it's unique.
    """
    try:
        new_id_uuid = uuid.UUID(new_candidate_id)
    except ValueError:
        return None

    new_orm = db.query(Candidate).filter_by(candidate_id=new_id_uuid).first()
    if not new_orm:
        return None

    # Build record dict for new candidate
    new_skills = [cs.skill.skill_name for cs in new_orm.candidate_skills if cs.skill]
    new_prof   = new_orm.professional_info
    new_record = {
        'candidate_id':          str(new_orm.candidate_id),
        'full_name':             new_orm.full_name,
        'email':                 new_orm.email,
        'phone':                 new_orm.phone,
        'location':              new_orm.location,
        'total_experience_years': new_prof.total_experience_years if new_prof else None,
        'skills':                new_skills,
    }

    # Load all existing non-duplicate candidates (excluding the new one)
    existing = (
        db.query(Candidate)
        .filter(
            Candidate.is_duplicate == 'false',
            Candidate.candidate_id != new_id_uuid,
        )
        .all()
    )

    for existing_orm in existing:
        existing_skills = [cs.skill.skill_name for cs in existing_orm.candidate_skills if cs.skill]
        existing_prof   = existing_orm.professional_info
        existing_record = {
            'candidate_id':          str(existing_orm.candidate_id),
            'full_name':             existing_orm.full_name,
            'email':                 existing_orm.email,
            'phone':                 existing_orm.phone,
            'location':              existing_orm.location,
            'total_experience_years': existing_prof.total_experience_years if existing_prof else None,
            'skills':                existing_skills,
        }

        score = calculate_similarity(new_record, existing_record)
        if score >= UNION_THRESHOLD:
            # New candidate is a duplicate of existing_orm
            # existing_orm becomes master (it already exists, new one is the dup)
            new_orm.is_duplicate        = 'true'
            new_orm.master_candidate_id = existing_orm.candidate_id
            new_orm.dedup_merged_at     = datetime.now(timezone.utc)

            # Merge new candidate's skills into master
            new_skill_names = set(s.lower().strip() for s in new_skills)
            _merge_skills_into_master(db, existing_orm, new_skill_names)

            try:
                db.commit()
            except Exception:
                db.rollback()
                raise

            logger.info(
                f"[DSU] New candidate '{new_orm.full_name}' marked as duplicate of "
                f"'{existing_orm.full_name}' (score={score:.3f})"
            )
            return str(existing_orm.candidate_id)

    return None   # unique candidate
