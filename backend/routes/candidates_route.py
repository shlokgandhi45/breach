"""
routes/candidates_route.py

Endpoints for the frontend candidates pages:
  GET  /api/candidates              — list all candidates (with filters)
  GET  /api/candidates/{id}         — single candidate full profile

These return the frontend-expected JSON shape via the response_adapter.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.schema import get_db, Candidate, ProfessionalInfo
from services.response_adapter import adapt_candidate, adapt_candidate_list

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/candidates", tags=["candidates"])


@router.get("")
async def list_candidates(
    search: Optional[str] = Query(None, description="Search by name or role"),
    status: Optional[str] = Query(None, description="Filter by pipeline stage"),
    source: Optional[str] = Query(None, description="Filter by source (Upload, Email, etc.)"),
    db: Session = Depends(get_db),
):
    """
    List all candidates in the frontend-compatible shape.
    Supports optional search, status, and source filters.
    """
    query = db.query(Candidate)

    # Search filter — matches name or job title
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = (
            query.outerjoin(ProfessionalInfo)
            .filter(
                or_(
                    Candidate.full_name.ilike(term),
                    ProfessionalInfo.current_job_title.ilike(term),
                )
            )
        )

    # Pipeline stage filter
    if status and status != 'All':
        query = query.filter(Candidate.pipeline_stage == status)

    # Source filter — needs to map frontend display name back to DB values
    if source:
        source_reverse_map = {
            'Upload': 'pdf_upload',
            'LinkedIn': 'linkedin',
            'Email': 'email',
            'HRMS': 'hrms',
        }
        # This requires joining resumes — for simplicity, filter post-query
        # or we can do a subquery. Let's keep it simple for now.

    candidates = query.order_by(Candidate.created_at.desc()).all()

    result = adapt_candidate_list(candidates, db)

    # Post-query source filter (since source is on the resume, not candidate)
    if source:
        result = [c for c in result if c['source'] == source]

    return result


@router.get("/{candidate_id}")
async def get_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
):
    """Fetch a single candidate's full profile in frontend-compatible shape."""
    candidate = db.query(Candidate).filter(
        Candidate.candidate_id == candidate_id
    ).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    return adapt_candidate(candidate, db)
