"""
config/settings.py

Centralized settings — loads all env vars from .env in one place.
Every other module imports `from config.settings import settings`.

Usage:
  1. Copy .env.example → .env
  2. Fill in your DATABASE_URL and OPENAI_API_KEY
  3. All modules auto-pick up values from this singleton
"""

import os
import logging
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# Try loading .env if python-dotenv is installed
try:
    from dotenv import load_dotenv
    # Walk up to find .env relative to this file or cwd
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        logger.info(f"Loaded .env from {env_path}")
    else:
        load_dotenv()  # try cwd
except ImportError:
    pass  # dotenv not installed — rely on system env vars


@dataclass
class Settings:
    """All configuration in one place — sourced from environment variables."""

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:password@localhost:5432/recruitment"
    )

    # ── OpenAI ────────────────────────────────────────────────────────────────
    openai_api_key: str = os.environ.get("OPENAI_API_KEY", "")

    # ── LLM ───────────────────────────────────────────────────────────────────
    llm_model: str = os.environ.get("LLM_MODEL", "gpt-4o-mini")

    # ── Embedding ─────────────────────────────────────────────────────────────
    # "local" = sentence-transformers (free, CPU)
    # "openai" = text-embedding-3-small (paid, better quality)
    embedding_mode: str = os.environ.get("EMBEDDING_MODE", "local")

    # ── File storage ──────────────────────────────────────────────────────────
    # "local" = saves to local_upload_dir
    # "s3"    = uploads to AWS S3
    storage_mode: str = os.environ.get("STORAGE_MODE", "local")
    local_upload_dir: str = os.environ.get("LOCAL_UPLOAD_DIR", "./uploads")

    # ── AWS S3 (only needed if storage_mode=s3) ───────────────────────────────
    aws_access_key: str = os.environ.get("AWS_ACCESS_KEY_ID", "")
    aws_secret_key: str = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
    aws_s3_bucket: str = os.environ.get("AWS_S3_BUCKET", "recruitment-resumes")
    aws_region: str = os.environ.get("AWS_REGION", "us-east-1")

    # ── Concurrency ───────────────────────────────────────────────────────────
    max_workers: int = int(os.environ.get("MAX_WORKERS", "4"))


# Singleton — all modules import this instance
settings = Settings()
