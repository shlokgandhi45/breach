"""
services/dsu/similarity.py

Scores two candidate records 0.0 → 1.0 for identity similarity.

TIER 1 — Exact match (returns 1.0 immediately):
  Same normalised email OR same normalised phone → same person, done.

TIER 2 — Weighted fuzzy match:
  40% Levenshtein name ratio
  35% Jaccard skill overlap
  15% Gaussian experience proximity (sigma = 2 years)
  10% Location string match

Threshold: score >= 0.85 → DSU union()
"""

import re
import math
from typing import Optional, Set


# ── Levenshtein ──────────────────────────────────────────────────────────────

def _levenshtein(s1: str, s2: str) -> int:
    if s1 == s2: return 0
    if not s1: return len(s2)
    if not s2: return len(s1)
    if len(s1) < len(s2): s1, s2 = s2, s1
    prev = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1, 1):
        curr = [i]
        for j, c2 in enumerate(s2, 1):
            curr.append(min(prev[j] + 1, curr[-1] + 1, prev[j-1] + (0 if c1 == c2 else 1)))
        prev = curr
    return prev[-1]


def levenshtein_ratio(s1: str, s2: str) -> float:
    if not s1 and not s2: return 1.0
    if not s1 or  not s2: return 0.0
    s1, s2 = s1.lower().strip(), s2.lower().strip()
    if s1 == s2: return 1.0
    d = _levenshtein(s1, s2)
    return round(1.0 - d / max(len(s1), len(s2)), 4)


# ── Jaccard ──────────────────────────────────────────────────────────────────

def jaccard(a: Set[str], b: Set[str]) -> float:
    if not a or not b: return 0.0
    i = len(a & b); u = len(a | b)
    return i / u if u else 0.0


# ── Experience proximity ─────────────────────────────────────────────────────

def experience_proximity(ea: Optional[float], eb: Optional[float]) -> float:
    if ea is None or eb is None: return 0.5
    return round(math.exp(-((float(ea) - float(eb)) ** 2) / (2 * 4.0)), 4)


# ── Location match ───────────────────────────────────────────────────────────

def location_match(la: Optional[str], lb: Optional[str]) -> float:
    if not la or not lb: return 0.5
    a, b = la.lower().strip(), lb.lower().strip()
    if a == b: return 1.0
    if a in b or b in a: return 0.5
    return 0.0


# ── Normalise contacts ───────────────────────────────────────────────────────

def _norm_phone(p: Optional[str]) -> Optional[str]:
    if not p: return None
    d = re.sub(r'\D', '', p)
    return d[-10:] if len(d) >= 10 else (d or None)

def _norm_email(e: Optional[str]) -> Optional[str]:
    if not e: return None
    e = e.lower().strip()
    return None if e.endswith('@noemail.local') else e


# ── MAIN SCORING FUNCTION ────────────────────────────────────────────────────

UNION_THRESHOLD = 0.65

def calculate_similarity(a: dict, b: dict) -> float:
    """
    Compare two candidate dicts. Returns confidence score 0.0 → 1.0.

    Expected keys (all optional except candidate_id):
      full_name, email, phone, location,
      total_experience_years, skills (set or list of str)
    """
    # TIER 1 — exact contact anchor
    ea, eb = _norm_email(a.get('email')), _norm_email(b.get('email'))
    if ea and eb and ea == eb:
        return 1.0

    pa, pb = _norm_phone(a.get('phone')), _norm_phone(b.get('phone'))
    if pa and pb and pa == pb:
        return 1.0

    # TIER 2 — fuzzy weighted blend
    name_score  = levenshtein_ratio(a.get('full_name', ''), b.get('full_name', ''))
    skills_a    = {s.lower().strip() for s in (a.get('skills') or [])}
    skills_b    = {s.lower().strip() for s in (b.get('skills') or [])}
    skill_score = jaccard(skills_a, skills_b)
    exp_score   = experience_proximity(
        a.get('total_experience_years'), b.get('total_experience_years')
    )
    loc_score   = location_match(a.get('location'), b.get('location'))

    return round(
        0.40 * name_score +
        0.35 * skill_score +
        0.15 * exp_score  +
        0.10 * loc_score,
        4
    )
