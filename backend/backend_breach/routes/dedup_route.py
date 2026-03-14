"""
routes/dedup_route.py

Manual deduplication trigger and status endpoints.

  POST /api/deduplicate          — run full DSU deduplication on all candidates
  GET  /api/deduplicate/status   — count of duplicates currently in DB
  POST /api/deduplicate/reset    — un-mark all duplicates (for re-running)
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.schema import get_db, Candidate
from services.dsu.engine import run_deduplication

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/deduplicate", tags=["deduplicate"])


@router.post("")
async def trigger_deduplication(db: Session = Depends(get_db)):
    """
    Run the full DSU deduplication pipeline against all candidates.

    - Loads all non-duplicate candidates
    - Compares all pairs using Levenshtein name + Jaccard skills + phone/email exact match
    - Clusters duplicates via Union-Find with path compression + union by rank
    - Marks duplicate records as is_duplicate=True in DB (they stay in DB, hidden from views)
    - Merges skills from duplicates into the master record

    Safe to run multiple times — already-marked duplicates are excluded each run.
    """
    try:
        result = run_deduplication(db)
    except Exception as e:
        logger.error(f"Deduplication failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "success":             True,
        "total_input":         result.total_input,
        "total_output":        result.total_output,
        "duplicates_marked":   result.duplicates_marked,
        "clusters_merged":     result.clusters_merged,
        "comparisons_run":     result.comparisons_run,
        "comparisons_skipped": result.comparisons_skipped,
        "clusters": [
            {
                "master_id":     c.master_id,
                "master_name":   c.master_name,
                "duplicate_ids": c.duplicate_ids,
                "source_count":  c.source_count,
                "merged_skills": c.merged_skills,
            }
            for c in result.clusters
        ],
        "errors": result.errors,
    }


@router.get("/status")
async def dedup_status(db: Session = Depends(get_db)):
    """
    Returns a count of how many duplicate records are in the DB.
    Useful for showing a badge on the frontend (e.g. '12 duplicates found').
    """
    try:
        total      = db.query(func.count(Candidate.candidate_id)).scalar() or 0
        duplicates = (
            db.query(func.count(Candidate.candidate_id))
            .filter(Candidate.is_duplicate == 'true')
            .scalar() or 0
        )
        unique = total - duplicates
        return {
            "total_candidates": total,
            "unique_candidates": unique,
            "duplicate_records": duplicates,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset")
async def reset_dedup_flags(db: Session = Depends(get_db)):
    """
    Un-marks all is_duplicate flags. Use this before re-running deduplication
    from scratch (e.g. if you changed the threshold or scoring weights).
    WARNING: this clears all current merge decisions.
    """
    try:
        updated = (
            db.query(Candidate)
            .filter(Candidate.is_duplicate == 'true')
            .all()
        )
        count = len(updated)
        for c in updated:
            c.is_duplicate        = 'false'
            c.master_candidate_id = None
            c.dedup_merged_at     = None
        db.commit()
        logger.info(f"[DSU] Reset {count} duplicate flags")
        return {"success": True, "flags_reset": count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
