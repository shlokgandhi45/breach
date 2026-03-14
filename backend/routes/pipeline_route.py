"""
routes/pipeline_route.py

Endpoints for the frontend Kanban pipeline board:
  GET   /api/pipeline/board   — candidates grouped by pipeline stage
  PATCH /api/pipeline/move    — move a candidate to a different stage
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.schema import get_db, Candidate
from services.response_adapter import adapt_candidate_list

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])

PIPELINE_STAGES = ['Applied', 'Screening', 'Technical', 'Interview', 'Offer', 'Hired']


class MoveRequest(BaseModel):
    candidate_id: str
    target_stage: str


@router.get("/board")
async def pipeline_board(db: Session = Depends(get_db)):
    """
    Returns candidates grouped by pipeline stage for the Kanban board.
    Shape: { "Applied": [...], "Screening": [...], ... }
    """
    # Initialize all stages (even empty ones)
    board = {stage: [] for stage in PIPELINE_STAGES}

    candidates = db.query(Candidate).all()
    adapted = adapt_candidate_list(candidates, db)

    for c in adapted:
        stage = c.get('status', 'Applied')
        if stage in board:
            board[stage].append(c)
        else:
            board['Applied'].append(c)

    return {
        "stages": PIPELINE_STAGES,
        "board":  board,
    }


@router.patch("/move")
async def move_candidate(
    req: MoveRequest,
    db:  Session = Depends(get_db),
):
    """Move a candidate to a different pipeline stage (drag-and-drop)."""
    if req.target_stage not in PIPELINE_STAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stage. Must be one of: {PIPELINE_STAGES}"
        )

    candidate = db.query(Candidate).filter(
        Candidate.candidate_id == req.candidate_id
    ).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    old_stage = candidate.pipeline_stage
    candidate.pipeline_stage = req.target_stage
    db.commit()

    logger.info(f"Moved {candidate.full_name} from '{old_stage}' → '{req.target_stage}'")

    return {
        "success": True,
        "candidate_id": str(candidate.candidate_id),
        "old_stage": old_stage,
        "new_stage": req.target_stage,
    }
