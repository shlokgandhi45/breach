"""
services/rag_summarizer.py

The anti-hallucination layer. This is the most critical file in the search pipeline.

ARCHITECTURE:
  For each candidate returned by vector search, we make ONE LLM call that:
    1. Receives the FULL resume text as grounding context
    2. Receives the recruiter's EXACT query
    3. Is instructed to ONLY use what's explicitly in the text
    4. Returns structured JSON (no free-form prose that can drift)
    5. Must cite which part of the resume justifies each claim

PROMPT STRATEGY (enhanced zero-hallucination version):
  - System prompt: lean role declaration only — no duplicate rules
  - User prompt: carries ALL enforcement via keyword triggers
    ("ZERO INFERENCE", "STRICTLY", "EVIDENCE ONLY") that forcefully
    guide the LLM attention mechanism to act as a strict parser
  - NOT_MENTIONED sentinel placed directly adjacent to JSON structure
    so the LLM applies it inline while generating each field
  - Trimmed conversational fluff → fewer tokens → faster parallel calls
  - JSON key names changed to be semantically unambiguous:
      match_summary         (was: summary + query_match_reason merged)
      verified_skills       (was: matched_skills)
      missing_requirements  (was: skill_gaps)
      extracted_experience  (was: experience_years)
      confidence_level      (was: confidence)

WHAT WE NEVER DO:
  - Ask the LLM to evaluate without grounding text
  - Ask open-ended questions that invite elaboration
  - Trust LLM on specific numbers (years, dates) without text evidence
  - Use the LLM to fill in missing fields ("probably has X experience")
"""

import json
import logging
from typing import Optional
from openai import OpenAI
from config.settings import settings

logger = logging.getLogger(__name__)
client = OpenAI(api_key=settings.openai_api_key)


# The sentinel string the LLM must use when info is absent
NOT_MENTIONED = "NOT_MENTIONED"


def generate_candidate_summary(
    resume_text:   str,
    recruiter_query: str,
    candidate_data: dict,
) -> dict:
    """
    Generate a grounded, hallucination-resistant summary for one candidate
    relative to a specific recruiter query.

    Returns a dict with these keys (all sourced strictly from resume_text):
      summary              : factual match summary (merged from match_summary)
      query_match_reason   : alias of summary for frontend compatibility
      matched_skills       : verified_skills from LLM, cross-checked vs DB
      skill_gaps           : missing_requirements from LLM
      experience_years     : exact text snippet or None
      current_role         : most recent role as written in resume
      confidence           : "high" | "medium" | "low"
    """
    if not resume_text or not resume_text.strip():
        return _empty_summary("No resume text available.")

    # Truncate to stay within context limits while keeping most of the resume
    truncated_text = resume_text[:5000]

    prompt = _build_grounded_prompt(truncated_text, recruiter_query, candidate_data)

    try:
        response = client.chat.completions.create(
            model           = settings.llm_model,
            messages        = [
                {
                    "role": "system",
                    # Lean role declaration only — enforcement lives in the user prompt
                    # via keyword triggers (ZERO INFERENCE, STRICTLY, EVIDENCE ONLY)
                    # Duplicating rules here wastes tokens and dilutes attention weight
                    "content": (
                        "You are an expert zero-hallucination Recruitment Analyst API. "
                        "Output ONLY valid JSON. No prose outside the JSON object."
                    )
                },
                {"role": "user", "content": prompt}
            ],
            response_format = {"type": "json_object"},
            temperature     = 0.1,   # near-deterministic — less creative drift
            max_tokens      = 500,   # reduced — new prompt is more token-efficient
        )

        raw = json.loads(response.choices[0].message.content)
        return _validate_and_clean(raw, candidate_data)

    except Exception as e:
        logger.error(f"RAG summary failed for {candidate_data.get('full_name')}: {e}")
        return _empty_summary(str(e))


def _build_grounded_prompt(
    resume_text:     str,
    recruiter_query: str,
    candidate_data:  dict,
) -> str:
    # Pass DB skills as a cross-reference anchor — helps LLM verify_skills faster
    known_skills = ", ".join(candidate_data.get("skills", [])[:20]) or NOT_MENTIONED

    return f"""
You are an expert, zero-hallucination Recruitment Analyst API. Your task is to evaluate a candidate based STRICTLY on the provided resume text against the recruiter's search query.

**STRICT RULES - READ CAREFULLY:**
1. ZERO INFERENCE: You must never guess, calculate, or assume. Do not deduce skills that are not explicitly written.
2. EVIDENCE ONLY: Every claim in your summary must have direct textual evidence in the resume.
3. MISSING DATA: If a requested data point or query requirement is completely absent from the resume, you MUST use the exact string "{NOT_MENTIONED}".

**INPUTS:**
- Recruiter Query: "{recruiter_query}"
- Resume Text: "{resume_text}"
- Known Skills (DB cross-reference, do not add skills outside this list or the resume text): {known_skills}

**REQUIRED JSON OUTPUT:**
{{
  "match_summary": "<1-2 purely factual sentences explaining why the resume fits or fails the query. No marketing fluff.>",
  "verified_skills": ["<Only skills explicitly requested in the query AND found in the resume text>"],
  "missing_requirements": ["<Skills/requirements asked for in the query but missing from the resume text. Use empty list [] if none missing.>"],
  "extracted_experience": "<Exact text snippet regarding total years of experience, or '{NOT_MENTIONED}'>",
  "current_role": "<Most recent job title and company AS WRITTEN in resume, or '{NOT_MENTIONED}'>",
  "confidence_level": "<'High', 'Medium', or 'Low' based on how strongly the text evidence supports the match>"
}}
"""


def _validate_and_clean(raw: dict, candidate_data: dict) -> dict:
    """
    Maps the new prompt's JSON keys to the frontend-compatible output shape,
    then applies the same belt-and-suspenders skill verification.

    New prompt keys   → output keys
    match_summary     → summary + query_match_reason (same value, two aliases)
    verified_skills   → matched_skills (cross-checked against DB)
    missing_requirements → skill_gaps
    extracted_experience → experience_years
    current_role      → current_role (unchanged)
    confidence_level  → confidence (lowercased)
    """
    known_skills_lower = {s.lower() for s in candidate_data.get("skills", [])}

    # Cross-check verified_skills against DB skills
    # Belt-and-suspenders: LLM occasionally hallucinates a skill variant
    raw_verified = raw.get("verified_skills", [])
    verified_matched = [
        s for s in raw_verified
        if any(
            s.lower() in known or known in s.lower()
            for known in known_skills_lower
        )
    ] if known_skills_lower else raw_verified

    # match_summary serves as both summary and query_match_reason
    # (new prompt merges these — frontend receives both keys for compatibility)
    match_summary = _clean_field(raw.get("match_summary"))

    # Normalize confidence_level to lowercase to match existing frontend logic
    raw_confidence = str(raw.get("confidence_level", "medium")).lower()
    confidence = raw_confidence if raw_confidence in ("high", "medium", "low") else "medium"

    return {
        "summary":            match_summary,
        "query_match_reason": match_summary,   # alias — same value
        "matched_skills":     verified_matched,
        "skill_gaps":         [
            s for s in raw.get("missing_requirements", [])
            if s and s != NOT_MENTIONED
        ],
        "experience_years":   _clean_field(raw.get("extracted_experience")),
        "current_role":       _clean_field(raw.get("current_role")),
        "confidence":         confidence,
    }


def _clean_field(value) -> Optional[str]:
    if value is None or str(value).strip() in (NOT_MENTIONED, "null", ""):
        return None
    return str(value).strip()


def _empty_summary(reason: str) -> dict:
    return {
        "summary":            None,
        "query_match_reason": None,
        "matched_skills":     [],
        "skill_gaps":         [],
        "experience_years":   None,
        "current_role":       None,
        "confidence":         "low",
        "error":              reason,
    }
