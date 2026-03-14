"""
services/llm_parser.py
Sends raw resume text to OpenAI and gets back a structured JSON
that maps exactly to your database schema tables.

Output schema mirrors:
  candidates, professional_info, education[], resumes (source only),
  skills[]

Uses response_format=json_object for guaranteed parseable output.
Includes a fallback regex extraction for when LLM is unavailable.
"""

import re
import json
import logging
from typing import Optional
from dataclasses import dataclass, field

from openai import OpenAI
from config.settings import settings

logger = logging.getLogger(__name__)
client = OpenAI(api_key=settings.openai_api_key)


# ─── Output dataclasses (match DB schema exactly) ─────────────────────────────

@dataclass
class ParsedEducation:
    degree:          Optional[str] = None
    university:      Optional[str] = None
    graduation_year: Optional[int] = None
    field_of_study:  Optional[str] = None

@dataclass
class ParsedCandidate:
    # candidates table
    full_name:     Optional[str] = None
    email:         Optional[str] = None
    phone:         Optional[str] = None
    location:      Optional[str] = None
    linkedin_url:  Optional[str] = None
    portfolio_url: Optional[str] = None

    # professional_info table
    current_job_title:      Optional[str]   = None
    current_company:        Optional[str]   = None
    total_experience_years: Optional[float] = None

    # education table (list — one row per degree)
    educations: list = field(default_factory=list)   # list of ParsedEducation

    # candidate_skills (list of skill name strings)
    skills: list = field(default_factory=list)


# ─── Main parse function ──────────────────────────────────────────────────────

def parse_resume(resume_text: str) -> ParsedCandidate:
    """
    Parse resume text using LLM. Falls back to regex on failure.
    """
    if not settings.openai_api_key:
        logger.warning("No OpenAI API key — using regex fallback parser.")
        return _regex_fallback(resume_text)

    try:
        return _llm_parse(resume_text)
    except Exception as e:
        logger.error(f"LLM parse failed: {e}. Falling back to regex.")
        return _regex_fallback(resume_text)


def _llm_parse(resume_text: str) -> ParsedCandidate:
    prompt = f"""
You are a resume parsing engine. Extract structured information from the resume text below.

Return ONLY valid JSON matching this EXACT structure (no extra keys, null for missing fields):

{{
  "full_name": "<string | null>",
  "email": "<string | null>",
  "phone": "<string | null>",
  "location": "<city, state/country | null>",
  "linkedin_url": "<full URL | null>",
  "portfolio_url": "<github or portfolio URL | null>",

  "current_job_title": "<most recent job title | null>",
  "current_company": "<most recent employer | null>",
  "total_experience_years": <float — sum of all work experience, null if unclear>,

  "educations": [
    {{
      "degree": "<e.g. B.Tech, M.S., MBA | null>",
      "university": "<full institution name | null>",
      "graduation_year": <integer year | null>,
      "field_of_study": "<e.g. Computer Science | null>"
    }}
  ],

  "skills": [
    "<skill name>",
    "<skill name>"
  ]
}}

Rules:
- skills: list ONLY technical skills, tools, frameworks, languages, certifications
- skills: normalize names (e.g. "ReactJS" → "React", "node" → "Node.js")
- skills: max 30 skills, no soft skills like "teamwork" or "communication"
- total_experience_years: calculate from job date ranges, round to 1 decimal
- educations: include ALL degrees found, most recent first
- If a field is genuinely not present, use null — do not guess

Resume text:
\"\"\"
{resume_text[:6000]}
\"\"\"
"""

    response = client.chat.completions.create(
        model           = settings.llm_model,
        messages        = [{"role": "user", "content": prompt}],
        response_format = {"type": "json_object"},
        temperature     = 0.1,   # low temp for consistent extraction
    )

    raw = json.loads(response.choices[0].message.content)
    return _dict_to_parsed(raw)


def _dict_to_parsed(d: dict) -> ParsedCandidate:
    """Convert raw LLM JSON dict to typed ParsedCandidate."""
    educations = [
        ParsedEducation(
            degree          = e.get("degree"),
            university      = e.get("university"),
            graduation_year = _safe_int(e.get("graduation_year")),
            field_of_study  = e.get("field_of_study"),
        )
        for e in (d.get("educations") or [])
    ]

    return ParsedCandidate(
        full_name               = _clean_str(d.get("full_name")),
        email                   = _clean_str(d.get("email")),
        phone                   = _clean_str(d.get("phone")),
        location                = _clean_str(d.get("location")),
        linkedin_url            = _clean_str(d.get("linkedin_url")),
        portfolio_url           = _clean_str(d.get("portfolio_url")),
        current_job_title       = _clean_str(d.get("current_job_title")),
        current_company         = _clean_str(d.get("current_company")),
        total_experience_years  = _safe_float(d.get("total_experience_years")),
        educations              = educations,
        skills                  = [s.strip() for s in (d.get("skills") or []) if s and s.strip()],
    )


# ─── Regex fallback (no API key required) ─────────────────────────────────────

def _regex_fallback(text: str) -> ParsedCandidate:
    """
    Basic regex extraction for offline/no-key scenarios.
    Less accurate but ensures the pipeline never fully fails.
    """
    email = None
    m = re.search(r'[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}', text)
    if m:
        email = m.group()

    phone = None
    m = re.search(r'(\+?\d[\d\s\-().]{7,}\d)', text)
    if m:
        phone = m.group().strip()

    linkedin = None
    m = re.search(r'(https?://(?:www\.)?linkedin\.com/in/[\w-]+/?)', text, re.I)
    if m:
        linkedin = m.group()

    github = None
    m = re.search(r'(https?://github\.com/[\w-]+/?)', text, re.I)
    if m:
        github = m.group()

    # Very rough name extraction — first non-empty line
    first_line = next((l.strip() for l in text.splitlines() if l.strip()), None)
    name = first_line if first_line and len(first_line.split()) <= 5 else None

    return ParsedCandidate(
        full_name     = name,
        email         = email,
        phone         = phone,
        linkedin_url  = linkedin,
        portfolio_url = github,
        skills        = [],
        educations    = [],
    )


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _clean_str(v) -> Optional[str]:
    if v is None or str(v).lower() in ("null", "none", ""):
        return None
    return str(v).strip()

def _safe_int(v) -> Optional[int]:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None

def _safe_float(v) -> Optional[float]:
    try:
        return round(float(v), 1)
    except (TypeError, ValueError):
        return None
