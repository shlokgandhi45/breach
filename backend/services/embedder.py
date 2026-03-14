"""
services/embedder.py
Generates VECTOR(384) embeddings for resume text.

Two modes (set EMBEDDING_MODE in .env):
  "local"  — sentence-transformers all-MiniLM-L6-v2 (384-dim, free, CPU-ok)
  "openai" — text-embedding-3-small (1536-dim — NOTE: you'd need VECTOR(1536) in DB)

For hackathon: use "local". No API cost, works offline, fast enough.
"""

import json
import logging
from typing import List
from config.settings import settings

logger = logging.getLogger(__name__)

_local_model = None   # lazy-loaded singleton

def get_embedding(text: str) -> List[float]:
    """
    Generate embedding vector for a piece of text.
    Returns list of 384 floats.
    """
    if settings.embedding_mode == "openai":
        return _openai_embedding(text)
    else:
        return _local_embedding(text)


def _local_embedding(text: str) -> List[float]:
    global _local_model
    if _local_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading sentence-transformers model (first run: ~80MB download)...")
            _local_model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Model loaded.")
        except ImportError:
            raise RuntimeError(
                "sentence-transformers not installed. Run: pip install sentence-transformers"
            )

    # Truncate to 512 tokens — model limit
    truncated = " ".join(text.split()[:400])
    vector = _local_model.encode(truncated, normalize_embeddings=True)
    return vector.tolist()


def _openai_embedding(text: str) -> List[float]:
    from openai import OpenAI
    client = OpenAI(api_key=settings.openai_api_key)
    truncated = text[:8000]
    response = client.embeddings.create(
        model = "text-embedding-3-small",
        input = truncated,
    )
    # Note: this returns 1536-dim — change VECTOR(384) to VECTOR(1536) in schema if using this
    return response.data[0].embedding


def serialize_embedding(vector: List[float]) -> str:
    """For fallback text storage when pgvector not available."""
    return json.dumps(vector)
