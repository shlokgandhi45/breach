"""
scripts/bulk_ingest.py
CLI script to ingest an entire folder of PDFs into the database.

Usage:
  python scripts/bulk_ingest.py --folder ./dataset/resumes
  python scripts/bulk_ingest.py --folder ./dataset --source linkedin --workers 4

Options:
  --folder   Path to folder containing PDF files (searches recursively)
  --source   resume_source value: pdf_upload | linkedin | hrms | email (default: pdf_upload)
  --workers  Parallel workers (default: from MAX_WORKERS env var)
  --dry-run  Parse only, don't write to DB (useful for testing)
  --limit    Max number of files to process (default: all)

This script is IDEMPOTENT — safe to run multiple times on the same folder.
Already-ingested candidates (matched by email) will be updated, not duplicated.
"""

import sys
import os
import argparse
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

# Add parent to path so imports work when run from any directory
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.schema import SessionLocal, Base, engine
from services.pdf_extractor import extract_text_from_bytes, store_pdf
from services.llm_parser import parse_resume
from services.db_writer import write_candidate
from config.settings import settings

logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s [%(levelname)s] %(message)s",
    handlers = [
        logging.StreamHandler(),
        logging.FileHandler(f"ingest_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
    ]
)
logger = logging.getLogger(__name__)


def process_one(pdf_path: Path, source: str, dry_run: bool) -> dict:
    """Process a single PDF file. Returns a result dict."""
    result = {"file": pdf_path.name, "success": False, "candidate": None, "error": None}

    try:
        pdf_bytes   = pdf_path.read_bytes()
        resume_text = extract_text_from_bytes(pdf_bytes)

        if not resume_text.strip():
            result["error"] = "No extractable text (scanned PDF?)"
            return result

        parsed = parse_resume(resume_text)

        if dry_run:
            result["success"]   = True
            result["candidate"] = f"{parsed.full_name} <{parsed.email}> | {len(parsed.skills)} skills"
            return result

        file_url = store_pdf(pdf_bytes, pdf_path.name)

        db = SessionLocal()
        try:
            candidate = write_candidate(
                db            = db,
                parsed        = parsed,
                resume_text   = resume_text,
                file_url      = file_url,
                resume_source = source,
            )
            result["success"]   = True
            result["candidate"] = f"{candidate.full_name} <{candidate.email}>"
        finally:
            db.close()

    except Exception as e:
        result["error"] = str(e)
        logger.error(f"Failed: {pdf_path.name} — {e}", exc_info=True)

    return result


def main():
    parser = argparse.ArgumentParser(description="Bulk ingest PDF resumes into the recruitment DB")
    parser.add_argument("--folder",   required=True,          help="Folder containing PDF files")
    parser.add_argument("--source",   default="pdf_upload",   help="resume_source value")
    parser.add_argument("--workers",  type=int, default=settings.max_workers)
    parser.add_argument("--dry-run",  action="store_true",    help="Parse only, no DB writes")
    parser.add_argument("--limit",    type=int, default=None, help="Max files to process")
    args = parser.parse_args()

    folder = Path(args.folder)
    if not folder.exists():
        print(f"ERROR: Folder not found: {folder}")
        sys.exit(1)

    # Find all PDFs recursively
    pdf_files = sorted(folder.rglob("*.pdf"))
    if not pdf_files:
        print(f"No PDF files found in {folder}")
        sys.exit(0)

    if args.limit:
        pdf_files = pdf_files[:args.limit]

    # Ensure tables exist
    if not args.dry_run:
        Base.metadata.create_all(engine)
        logger.info("DB tables verified.")

    total    = len(pdf_files)
    success  = 0
    failed   = 0
    skipped  = 0

    print(f"\n{'='*60}")
    print(f"  Ingesting {total} PDF files from: {folder}")
    print(f"  Source: {args.source} | Workers: {args.workers} | Dry run: {args.dry_run}")
    print(f"{'='*60}\n")

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(process_one, pdf, args.source, args.dry_run): pdf
            for pdf in pdf_files
        }

        for i, future in enumerate(as_completed(futures), 1):
            result = future.result()
            status = "OK" if result["success"] else "FAIL"

            if result["success"]:
                success += 1
                print(f"  [{i:4}/{total}] {status}  {result['file']:<40} → {result['candidate']}")
            else:
                failed += 1
                print(f"  [{i:4}/{total}] {status}  {result['file']:<40} ✗ {result['error']}")

    print(f"\n{'='*60}")
    print(f"  Done. Success: {success} | Failed: {failed} | Total: {total}")
    if args.dry_run:
        print("  (Dry run — no data written to DB)")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
