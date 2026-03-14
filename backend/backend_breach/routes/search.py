"""
routes/search.py

POST /api/search   — natural language candidate search
GET  /api/search/candidate/{id}  — single candidate full profile
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.schema import get_db
from services.search_orchestrator import run_search
from services.vector_search import fetch_candidates_for_search
from services.rag_summarizer import generate_candidate_summary

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])


class SearchRequest(BaseModel):
    query:  str
    top_k:  int = 7   # 5-7 recommended


class SearchResponse(BaseModel):
    query:      str
    total_found: int
    results:    list


@router.post("", response_model=SearchResponse)
async def search_candidates(
    req: SearchRequest,
    db:  Session = Depends(get_db),
):
    """
    Natural language candidate search.

    Example queries:
      "Find React developers with 3+ years experience"
      "Backend engineer who knows AWS and has startup experience"
      "ML engineer with Python and PyTorch"
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    if len(req.query) > 500:
        raise HTTPException(status_code=400, detail="Query too long (max 500 chars).")

    top_k = max(1, min(req.top_k, 10))   # clamp between 1-10

    try:
        results = run_search(db=db, query=req.query, top_k=top_k)
        return SearchResponse(
            query        = req.query,
            total_found  = len(results),
            results      = results,
        )
    except Exception as e:
        logger.error(f"Search failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/candidate/{candidate_id}")
async def get_candidate_profile(
    candidate_id: str,
    query:        Optional[str] = None,   # optional — re-generates summary for this query
    db:           Session       = Depends(get_db),
):
    """
    Fetch full candidate profile.
    If query param is provided, regenerates the AI summary relative to that query.
    """
    data = fetch_candidates_for_search(db, [candidate_id])
    if not data:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    cdata = data[candidate_id]

    if query:
        summary = generate_candidate_summary(
            resume_text      = cdata.get("resume_text", ""),
            recruiter_query  = query,
            candidate_data   = cdata,
        )
        cdata["ai_summary"] = summary

    return cdata
