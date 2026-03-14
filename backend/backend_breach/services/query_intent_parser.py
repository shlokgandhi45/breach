"""
services/query_intent_parser.py

Step 0 of the enhanced pipeline — runs BEFORE vector search.

WHY THIS FIXES HALLUCINATION AT THE SOURCE:
  The root cause of hallucination isn't always the RAG prompt.
  It's retrieval pressure: when vector search returns a weakly-matched
  candidate, the LLM is forced to "find" a reason they match the query.
  That's where confabulation begins.

  Solution: parse the recruiter's intent into hard structured filters
  FIRST. Apply those as SQL WHERE clauses before vector search runs.
  Now vector search only sees a pre-filtered, relevant candidate pool —
  less pressure on the LLM, fewer weak matches to confabulate about.

WHAT IT EXTRACTS:
  "React dev, 3+ years, in NYC, must know TypeScript"
  → {
      skills_required: ["React", "TypeScript"],
      min_experience_years: 3,
      location_hint: "NYC",
      role_keywords: ["developer", "frontend"],
      is_senior: False
    }

  The structured filters become SQL WHERE clauses.
  The cleaned semantic query (minus the filters) goes to vector search.
  Both run in parallel — total latency overhead: ~300ms.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional
from openai import OpenAI
from config.settings import settings

logger = logging.getLogger(__name__)
client = OpenAI(api_key=settings.openai_api_key)

NOT_MENTIONED = "NOT_MENTIONED"


@dataclass
class ParsedIntent:
    # Structured filters → become SQL WHERE clauses
    skills_required:      List[str] = field(default_factory=list)  # hard skill requirements
    min_experience_years: Optional[float] = None                   # e.g. 3.0 for "3+ years"
    max_experience_years: Optional[float] = None                   # e.g. 5.0 for "up to 5 years"
    location_hint:        Optional[str]   = None                   # "NYC", "remote", "India"
    is_senior:            Optional[bool]  = None                   # True if "senior/lead/staff" mentioned
    role_keywords:        List[str] = field(default_factory=list)  # ["backend", "fullstack", "ML"]

    # Cleaned query → goes to vector search (filters removed to reduce noise)
    semantic_query:       str = ""

    # Raw query preserved for RAG prompt
    original_query:       str = ""


def parse_query_intent(query: str) -> ParsedIntent:
    """
    Parse recruiter's natural language query into structured intent.
    Falls back to passthrough (no filters) if LLM fails.
    Always returns a valid ParsedIntent — never raises.
    """
    if not query or not query.strip():
        return ParsedIntent(original_query=query, semantic_query=query)

    # Fast regex pre-check: if query is very short or has no filter signals,
    # skip the LLM call entirely and return passthrough
    if _is_simple_query(query):
        logger.info("Simple query detected — skipping intent parse LLM call")
        return ParsedIntent(
            original_query  = query,
            semantic_query  = query,
            role_keywords   = _extract_role_keywords(query),
        )

    try:
        # Detect if key is not set
        if not settings.openai_api_key or "PROMPT_USER_FOR_KEY" in settings.openai_api_key:
            logger.warning("OpenAI key not configured. Using mock intent parsing.")
            return ParsedIntent(
                original_query = query,
                semantic_query = query,
                role_keywords  = _extract_role_keywords(query)
            )
        return _llm_parse_intent(query)
    except Exception as e:
        logger.warning(f"Intent parse failed, using passthrough: {e}")
        return ParsedIntent(original_query=query, semantic_query=query)


def _llm_parse_intent(query: str) -> ParsedIntent:
    prompt = f"""
You are a query parser for a recruitment search engine.
Extract structured filters from the recruiter's natural language query.

STRICT RULES:
1. ZERO INFERENCE: Only extract what is explicitly stated or strongly implied.
2. If a filter is not present in the query, use null — never guess.
3. skills_required: only TECHNICAL skills explicitly named (React, Python, AWS etc.)
   Do NOT include soft skills (leadership, communication).
4. semantic_query: rewrite the query removing the structured parts,
   keeping only the semantic meaning for vector search.

Query: "{query}"

Return ONLY valid JSON:
{{
  "skills_required": ["<explicit technical skill>"],
  "min_experience_years": <float or null>,
  "max_experience_years": <float or null>,
  "location_hint": "<city/region/remote or null>",
  "is_senior": <true if senior/lead/principal/staff mentioned, false if junior/entry, null if unclear>,
  "role_keywords": ["<e.g. backend, frontend, fullstack, ML, data, devops, mobile>"],
  "semantic_query": "<query rewritten for semantic search, without hard filter terms>"
}}

Examples:
  Query: "Senior React developer, 5+ years, based in NYC, must know TypeScript and GraphQL"
  Output: {{
    "skills_required": ["React", "TypeScript", "GraphQL"],
    "min_experience_years": 5.0,
    "max_experience_years": null,
    "location_hint": "NYC",
    "is_senior": true,
    "role_keywords": ["frontend", "developer"],
    "semantic_query": "React developer with TypeScript and GraphQL experience"
  }}

  Query: "ML engineer who has worked on NLP and knows PyTorch"
  Output: {{
    "skills_required": ["PyTorch"],
    "min_experience_years": null,
    "max_experience_years": null,
    "location_hint": null,
    "is_senior": null,
    "role_keywords": ["ML", "NLP", "engineer"],
    "semantic_query": "machine learning engineer with NLP and PyTorch experience"
  }}
"""

    response = client.chat.completions.create(
        model           = settings.llm_model,
        messages        = [{"role": "user", "content": prompt}],
        response_format = {"type": "json_object"},
        temperature     = 0.0,   # fully deterministic for parsing
        max_tokens      = 300,
    )

    raw = json.loads(response.choices[0].message.content)

    return ParsedIntent(
        skills_required      = [s.strip() for s in (raw.get("skills_required") or []) if s],
        min_experience_years = _safe_float(raw.get("min_experience_years")),
        max_experience_years = _safe_float(raw.get("max_experience_years")),
        location_hint        = _clean(raw.get("location_hint")),
        is_senior            = raw.get("is_senior"),
        role_keywords        = [r.strip() for r in (raw.get("role_keywords") or []) if r],
        semantic_query       = raw.get("semantic_query") or query,
        original_query       = query,
    )


def _is_simple_query(query: str) -> bool:
    """Skip LLM parse for queries with no filter signals — saves ~300ms."""
    filter_signals = [
        r'\d+\+?\s*year', r'\d+\s*\+\s*yr',  # experience patterns
        r'\bin\s+[A-Z]',                        # location "in NYC"
        r'\bremote\b', r'\bon-?site\b',
        r'\bsenior\b', r'\bjunior\b', r'\blead\b', r'\bstaff\b',
        r'\bmust\s+have\b', r'\brequired\b',
        r'\bnyc\b', r'\bsf\b', r'\bbangalore\b',
    ]
    q_lower = query.lower()
    return not any(re.search(p, q_lower, re.I) for p in filter_signals)


def _extract_role_keywords(query: str) -> List[str]:
    """Fast regex extraction of role type for simple queries."""
    role_map = {
        "frontend": ["frontend", "front-end", "react", "vue", "angular", "ui"],
        "backend":  ["backend", "back-end", "server", "api", "django", "fastapi", "express"],
        "fullstack": ["fullstack", "full-stack", "full stack"],
        "ml":       ["ml ", "machine learning", "deep learning", "nlp", "llm", "ai "],
        "devops":   ["devops", "infra", "kubernetes", "docker", "cloud"],
        "mobile":   ["mobile", "ios", "android", "flutter", "react native"],
        "data":     ["data engineer", "data analyst", "analytics", "spark", "airflow"],
    }
    found = []
    q = query.lower()
    for role, signals in role_map.items():
        if any(s in q for s in signals):
            found.append(role)
    return found


def _safe_float(v) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _clean(v) -> Optional[str]:
    if v is None or str(v).strip().upper() in ("NULL", NOT_MENTIONED, ""):
        return None
    return str(v).strip()
