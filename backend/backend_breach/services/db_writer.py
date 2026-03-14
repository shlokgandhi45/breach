"""
services/db_writer.py

Atomically writes one parsed resume into all relevant tables:
  candidates → professional_info → education[] → resumes
            → candidate_skills (upsert to skills master list)
            → resume_embeddings

Key design decisions:
  1. Idempotent on email — if candidate already exists, UPDATE don't INSERT
     This makes bulk_ingest safe to re-run without duplicates
  2. Skills are upserted into the master `skills` table first,
     then linked via candidate_skills (handles duplicates gracefully)
  3. Everything in one transaction — either all tables written or none
"""

import json
import logging
from typing import Optional
from sqlalchemy.orm import Session


from models.schema import (
    Candidate, ProfessionalInfo, Education,
    Resume, Skill, CandidateSkill, ResumeEmbedding
)
from services.llm_parser import ParsedCandidate
from services.embedder import get_embedding, serialize_embedding
from models.schema import PGVECTOR_AVAILABLE

logger = logging.getLogger(__name__)


def write_candidate(
    db:            Session,
    parsed:        ParsedCandidate,
    resume_text:   str,
    file_url:      str,
    resume_source: str = "pdf_upload",
) -> Candidate:
    """
    Main entry point. Writes all tables atomically.
    Returns the Candidate ORM object.

    If a candidate with the same email already exists:
    - Updates their profile fields
    - Appends the new resume
    - Merges new skills (doesn't remove existing ones)
    """
    try:
        candidate = _upsert_candidate(db, parsed)
        _upsert_professional_info(db, candidate, parsed)
        _insert_educations(db, candidate, parsed)
        _insert_resume(db, candidate, resume_text, file_url, resume_source)
        _upsert_skills(db, candidate, parsed.skills)
        _upsert_embedding(db, candidate, resume_text)

        db.commit()
        db.refresh(candidate)
        logger.info(f"Written candidate: {candidate.full_name} ({candidate.email})")
        return candidate

    except Exception as e:
        db.rollback()
        logger.error(f"DB write failed for {parsed.email}: {e}")
        raise


# ─── Per-table writers ────────────────────────────────────────────────────────

def _upsert_candidate(db: Session, parsed: ParsedCandidate) -> Candidate:
    """Insert or update the candidates row."""
    if not parsed.email:
        # No email = can't deduplicate — always insert as new
        candidate = Candidate(
            full_name     = parsed.full_name or "Unknown",
            email         = f"unknown_{_random_suffix()}@noemail.local",
            phone         = parsed.phone,
            location      = parsed.location,
            linkedin_url  = parsed.linkedin_url,
            portfolio_url = parsed.portfolio_url,
        )
        db.add(candidate)
        db.flush()
        return candidate

    existing = db.query(Candidate).filter_by(email=parsed.email).first()

    if existing:
        # Update fields only if new value is not null
        if parsed.full_name:     existing.full_name     = parsed.full_name
        if parsed.phone:         existing.phone         = parsed.phone
        if parsed.location:      existing.location      = parsed.location
        if parsed.linkedin_url:  existing.linkedin_url  = parsed.linkedin_url
        if parsed.portfolio_url: existing.portfolio_url = parsed.portfolio_url
        db.flush()
        return existing

    candidate = Candidate(
        full_name     = parsed.full_name or "Unknown",
        email         = parsed.email,
        phone         = parsed.phone,
        location      = parsed.location,
        linkedin_url  = parsed.linkedin_url,
        portfolio_url = parsed.portfolio_url,
    )
    db.add(candidate)
    db.flush()   # flush to get candidate_id before child inserts
    return candidate


def _upsert_professional_info(db: Session, candidate: Candidate, parsed: ParsedCandidate):
    existing = db.query(ProfessionalInfo).filter_by(
        candidate_id=candidate.candidate_id
    ).first()

    if existing:
        if parsed.current_job_title:      existing.current_job_title      = parsed.current_job_title
        if parsed.current_company:        existing.current_company        = parsed.current_company
        if parsed.total_experience_years: existing.total_experience_years = parsed.total_experience_years
    else:
        prof = ProfessionalInfo(
            candidate_id           = candidate.candidate_id,
            current_job_title      = parsed.current_job_title,
            current_company        = parsed.current_company,
            total_experience_years = parsed.total_experience_years,
        )
        db.add(prof)
    db.flush()


def _insert_educations(db: Session, candidate: Candidate, parsed: ParsedCandidate):
    """Insert education rows. Skips if same degree+university already exists."""
    for edu in parsed.educations:
        existing = db.query(Education).filter_by(
            candidate_id = candidate.candidate_id,
            degree       = edu.degree,
            university   = edu.university,
        ).first()

        if not existing:
            db.add(Education(
                candidate_id    = candidate.candidate_id,
                degree          = edu.degree,
                university      = edu.university,
                graduation_year = edu.graduation_year,
                field_of_study  = edu.field_of_study,
            ))
    db.flush()


def _insert_resume(
    db: Session, candidate: Candidate,
    resume_text: str, file_url: str, source: str
):
    """Always insert a new resume row (a candidate can have multiple resumes)."""
    db.add(Resume(
        candidate_id    = candidate.candidate_id,
        resume_file_url = file_url,
        resume_text     = resume_text,
        resume_source   = source,
    ))
    db.flush()


def _upsert_skills(db: Session, candidate: Candidate, skill_names: list):
    """
    For each skill name:
      1. Upsert into master `skills` table (get or create by name)
      2. Link to candidate via candidate_skills (skip if already linked)
    """
    for skill_name in skill_names:
        if not skill_name:
            continue

        # Get or create skill in master list
        skill = db.query(Skill).filter(
            Skill.skill_name.ilike(skill_name)
        ).first()

        if not skill:
            skill = Skill(skill_name=skill_name)
            db.add(skill)
            db.flush()

        # Link to candidate if not already linked
        existing_link = db.query(CandidateSkill).filter_by(
            candidate_id = candidate.candidate_id,
            skill_id     = skill.skill_id,
        ).first()

        if not existing_link:
            db.add(CandidateSkill(
                candidate_id = candidate.candidate_id,
                skill_id     = skill.skill_id,
            ))

    db.flush()


def _upsert_embedding(db: Session, candidate: Candidate, resume_text: str):
    """Generate and store/update the candidate's resume embedding."""
    try:
        vector = get_embedding(resume_text)

        existing = db.query(ResumeEmbedding).filter_by(
            candidate_id=candidate.candidate_id
        ).first()

        if existing:
            if PGVECTOR_AVAILABLE:
                existing.embedding = vector
            else:
                existing.embedding = serialize_embedding(vector)
        else:
            emb = ResumeEmbedding(candidate_id=candidate.candidate_id)
            emb.embedding = vector if PGVECTOR_AVAILABLE else serialize_embedding(vector)
            db.add(emb)

        db.flush()

    except Exception as e:
        logger.warning(f"Embedding generation failed (non-fatal): {e}")


def _random_suffix() -> str:
    import uuid
    return str(uuid.uuid4())[:8]
