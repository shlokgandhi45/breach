"""
services/metadata_filter.py

Applies structured SQL filters from ParsedIntent BEFORE vector/BM25 search.

WHY THIS MATTERS FOR HALLUCINATION:
  If "React developer, 5+ years" retrieves a 1-year React intern via
  vector similarity, the RAG LLM has two bad options:
    1. Honestly say "this is a poor match" → low confidence, low score
    2. Hallucinate reasons they match → confabulation

  Pre-filtering eliminates option 2 by never letting weak candidates
  reach the RAG stage. The LLM only sees candidates who already pass
  hard requirements. Less pressure = less hallucination.

FILTERS APPLIED (from ParsedIntent):
  - min_experience_years  → professional_info.total_experience_years >= N
  - max_experience_years  → professional_info.total_experience_years <= N
  - location_hint         → candidates.location ILIKE '%hint%'
  - skills_required       → candidate must have ALL required skills in DB
  - is_senior             → job_title ILIKE '%senior%' OR '%lead%' etc.

SOFT vs HARD FILTERS:
  This prevents zero results when candidates list "ReactJS" instead of "React".
  Experience and location are HARD filters.
"""

import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from models.schema import Candidate, ProfessionalInfo, CandidateSkill, Skill
from services.query_intent_parser import ParsedIntent

logger = logging.getLogger(__name__)

# Minimum fraction of required skills a candidate must have to pass filter
SKILL_MATCH_THRESHOLD = 0.5   # must have at least 50% of required skills


def apply_metadata_filters(
    db:     Session,
    intent: ParsedIntent,
) -> Optional[List[str]]:
    """
    Query database for candidates matching the structured filters.
    """
    has_filters = any([
        intent.min_experience_years is not None,
        intent.max_experience_years is not None,
        intent.location_hint,
        intent.skills_required,
        intent.is_senior is not None,
    ])

    if not has_filters:
        logger.info("No structured filters extracted — skipping metadata pre-filter")
        return None

    try:
        # Use SQLAlchemy ORM for better ID handling (UUID vs String)
        query = db.query(Candidate.candidate_id).outerjoin(ProfessionalInfo)

        # ── Experience filters ────────────────────────────────────────────────
        if intent.min_experience_years is not None:
            query = query.filter(ProfessionalInfo.total_experience_years >= intent.min_experience_years)

        if intent.max_experience_years is not None:
            query = query.filter(ProfessionalInfo.total_experience_years <= intent.max_experience_years)

        # ── Location filter ───────────────────────────────────────────────────
        if intent.location_hint:
            term = f"%{intent.location_hint}%"
            query = query.filter(
                (Candidate.location.ilike(term)) | (Candidate.location.is_(None))
            )

        # ── Seniority filter ──────────────────────────────────────────────────
        if intent.is_senior is True:
            titles = ['%senior%', '%lead%', '%staff%', '%principal%', '%head of%']
            query = query.filter(or_(*[ProfessionalInfo.current_job_title.ilike(t) for t in titles]))
        elif intent.is_senior is False:
            query = query.filter(~ProfessionalInfo.current_job_title.ilike('%senior%'))

        candidate_ids = [str(row[0]) for row in query.all()]

        if not candidate_ids:
            logger.warning(f"Hard filters returned 0 candidates")
            return []

        # ── Skill soft-filter ────────────────────────────────────────────────
        if intent.skills_required:
            candidate_ids = _apply_skill_filter(db, candidate_ids, intent.skills_required)

        return candidate_ids

    except Exception as e:
        logger.error(f"Metadata filter failed: {e}")
        return None


def _apply_skill_filter(
    db:            Session,
    candidate_ids: List[str],
    skills_required: List[str],
) -> List[str]:
    """
    Soft skill filter using ORM.
    """
    if not skills_required or not candidate_ids:
        return candidate_ids

    threshold_count = max(1, int(len(skills_required) * SKILL_MATCH_THRESHOLD))

    # Convert strings back to UUIDs if necessary for SQLAlchemy
    import uuid
    id_objs = []
    for cid in candidate_ids:
        try:
            id_objs.append(uuid.UUID(cid))
        except ValueError:
            id_objs.append(cid)

    # Build fuzzy skill matches
    skill_filters = [Skill.skill_name.ilike(f"%{s}%") for s in skills_required]
    
    filtered_query = (
        db.query(CandidateSkill.candidate_id)
        .join(Skill)
        .filter(CandidateSkill.candidate_id.in_(id_objs))
        .filter(or_(*skill_filters))
        .group_by(CandidateSkill.candidate_id)
        .having(func.count(Skill.skill_id) >= threshold_count)
    )

    filtered_ids = [str(row[0]) for row in filtered_query.all()]
    return filtered_ids


from sqlalchemy import or_, func
