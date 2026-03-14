"""
routes/dashboard_route.py

Endpoints for the frontend dashboard page:
  GET /api/dashboard/stats — aggregate stats for the dashboard cards
"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.schema import get_db, Candidate
from services.response_adapter import adapt_candidate_list

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# Valid pipeline stages (kept in sync with frontend)
PIPELINE_STAGES = ['Applied', 'Screening', 'Technical', 'Interview', 'Offer', 'Hired']


@router.get("/stats")
async def dashboard_stats(db: Session = Depends(get_db)):
    """
    Returns aggregate statistics for the dashboard:
    - total_candidates: total count
    - pipeline_counts: { "Applied": N, "Screening": N, ... }
    - top_candidates: top 4 candidates (for AI Recommendations widget)
    - interview_candidates: candidates in Technical/Interview stages (for Upcoming Interviews widget)
    """
    # Total candidate count
    total = db.query(func.count(Candidate.candidate_id)).scalar() or 0

    # Pipeline stage counts
    stage_counts = (
        db.query(Candidate.pipeline_stage, func.count(Candidate.candidate_id))
        .group_by(Candidate.pipeline_stage)
        .all()
    )
    pipeline_counts = {stage: 0 for stage in PIPELINE_STAGES}
    for stage, count in stage_counts:
        if stage in pipeline_counts:
            pipeline_counts[stage] = count

    # Top candidates by most recent (for AI Recommendations)
    top_candidates_raw = (
        db.query(Candidate)
        .order_by(Candidate.created_at.desc())
        .limit(4)
        .all()
    )
    top_candidates = adapt_candidate_list(top_candidates_raw, db)

    # Interview candidates (Technical + Interview stages)
    interview_candidates_raw = (
        db.query(Candidate)
        .filter(Candidate.pipeline_stage.in_(['Technical', 'Interview']))
        .order_by(Candidate.created_at.desc())
        .limit(3)
        .all()
    )
    interview_candidates = adapt_candidate_list(interview_candidates_raw, db)

    return {
        "total_candidates":     total,
        "pipeline_counts":      pipeline_counts,
        "top_candidates":       top_candidates,
        "interview_candidates": interview_candidates,
    }
