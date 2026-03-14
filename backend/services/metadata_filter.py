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
  Skills are applied as SOFT filters (must match ≥ 50% of required skills).
  This prevents zero results when candidates list "ReactJS" instead of "React".
  Experience and location are HARD filters.
"""

import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from services.query_intent_parser import ParsedIntent

logger = logging.getLogger(__name__)

# Minimum fraction of required skills a candidate must have to pass filter
SKILL_MATCH_THRESHOLD = 0.5   # must have at least 50% of required skills


def apply_metadata_filters(
    db:     Session,
    intent: ParsedIntent,
) -> Optional[List[str]]:
    """
    Query PostgreSQL for candidates matching the structured filters.

    Returns:
        List of candidate_id strings that pass all hard filters.
        Returns None if no filters were parsed (caller uses full candidate pool).
        Returns [] if filters were parsed but no candidates matched.
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
        return None   # None = "no filter applied", different from [] = "zero results"

    try:
        return _run_filter_query(db, intent)
    except Exception as e:
        logger.error(f"Metadata filter failed, running unfiltered: {e}")
        return None   # Fail open — don't block search if filter crashes


def _run_filter_query(db: Session, intent: ParsedIntent) -> List[str]:
    conditions   = ["1=1"]   # always-true anchor
    params: dict = {}

    # ── Experience filters ────────────────────────────────────────────────────
    if intent.min_experience_years is not None:
        conditions.append("pi.total_experience_years >= :min_exp")
        params["min_exp"] = intent.min_experience_years

    if intent.max_experience_years is not None:
        conditions.append("pi.total_experience_years <= :max_exp")
        params["max_exp"] = intent.max_experience_years

    # ── Location filter ───────────────────────────────────────────────────────
    if intent.location_hint:
        conditions.append("(c.location ILIKE :location OR c.location IS NULL)")
        params["location"] = f"%{intent.location_hint}%"
        # We use OR IS NULL to avoid filtering out candidates with no location set
        # — they might still be relevant, let RAG decide

    # ── Seniority filter ──────────────────────────────────────────────────────
    if intent.is_senior is True:
        conditions.append("""(
            pi.current_job_title ILIKE '%senior%' OR
            pi.current_job_title ILIKE '%lead%'   OR
            pi.current_job_title ILIKE '%staff%'  OR
            pi.current_job_title ILIKE '%principal%' OR
            pi.current_job_title ILIKE '%head of%'
        )""")
    elif intent.is_senior is False:
        conditions.append("""(
            pi.current_job_title ILIKE '%junior%' OR
            pi.current_job_title ILIKE '%entry%'  OR
            pi.current_job_title ILIKE '%associate%' OR
            pi.current_job_title NOT ILIKE '%senior%'
        )""")

    where = " AND ".join(conditions)

    sql = text(f"""
        SELECT DISTINCT c.candidate_id::text
        FROM candidates c
        LEFT JOIN professional_info pi ON pi.candidate_id = c.candidate_id
        WHERE {where}
    """)

    result = db.execute(sql, params)
    candidate_ids = [row.candidate_id for row in result.fetchall()]

    if not candidate_ids:
        logger.warning(f"Hard filters returned 0 candidates for intent: {intent}")
        return []

    # ── Skill soft-filter (applied post-query for flexibility) ────────────────
    if intent.skills_required:
        candidate_ids = _apply_skill_filter(db, candidate_ids, intent.skills_required)

    logger.info(
        f"Metadata filter: {len(candidate_ids)} candidates passed "
        f"(exp>={intent.min_experience_years}, location='{intent.location_hint}', "
        f"skills={intent.skills_required})"
    )
    return candidate_ids


def _apply_skill_filter(
    db:            Session,
    candidate_ids: List[str],
    skills_required: List[str],
) -> List[str]:
    """
    Soft skill filter: candidate must have >= SKILL_MATCH_THRESHOLD fraction
    of required skills. Uses fuzzy ILIKE matching to handle variants
    ("ReactJS" matches "React", "Postgres" matches "PostgreSQL").
    """
    if not skills_required or not candidate_ids:
        return candidate_ids

    threshold_count = max(1, int(len(skills_required) * SKILL_MATCH_THRESHOLD))

    # Build ILIKE conditions for each required skill
    skill_conditions = " OR ".join(
        f"s.skill_name ILIKE :skill_{i}" for i in range(len(skills_required))
    )
    params: dict = {f"skill_{i}": f"%{skill}%" for i, skill in enumerate(skills_required)}
    params["candidate_ids"]     = candidate_ids
    params["threshold_count"]   = threshold_count

    sql = text(f"""
        SELECT cs.candidate_id::text
        FROM candidate_skills cs
        JOIN skills s ON s.skill_id = cs.skill_id
        WHERE cs.candidate_id = ANY(:candidate_ids)
          AND ({skill_conditions})
        GROUP BY cs.candidate_id
        HAVING COUNT(DISTINCT s.skill_id) >= :threshold_count
    """)

    try:
        result = db.execute(sql, params)
        filtered = [row.candidate_id for row in result.fetchall()]
        logger.info(
            f"Skill filter: {len(filtered)}/{len(candidate_ids)} candidates "
            f"have >= {threshold_count}/{len(skills_required)} required skills"
        )
        return filtered
    except Exception as e:
        logger.error(f"Skill filter failed, skipping: {e}")
        return candidate_ids   # fail open
