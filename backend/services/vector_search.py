"""
services/vector_search.py

Step 1 of the search pipeline:
  - Embed the recruiter's natural language query using the same model
    used during ingestion (all-MiniLM-L6-v2, 384-dim)
  - Run cosine similarity search against resume_embeddings in PostgreSQL
  - Return top-K candidate IDs with their similarity scores

Why cosine similarity and not L2 distance?
  Cosine measures angle between vectors (semantic direction), not magnitude.
  This means "3 years React experience" and "senior React developer" point
  in the same direction even if their magnitudes differ.
  pgvector operator: <=> = cosine distance (1 - similarity), lower = better match.
"""

import logging
from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

from services.embedder import get_embedding

logger = logging.getLogger(__name__)

# Number of candidates to fetch from vector DB before re-ranking
# We fetch more than needed (2x) so the LLM re-ranker has room to work
VECTOR_FETCH_MULTIPLIER = 2


def vector_search(
    db:         Session,
    query:      str,
    top_k:      int = 7,
    min_score:  float = 0.25,   # cosine similarity floor — below this is noise
) -> List[Tuple[str, float]]:
    """
    Embed the query and find the top-k most similar candidates.

    Returns:
        List of (candidate_id, similarity_score) tuples, sorted best-first.
        similarity_score is 0.0–1.0 (1.0 = identical).
    """
    # Embed the query using the same model as ingestion
    query_vector = get_embedding(query)

    fetch_k = top_k * VECTOR_FETCH_MULTIPLIER

    # pgvector cosine distance query
    # <=> operator = cosine distance = 1 - cosine_similarity
    # So (1 - distance) = similarity score we want
    sql = text("""
        SELECT
            re.candidate_id::text,
            1 - (re.embedding <=> CAST(:query_vec AS vector)) AS similarity
        FROM resume_embeddings re
        WHERE 1 - (re.embedding <=> CAST(:query_vec AS vector)) >= :min_score
        ORDER BY re.embedding <=> CAST(:query_vec AS vector)
        LIMIT :fetch_k
    """)

    try:
        result = db.execute(sql, {
            "query_vec": str(query_vector),
            "min_score": min_score,
            "fetch_k":   fetch_k,
        })
        rows = result.fetchall()
        return [(str(row.candidate_id), float(row.similarity)) for row in rows]

    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        # Fallback: return empty — caller handles gracefully
        return []


def fetch_candidates_for_search(
    db:           Session,
    candidate_ids: List[str],
) -> dict:
    """
    Fetch full candidate data for the IDs returned by vector search.
    Returns dict keyed by candidate_id for O(1) lookup.
    """
    from models.schema import Candidate, ProfessionalInfo, Education, Resume, CandidateSkill, Skill

    if not candidate_ids:
        return {}

    candidates = (
        db.query(Candidate)
        .filter(Candidate.candidate_id.in_(candidate_ids))
        .all()
    )

    result = {}
    for c in candidates:
        # Get latest resume text (most recent upload)
        latest_resume = (
            db.query(Resume)
            .filter_by(candidate_id=c.candidate_id)
            .order_by(Resume.uploaded_at.desc())
            .first()
        )

        # Get professional info
        prof = db.query(ProfessionalInfo).filter_by(candidate_id=c.candidate_id).first()

        # Get most recent education
        edu = (
            db.query(Education)
            .filter_by(candidate_id=c.candidate_id)
            .order_by(Education.graduation_year.desc())
            .first()
        )

        # Get skills (names only)
        skills = (
            db.query(Skill.skill_name)
            .join(CandidateSkill, Skill.skill_id == CandidateSkill.skill_id)
            .filter(CandidateSkill.candidate_id == c.candidate_id)
            .all()
        )

        result[str(c.candidate_id)] = {
            "candidate_id":  str(c.candidate_id),
            "full_name":     c.full_name,
            "email":         c.email,
            "phone":         c.phone,
            "location":      c.location,
            "linkedin_url":  c.linkedin_url,
            "portfolio_url": c.portfolio_url,
            "resume_url":    latest_resume.resume_file_url if latest_resume else None,
            "resume_text":   latest_resume.resume_text     if latest_resume else "",
            "job_title":     prof.current_job_title        if prof else None,
            "company":       prof.current_company          if prof else None,
            "experience_years": prof.total_experience_years if prof else None,
            "education":     f"{edu.degree}, {edu.university}" if edu else None,
            "skills":        [s.skill_name for s in skills],
        }

    return result
