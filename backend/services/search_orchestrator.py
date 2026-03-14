"""
services/search_orchestrator.py

Enhanced pipeline — 6 steps vs original 5:

  Step 0 — Query Intent Parsing  [NEW]
    LLM parses "React dev, 3+ years, NYC" →
    { skills_required, min_exp, location, semantic_query }
    Simple queries (no filter signals) skip LLM call via regex fast-path.

  Step 1 — Metadata Pre-filtering  [NEW]
    Apply parsed structured filters as SQL WHERE clauses.
    Eliminates candidates who can't possibly match BEFORE search runs.
    → Reduces weak candidates reaching RAG → less hallucination pressure.

  Step 2 — Hybrid Search (Vector + BM25)  [UPGRADED from pure vector]
    Vector: embed semantic_query (filter noise removed) → cosine similarity
    BM25:   PostgreSQL full-text on original query → exact skill matching
    Fuse both with Reciprocal Rank Fusion (RRF, k=60).

  Step 3 — Hydrate candidate data
    Fetch full profile for each candidate ID from PostgreSQL.

  Step 4 — Parallel RAG summarization
    Anti-hallucination RAG prompt per candidate.
    Now receives cleaner candidates → LLM has less pressure to confabulate.

  Step 5 — Compute enhanced match score  [UPDATED]
    Blend: 45% hybrid_rrf + 30% skill overlap + 15% experience match + 10% confidence

  Step 6 — Re-rank and return top-K
"""

import logging
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy.orm import Session

from services.query_intent_parser import parse_query_intent, ParsedIntent
from services.metadata_filter import apply_metadata_filters
from services.hybrid_search import hybrid_search
from services.vector_search import fetch_candidates_for_search
from services.rag_summarizer import generate_candidate_summary
from config.settings import settings

logger = logging.getLogger(__name__)


def run_search(
    db:    Session,
    query: str,
    top_k: int = 7,
) -> List[dict]:
    """
    Full enhanced pipeline: natural language query → ranked candidates with AI summaries.
    Returns list of result dicts safe to serialize directly to frontend.
    """
    if not query or not query.strip():
        return []

    # ── Step 0: Parse query intent ────────────────────────────────────────────
    logger.info(f"[0] Parsing query intent: '{query}'")
    intent = parse_query_intent(query)
    logger.info(
        f"[0] Intent: skills={intent.skills_required}, "
        f"exp>={intent.min_experience_years}, "
        f"location='{intent.location_hint}', "
        f"senior={intent.is_senior}"
    )

    # ── Step 1: Metadata pre-filter ───────────────────────────────────────────
    logger.info("[1] Applying metadata pre-filters")
    filter_ids = apply_metadata_filters(db, intent)

    if filter_ids is not None and len(filter_ids) == 0:
        # Hard filters returned zero matches — relax skill filter and retry
        logger.warning("[1] Zero candidates after hard filters — relaxing skill filter")
        intent_relaxed = ParsedIntent(
            min_experience_years = intent.min_experience_years,
            max_experience_years = intent.max_experience_years,
            location_hint        = intent.location_hint,
            is_senior            = intent.is_senior,
            semantic_query       = intent.semantic_query,
            original_query       = intent.original_query,
        )
        filter_ids = apply_metadata_filters(db, intent_relaxed)
        if not filter_ids:
            filter_ids = None   # full fallback — no filtering

    # ── Step 2: Hybrid search ─────────────────────────────────────────────────
    logger.info("[2] Running hybrid search (vector + BM25)")
    hybrid_results = hybrid_search(
        db                   = db,
        query                = intent.original_query,
        semantic_query       = intent.semantic_query or query,
        top_k                = top_k * 2,
        candidate_filter_ids = filter_ids,
    )

    if not hybrid_results:
        logger.warning("[2] Hybrid search returned no results.")
        return []

    # ── Step 3: Hydrate candidate data ────────────────────────────────────────
    logger.info(f"[3] Hydrating {len(hybrid_results)} candidates")
    candidate_ids   = [cid for cid, _ in hybrid_results]
    hybrid_rrf_map  = {cid: score for cid, score in hybrid_results}
    candidates_data = fetch_candidates_for_search(db, candidate_ids)

    if not candidates_data:
        return []

    # ── Step 4: Parallel RAG summarization ───────────────────────────────────
    logger.info(f"[4] RAG summaries for {len(candidates_data)} candidates")
    summaries = {}
    with ThreadPoolExecutor(max_workers=min(settings.max_workers, len(candidates_data))) as executor:
        futures = {
            executor.submit(
                generate_candidate_summary,
                cdata.get("resume_text", ""),
                intent.original_query,
                cdata,
            ): cid
            for cid, cdata in candidates_data.items()
        }
        for future in as_completed(futures):
            cid = futures[future]
            try:
                summaries[cid] = future.result()
            except Exception as e:
                logger.error(f"[4] Summary failed for {cid}: {e}")
                summaries[cid] = {}

    # ── Step 5: Compute enhanced match score ──────────────────────────────────
    results = []
    for cid, cdata in candidates_data.items():
        rrf_score = hybrid_rrf_map.get(cid, 0.0)
        summary   = summaries.get(cid, {})

        final_score = _compute_final_score(
            rrf_score        = rrf_score,
            matched_skills   = summary.get("matched_skills", []),
            required_skills  = intent.skills_required,
            candidate_skills = cdata.get("skills", []),
            experience_years = cdata.get("experience_years"),
            min_exp_required = intent.min_experience_years,
            confidence       = summary.get("confidence", "low"),
        )

        results.append({
            "candidate_id":   cdata["candidate_id"],
            "full_name":      cdata["full_name"],
            "email":          cdata["email"],
            "phone":          cdata["phone"],
            "location":       cdata["location"],
            "linkedin_url":   cdata["linkedin_url"],
            "portfolio_url":  cdata["portfolio_url"],
            "resume_url":     cdata["resume_url"],

            "current_role":     summary.get("current_role") or cdata.get("job_title"),
            "experience_years": summary.get("experience_years") or _format_exp(cdata.get("experience_years")),
            "education":        cdata.get("education"),
            "all_skills":       cdata.get("skills", []),

            "summary":            summary.get("summary"),
            "query_match_reason": summary.get("query_match_reason"),
            "matched_skills":     summary.get("matched_skills", []),
            "skill_gaps":         summary.get("skill_gaps", []),
            "confidence":         summary.get("confidence", "medium"),

            "hybrid_rrf_score":  round(rrf_score, 4),
            "final_score":       final_score,

            "_filters_applied": {
                "skills":    intent.skills_required,
                "min_exp":   intent.min_experience_years,
                "location":  intent.location_hint,
                "is_senior": intent.is_senior,
            }
        })

    # ── Step 6: Re-rank and cap at top_k ─────────────────────────────────────
    results.sort(key=lambda x: x["final_score"], reverse=True)
    top = results[:top_k]
    logger.info(f"[6] Returning {len(top)} results. Top score: {top[0]['final_score'] if top else 'N/A'}")
    return top


def _compute_final_score(
    rrf_score:        float,
    matched_skills:   List[str],
    required_skills:  List[str],
    candidate_skills: List[str],
    experience_years: Optional[float],
    min_exp_required: Optional[float],
    confidence:       str,
) -> int:
    """
    Enhanced blended match score (0-99):
      45% — Hybrid RRF score (normalized to 0-1)
      30% — Skill overlap (required skills weighted over general overlap)
      15% — Experience match (partial credit for near-misses)
      10% — RAG confidence bonus
    """
    # 1. Normalize RRF — theoretical max = 1/(k+1) for rank 1
    rrf_max = 1.0 / (60 + 1)
    rrf_component = min(rrf_score / rrf_max, 1.0) * 45

    # 2. Skill overlap
    if required_skills and matched_skills:
        required_lower = {s.lower() for s in required_skills}
        matched_lower  = {s.lower() for s in matched_skills}
        skill_ratio = len(required_lower & matched_lower) / len(required_lower)
    elif candidate_skills and matched_skills:
        skill_ratio = len(matched_skills) / max(len(candidate_skills), 1)
    else:
        skill_ratio = 0.0
    skill_component = min(skill_ratio, 1.0) * 30

    # 3. Experience match
    if min_exp_required is None or experience_years is None:
        exp_component = 15
    elif experience_years >= min_exp_required:
        exp_component = 15
    else:
        exp_component = int((experience_years / min_exp_required) * 15)

    # 4. Confidence bonus
    confidence_bonus = {"high": 10, "medium": 6, "low": 1}.get(confidence, 4)

    return min(int(round(rrf_component + skill_component + exp_component + confidence_bonus)), 99)


def _format_exp(years: Optional[float]) -> Optional[str]:
    if years is None:
        return None
    return f"{int(years)} years" if years == int(years) else f"{years} years"
