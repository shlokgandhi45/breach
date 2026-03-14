"""
services/pdf_extractor.py
Extracts raw text from PDF bytes using PyMuPDF (fitz).
Also handles file storage — local disk or AWS S3.

Why PyMuPDF over pdfplumber/pypdf2?
- 10x faster on large PDFs
- Better at multi-column layouts common in resumes
- Handles scanned PDFs if combined with OCR (future extension point)
"""

import os
import io
import uuid
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    logger.warning("PyMuPDF not installed. Run: pip install pymupdf")

try:
    import boto3
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

from config.settings import settings


# ─── PDF text extraction ──────────────────────────────────────────────────────

def extract_text_from_bytes(pdf_bytes: bytes) -> str:
    """
    Extract all text from PDF bytes.
    Returns cleaned, deduplicated text suitable for LLM parsing.
    """
    if not PYMUPDF_AVAILABLE:
        raise RuntimeError("PyMuPDF not installed. Run: pip install pymupdf")

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_text = []

    for page in doc:
        # Extract with layout preservation (better for multi-column resumes)
        text = page.get_text("text")
        if text.strip():
            pages_text.append(text.strip())

    doc.close()

    full_text = "\n\n".join(pages_text)
    return _clean_text(full_text)


def extract_text_from_path(file_path: str) -> str:
    """Convenience wrapper for local file paths."""
    with open(file_path, "rb") as f:
        return extract_text_from_bytes(f.read())


def _clean_text(text: str) -> str:
    """Remove excessive whitespace while preserving structure."""
    lines = text.splitlines()
    cleaned = []
    prev_blank = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if not prev_blank:
                cleaned.append("")
            prev_blank = True
        else:
            cleaned.append(stripped)
            prev_blank = False
    return "\n".join(cleaned).strip()


# ─── File storage ─────────────────────────────────────────────────────────────

def store_pdf(pdf_bytes: bytes, original_filename: str) -> str:
    """
    Store PDF file and return the URL/path to store in resume_file_url.
    Dispatches to local or S3 based on STORAGE_MODE env var.
    """
    safe_name = f"{uuid.uuid4()}_{Path(original_filename).name}"

    if settings.storage_mode == "s3":
        return _store_s3(pdf_bytes, safe_name)
    else:
        return _store_local(pdf_bytes, safe_name)


def _store_local(pdf_bytes: bytes, filename: str) -> str:
    upload_dir = Path(settings.local_upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / filename
    file_path.write_bytes(pdf_bytes)
    return str(file_path)


def _store_s3(pdf_bytes: bytes, filename: str) -> str:
    if not BOTO3_AVAILABLE:
        raise RuntimeError("boto3 not installed. Run: pip install boto3")

    s3 = boto3.client(
        "s3",
        aws_access_key_id     = settings.aws_access_key,
        aws_secret_access_key = settings.aws_secret_key,
        region_name           = settings.aws_region,
    )
    key = f"resumes/{filename}"
    s3.put_object(
        Bucket      = settings.aws_s3_bucket,
        Key         = key,
        Body        = pdf_bytes,
        ContentType = "application/pdf",
    )
    return f"s3://{settings.aws_s3_bucket}/{key}"
