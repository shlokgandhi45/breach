"""
services/response_adapter.py

Transforms raw DB candidate data into the frontend-expected JSON shape.
This is the single source of truth for the backend → frontend field mapping.

Used by: candidates_route, dashboard_route, pipeline_route
"""

import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy.orm import Session
from models.schema import (
    Candidate, ProfessionalInfo, Education, Resume,
    CandidateSkill, Skill
)

logger = logging.getLogger(__name__)

# Deterministic avatar color palette — assigned by hashing the candidate name
AVATAR_COLORS = [
    'bg-violet-100 text-violet-700',
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-cyan-100 text-cyan-700',
    'bg-amber-100 text-amber-700',
    'bg-indigo-100 text-indigo-700',
    'bg-rose-100 text-rose-700',
    'bg-teal-100 text-teal-700',
]

# Map backend resume_source values to frontend display names
SOURCE_MAP = {
    'pdf_upload': 'Upload',
    'linkedin':   'LinkedIn',
    'email':      'Email',
    'hrms':       'HRMS',
}


def get_initials(name: str) -> str:
    """'Aisha Patel' → 'AP'"""
    if not name:
        return '??'
    parts = name.strip().split()
    return ''.join(p[0].upper() for p in parts[:2]) if parts else '??'


def get_color(name: str) -> str:
    """Deterministic color from the candidate name."""
    if not name:
        return AVATAR_COLORS[0]
    idx = int(hashlib.md5(name.encode()).hexdigest(), 16) % len(AVATAR_COLORS)
    return AVATAR_COLORS[idx]


def format_date(dt: Optional[datetime]) -> Optional[str]:
    """datetime → 'Mar 8, 2025' (cross-platform)"""
    if not dt:
        return None
    try:
        # Use %d and strip leading zero for cross-platform compat
        raw = dt.strftime('%b %d, %Y')
        # Remove leading zero from day: "Mar 08, 2025" → "Mar 8, 2025"
        parts = raw.split(' ')
        if len(parts) == 3:
            parts[1] = str(int(parts[1].rstrip(','))) + ','
            return ' '.join(parts)
        return raw
    except Exception:
        return str(dt)


def relative_time(dt: Optional[datetime]) -> str:
    """datetime → '2 hours ago' / '3 days ago' / 'Just now'"""
    if not dt:
        return 'Unknown'
    try:
        now = datetime.now(timezone.utc)
        if dt.tzinfo is None:
            # Assume UTC if naive
            from datetime import timezone as tz
            dt = dt.replace(tzinfo=tz.utc)
        diff = now - dt
        seconds = int(diff.total_seconds())
        if seconds < 60:
            return 'Just now'
        if seconds < 3600:
            m = seconds // 60
            return f'{m} minute{"s" if m != 1 else ""} ago'
        if seconds < 86400:
            h = seconds // 3600
            return f'{h} hour{"s" if h != 1 else ""} ago'
        d = seconds // 86400
        if d == 1:
            return '1 day ago'
        return f'{d} days ago'
    except Exception:
        return 'Unknown'


def adapt_candidate(
    candidate: Candidate,
    db: Session,
) -> dict:
    """
    Transform a single Candidate ORM object + related data into the
    frontend-expected JSON shape.
    """
    # Fetch related data
    prof = db.query(ProfessionalInfo).filter_by(
        candidate_id=candidate.candidate_id
    ).first()

    edu = (
        db.query(Education)
        .filter_by(candidate_id=candidate.candidate_id)
        .order_by(Education.graduation_year.desc())
        .first()
    )

    latest_resume = (
        db.query(Resume)
        .filter_by(candidate_id=candidate.candidate_id)
        .order_by(Resume.uploaded_at.desc())
        .first()
    )

    skills = (
        db.query(Skill.skill_name)
        .join(CandidateSkill, Skill.skill_id == CandidateSkill.skill_id)
        .filter(CandidateSkill.candidate_id == candidate.candidate_id)
        .all()
    )
    skill_names = [s.skill_name for s in skills]

    # Determine resume source display name
    resume_source_raw = latest_resume.resume_source if latest_resume else 'pdf_upload'
    source_display = SOURCE_MAP.get(resume_source_raw, resume_source_raw or 'Upload')

    # Build education string
    education_str = None
    if edu:
        parts = [edu.degree, edu.university]
        education_str = ', '.join(p for p in parts if p)

    # Experience years as integer
    exp_years = None
    if prof and prof.total_experience_years is not None:
        exp_years = int(prof.total_experience_years)

    name = candidate.full_name or 'Unknown'

    return {
        # Core identity
        'id':               str(candidate.candidate_id),
        'name':             name,
        'initials':         get_initials(name),
        'color':            get_color(name),

        # Professional info
        'role':             prof.current_job_title if prof else None,
        'currentCompany':   prof.current_company if prof else None,
        'previousCompanies': [],   # Not in DB — future extension

        # Contact & location
        'location':         candidate.location,
        'email':            candidate.email,
        'phone':            candidate.phone,
        'linkedinUrl':      candidate.linkedin_url,
        'portfolioUrl':     candidate.portfolio_url,

        # Experience
        'experienceYears':  exp_years,

        # Match & pipeline
        'matchScore':       0,     # Only set by search endpoint
        'status':           candidate.pipeline_stage or 'Applied',
        'source':           source_display,

        # Skills & education
        'skills':           skill_names,
        'education':        education_str,

        # Compensation (not in DB)
        'salary':           None,
        'noticePeriod':     None,

        # Timestamps
        'appliedDate':      format_date(candidate.created_at),
        'lastActivity':     relative_time(candidate.updated_at or candidate.created_at),

        # AI summary (populated when search/intelligence provides it)
        'summary':          None,

        # Frontend display extras
        'tags':             [],
        'timeline':         [
            {
                'type': 'apply',
                'event': f'Applied via {source_display}',
                'date': format_date(candidate.created_at),
            }
        ],

        # Resume
        'resumeUrl':        latest_resume.resume_file_url if latest_resume else None,
    }


def adapt_candidate_list(
    candidates: List[Candidate],
    db: Session,
) -> List[dict]:
    """Batch-adapt a list of candidates."""
    return [adapt_candidate(c, db) for c in candidates]
