"""
routes/ingest.py
FastAPI endpoints for resume ingestion.

POST /api/ingest/upload    — single PDF upload (multipart form)
POST /api/ingest/batch     — JSON array of base64 PDFs (for programmatic use)
GET  /api/ingest/status    — pipeline health check
"""

import base64
import logging
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.schema import get_db, Candidate
from services.pdf_extractor import extract_text_from_bytes, store_pdf
from services.llm_parser import parse_resume
from services.db_writer import write_candidate
from services.dsu.engine import run_deduplication_for_new_candidate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ingest", tags=["ingest"])


# ─── Response models ──────────────────────────────────────────────────────────

class IngestResult(BaseModel):
    success:             bool
    candidate_id:        Optional[str] = None
    full_name:           Optional[str] = None
    email:               Optional[str] = None
    skills_found:        int = 0
    error:               Optional[str] = None
    is_duplicate:        bool = False              # True if DSU found this is a dup
    master_candidate_id: Optional[str] = None      # ID of the master record if dup


class BatchItem(BaseModel):
    filename:      str
    pdf_base64:    str        # base64-encoded PDF bytes
    resume_source: str = "pdf_upload"


# ─── Single PDF upload ────────────────────────────────────────────────────────

@router.post("/upload", response_model=IngestResult)
async def upload_resume(
    file:          UploadFile = File(...),
    resume_source: str        = Form(default="pdf_upload"),
    db:            Session    = Depends(get_db),
):
    """
    Upload a single PDF resume.
    Extracts text, parses fields via LLM, writes to all DB tables.

    resume_source: "pdf_upload" | "email" | "linkedin" | "hrms"
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files accepted.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=413, detail="PDF too large (max 10MB).")

    return _process_pdf(db, pdf_bytes, file.filename, resume_source)


# ─── Batch ingest (JSON, for programmatic use) ────────────────────────────────

@router.post("/batch", response_model=List[IngestResult])
async def batch_ingest(
    items: List[BatchItem],
    db:    Session = Depends(get_db),
):
    """
    Ingest multiple PDFs in one request.
    Each item is a base64-encoded PDF with metadata.
    Results returned in same order as input — check success field per item.
    Max 50 items per request.
    """
    if len(items) > 50:
        raise HTTPException(status_code=400, detail="Max 50 items per batch request.")

    results = []
    for item in items:
        try:
            pdf_bytes = base64.b64decode(item.pdf_base64)
            result = _process_pdf(db, pdf_bytes, item.filename, item.resume_source)
            results.append(result)
        except Exception as e:
            results.append(IngestResult(success=False, error=str(e)))

    return results


# ─── Status / health ──────────────────────────────────────────────────────────

@router.get("/status")
async def ingest_status(db: Session = Depends(get_db)):
    """Check pipeline health — useful for the other laptops to verify connection."""
    try:
        total = db.query(Candidate).count()
        return {
            "status":          "ok",
            "candidates_in_db": total,
            "pipeline":        "ready",
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


# ─── Core processing logic (shared by upload + batch) ─────────────────────────

def _process_pdf(
    db:            Session,
    pdf_bytes:     bytes,
    filename:      str,
    resume_source: str,
) -> IngestResult:
    try:
        # Step 1: Store file
        file_url = store_pdf(pdf_bytes, filename)

        # Step 2: Extract text
        resume_text = extract_text_from_bytes(pdf_bytes)
        if not resume_text.strip():
            return IngestResult(success=False, error="No text extractable from PDF (possibly scanned image).")

        # Step 3: Parse fields with LLM
        parsed = parse_resume(resume_text)

        # Step 4: Write to DB (atomic transaction)
        candidate = write_candidate(
            db            = db,
            parsed        = parsed,
            resume_text   = resume_text,
            file_url      = file_url,
            resume_source = resume_source,
        )

        # Step 5: Auto-dedup — check if new candidate is a duplicate
        master_id = None
        is_dup    = False
        try:
            master_id = run_deduplication_for_new_candidate(db, str(candidate.candidate_id))
            is_dup    = master_id is not None
            if is_dup:
                logger.info(
                    f"[DSU] Auto-dedup: '{candidate.full_name}' is a duplicate "
                    f"of master {master_id}"
                )
        except Exception as dedup_err:
            logger.warning(f"[DSU] Auto-dedup failed (non-fatal): {dedup_err}")

        return IngestResult(
            success             = True,
            candidate_id        = str(candidate.candidate_id),
            full_name           = candidate.full_name,
            email               = candidate.email,
            skills_found        = len(parsed.skills),
            is_duplicate        = is_dup,
            master_candidate_id = master_id,
        )

    except Exception as e:
        logger.error(f"Processing failed for {filename}: {e}", exc_info=True)
        return IngestResult(success=False, error=str(e))
