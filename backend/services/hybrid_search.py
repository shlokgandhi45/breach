"""
services/hybrid_search.py

BM25 keyword search to run alongside vector search.

WHY HYBRID FIXES SEARCH QUALITY:
  Vector search is great at semantic meaning — "software engineer" matches
  "developer", "programmer", "coder". But it's terrible at exact terms.
  If a recruiter types "React" and a resume says "React", vector search
  might rank a generic "JavaScript developer" higher just because their
  overall resume embedding is semantically closer.

  BM25 fixes this. It's a classical IR algorithm that scores documents
  by exact term frequency and rarity. "React" in a resume scores
  extremely high for the query "React developer" — no semantics needed.

BLEND FORMULA (Reciprocal Rank Fusion):
  final_hybrid_score = (α × vector_rank_score) + (β × bm25_rank_score)
  α = 0.6  (vector carries more weight — semantic understanding matters)
  β = 0.4  (BM25 ensures exact skill matches aren't buried)

  We use RANK-based fusion (not raw scores) because BM25 and cosine
  similarity are on completely different scales and can't be added directly.
  Reciprocal Rank Fusion (RRF): score = 1 / (k + rank), k=60 is standard.

NO NEW DEPENDENCIES:
  BM25 implemented from scratch using PostgreSQL full-text search
  (tsvector / tsquery) — no rank library, no Elasticsearch, no Redis.
  Already in your PostgreSQL instance. Zero new infra.
"""

import logging
import math
from typing import List, Tuple, Dict
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

# RRF constant — 60 is the standard value from the original paper
RRF_K = 60

# Weight split between vector and BM25
VECTOR_WEIGHT = 0.6
BM25_WEIGHT   = 0.4


def bm25_search(
    db:         Session,
    query:      str,
    top_k:      int = 20,           # fetch more than needed for fusion
    candidate_filter_ids: List[str] = None,  # optional pre-filter from intent parser
) -> List[Tuple[str, float]]:
    """
    PostgreSQL full-text search (BM25-equivalent) over resume_text.
    Returns list of (candidate_id, bm25_rank_score) sorted best-first.

    Uses ts_rank_cd which implements a cover-density ranking that
    approximates BM25 behaviour — rewards exact phrase matches and
    penalises long documents with isolated term mentions.
    """
    # Convert query into a tsquery: "React TypeScript developer"
    # → 'React' & 'TypeScript' & 'developer'  (all terms must appear)
    # Fallback to OR (|) if AND returns too few results
    terms    = [t.strip() for t in query.split() if len(t.strip()) > 2]
    tsquery  = " & ".join(f"'{t}':*" for t in terms)  # prefix matching

    if not tsquery:
        return []

    # Optional: restrict to pre-filtered candidate IDs
    filter_clause = ""
    params: dict = {"tsquery": tsquery, "top_k": top_k}
    if candidate_filter_ids:
        filter_clause = "AND r.candidate_id = ANY(:filter_ids)"
        params["filter_ids"] = candidate_filter_ids

    sql = text(f"""
        SELECT
            r.candidate_id::text,
            ts_rank_cd(
                to_tsvector('english', r.resume_text),
                to_tsquery('english', :tsquery),
                32   -- normalization: divide by document length
            ) AS bm25_score
        FROM resumes r
        WHERE to_tsvector('english', r.resume_text) @@ to_tsquery('english', :tsquery)
        {filter_clause}
        ORDER BY bm25_score DESC
        LIMIT :top_k
    """)

    try:
        result = db.execute(sql, params)
        rows   = result.fetchall()
        return [(str(row.candidate_id), float(row.bm25_score)) for row in rows]

    except Exception as e:
        logger.error(f"BM25 search failed (tsquery='{tsquery}'): {e}")

        # Fallback: try OR query — less precise but catches partial matches
        try:
            tsquery_or = " | ".join(f"'{t}':*" for t in terms)
            params["tsquery"] = tsquery_or
            result = db.execute(sql, params)
            rows   = result.fetchall()
            logger.info("BM25 fallback OR query succeeded")
            return [(str(row.candidate_id), float(row.bm25_score)) for row in rows]
        except Exception as e2:
            logger.error(f"BM25 OR fallback also failed: {e2}")
            return []


def reciprocal_rank_fusion(
    vector_results: List[Tuple[str, float]],   # (candidate_id, similarity_score)
    bm25_results:   List[Tuple[str, float]],   # (candidate_id, bm25_score)
    top_k:          int = 14,                   # return more than needed for RAG re-ranking
) -> List[Tuple[str, float]]:
    """
    Merge vector and BM25 results using Reciprocal Rank Fusion.

    RRF score for each candidate = Σ weight_i / (k + rank_i)
    where rank_i is position in each result list (1-indexed).

    Why RRF instead of score normalization?
      - Vector scores (0.25–0.95) and BM25 scores (0.001–0.8) are on
        incompatible scales. Normalizing introduces its own distortions.
      - RRF only cares about RANK position, not raw score magnitude.
        A candidate ranked #1 in both lists dominates regardless of
        whether their scores were 0.92 vs 0.03.
      - RRF is robust to outliers and well-studied in IR literature.

    Returns list of (candidate_id, rrf_score) sorted best-first.
    """
    scores: Dict[str, float] = {}

    # Add weighted RRF contribution from vector results
    for rank, (cid, _) in enumerate(vector_results, start=1):
        scores[cid] = scores.get(cid, 0.0) + VECTOR_WEIGHT / (RRF_K + rank)

    # Add weighted RRF contribution from BM25 results
    for rank, (cid, _) in enumerate(bm25_results, start=1):
        scores[cid] = scores.get(cid, 0.0) + BM25_WEIGHT / (RRF_K + rank)

    # Sort by combined RRF score, return top_k
    merged = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return merged[:top_k]


def hybrid_search(
    db:                   Session,
    query:                str,
    semantic_query:       str,          # cleaned query from intent parser (filters removed)
    top_k:                int = 14,     # pool size before RAG re-ranking
    candidate_filter_ids: List[str] = None,
) -> List[Tuple[str, float]]:
    """
    Full hybrid search: vector + BM25 → RRF fusion.

    Args:
        query:          Original recruiter query (for BM25 exact matching)
        semantic_query: Cleaned query from intent parser (for vector embedding)
                        If no intent parser ran, same as query.
        candidate_filter_ids: Pre-filtered IDs from metadata SQL filters.
                              If provided, BM25 only searches within this pool.

    Returns:
        List of (candidate_id, rrf_score) sorted best-first, ready for
        candidate hydration and RAG summarization.
    """
    from services.vector_search import vector_search as _vector_search

    # Run both searches — BM25 is pure SQL, very fast
    # Vector search embeds semantic_query (cleaner signal without filter noise)
    logger.info(f"Hybrid search | semantic='{semantic_query}' | original='{query}'")

    vector_results = _vector_search(
        db       = db,
        query    = semantic_query,   # use cleaned query for better embedding
        top_k    = top_k,
        min_score = 0.15,            # lower floor than pure vector — BM25 will filter noise
    )

    bm25_results = bm25_search(
        db                   = db,
        query                = query,   # use original for exact keyword matching
        top_k                = top_k,
        candidate_filter_ids = candidate_filter_ids,
    )

    if not vector_results and not bm25_results:
        logger.warning("Both vector and BM25 returned empty results.")
        return []

    if not vector_results:
        logger.info("Vector search empty — using BM25 only")
        return [(cid, score) for cid, score in bm25_results[:top_k]]

    if not bm25_results:
        logger.info("BM25 empty — using vector only")
        return vector_results[:top_k]

    # Both have results — fuse with RRF
    fused = reciprocal_rank_fusion(vector_results, bm25_results, top_k=top_k)
    logger.info(
        f"Hybrid fusion: vector={len(vector_results)}, "
        f"bm25={len(bm25_results)}, fused={len(fused)}"
    )
    return fused
