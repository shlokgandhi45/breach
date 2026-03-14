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
import traceback
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy.orm import Session

from services.query_intent_parser import parse_query_intent, ParsedIntent
from services.metadata_filter import apply_metadata_filters
from services.hybrid_search import hybrid_search, BM25_WEIGHT, RRF_K
from services.vector_search import fetch_candidates_for_search
from services.rag_summarizer import generate_candidate_summary
from services.ai_config import ai_config          # live weight store
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

    try:
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
                education        = cdata.get("education"),
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
    except Exception as e:
        logger.error(f"FATAL SEARCH ERROR: {e}")
        with open('c:/Users/91898/Documents/ML Playlist/Breach_PDEU/backend_breach/search_error.txt', 'w') as f:
            traceback.print_exc(file=f)
        raise e


def _compute_final_score(
    rrf_score:        float,
    matched_skills:   List[str],
    required_skills:  List[str],
    candidate_skills: List[str],
    experience_years: Optional[float],
    min_exp_required: Optional[float],
    confidence:       str,
    education:        Optional[str] = None,
) -> int:
    """
    Dynamic blended match score (0-99).

    Weights are read LIVE from ai_config singleton on every call,
    so slider changes on the frontend take effect immediately on the
    next search — no restart needed.

    The four slider weights (skill, experience, culture_fit, education)
    are normalised to sum to 100 by the AIConfigStore before storage.
    We convert each to a 0-1 fraction and apply it to its component.

    Components:
      skill_weight       → controls how much RRF + skill overlap matters
      experience_weight  → controls how much exp match matters
      culture_fit_weight → controls how much RAG confidence matters
      education_weight   → bonus for having education data
    """
    # ── Read live weights ─────────────────────────────────────────────────────
    w = ai_config.get_weights()

    # Convert percentages to fractions (they sum to ≤ 1.0 after normalisation)
    total_w       = w.skill_weight + w.experience_weight + w.culture_fit_weight + w.education_weight
    # Guard against zero-total (shouldn't happen but be safe)
    safe_total    = max(total_w, 1.0)

    skill_frac    = w.skill_weight       / safe_total
    exp_frac      = w.experience_weight  / safe_total
    culture_frac  = w.culture_fit_weight / safe_total
    edu_frac      = w.education_weight   / safe_total

    # ── Component 1: Skill match (driven by skill_weight) ─────────────────────
    # Sub-blend: 60% RRF hybrid score + 40% explicit skill overlap
    rrf_max = 1.0 / (RRF_K + 1)
    rrf_norm = min(rrf_score / rrf_max, 1.0)

    if required_skills and matched_skills:
        required_lower = {s.lower() for s in required_skills}
        matched_lower  = {s.lower() for s in matched_skills}
        skill_ratio    = len(required_lower & matched_lower) / len(required_lower)
    elif candidate_skills and matched_skills:
        skill_ratio = len(matched_skills) / max(len(candidate_skills), 1)
    else:
        skill_ratio = 0.0

    skill_component = (0.6 * rrf_norm + 0.4 * min(skill_ratio, 1.0)) * skill_frac * 100

    # ── Component 2: Experience match (driven by experience_weight) ───────────
    if min_exp_required is None or experience_years is None:
        exp_ratio = 1.0   # neutral — no requirement or no data
    elif experience_years >= min_exp_required:
        exp_ratio = 1.0
    else:
        exp_ratio = experience_years / min_exp_required

    exp_component = exp_ratio * exp_frac * 100

    # ── Component 3: Culture fit / RAG confidence (culture_fit_weight) ────────
    confidence_ratio = {"high": 1.0, "medium": 0.6, "low": 0.1}.get(confidence, 0.4)
    culture_component = confidence_ratio * culture_frac * 100

    # ── Component 4: Education bonus (education_weight) ───────────────────────
    # Simple presence bonus — 1.0 if candidate has education data, 0.5 otherwise
    edu_ratio = 1.0 if education else 0.5
    edu_component = edu_ratio * edu_frac * 100

    # ── Blend all components ──────────────────────────────────────────────────
    raw = skill_component + exp_component + culture_component + edu_component
    return min(int(round(raw)), 99)   # cap at 99 — 100% match is philosophically wrong


def _format_exp(years: Optional[float]) -> Optional[str]:
    if years is None:
        return None
    return f"{int(years)} years" if years == int(years) else f"{years} years"
