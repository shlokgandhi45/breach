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
    # pgvector cosine distance query is Postgres-only
    is_sqlite = db.bind.dialect.name == 'sqlite'
    if is_sqlite:
        logger.warning("Vector search requested on SQLite. Skipping (Postgres + pgvector required).")
        return []

    # Embed the query using the same model as ingestion
    query_vector = get_embedding(query)

    fetch_k = top_k * VECTOR_FETCH_MULTIPLIER

    sql = text("""
        SELECT
            re.candidate_id::text,
            1 - (re.embedding <=> CAST(:query_vec AS vector)) AS similarity
        FROM resume_embeddings re
        JOIN candidates c ON c.candidate_id = re.candidate_id
        WHERE 1 - (re.embedding <=> CAST(:query_vec AS vector)) >= :min_score
          AND c.is_duplicate = 'false'
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
    Hydrate candidate profiles for search results using stable ORM queries.
    """
    if not candidate_ids:
        return {}

    from models.schema import Candidate, Resume, ProfessionalInfo, CandidateSkill, Skill
    import uuid

    # Standardize to UUID objects for querying
    id_objs = []
    for cid in candidate_ids:
        try:
            id_objs.append(uuid.UUID(str(cid)))
        except ValueError:
            pass

    if not id_objs:
        return {}

    # Fetch candidates with their basic info
    candidates = (
        db.query(Candidate)
        .filter(Candidate.candidate_id.in_(id_objs))
        .filter(Candidate.is_duplicate == 'false')
        .all()
    )

    results = {}
    for c in candidates:
        cid_str = str(c.candidate_id)
        
        # Hydrate skills
        skill_names = [cs.skill.skill_name for cs in c.candidate_skills if cs.skill]
        
        # Get latest resume
        latest_resume = sorted(c.resumes, key=lambda r: r.uploaded_at, reverse=True)[0] if c.resumes else None
        
        # Prof info
        prof = c.professional_info

        results[cid_str] = {
            "candidate_id":   cid_str,
            "full_name":      c.full_name,
            "email":          c.email,
            "phone":          c.phone,
            "location":       c.location,
            "linkedin_url":   c.linkedin_url,
            "portfolio_url":  c.portfolio_url,
            "resume_url":     latest_resume.resume_file_url if latest_resume else None,
            "resume_text":    latest_resume.resume_text if latest_resume else "",
            "job_title":      prof.current_job_title if prof else None,
            "company":        prof.current_company if prof else None,
            "experience_years": prof.total_experience_years if prof else 0.0,
            "skills":         skill_names,
            "education":      [], 
        }

    return results
