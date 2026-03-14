"""
models/schema.py
SQLAlchemy ORM models — exact match to the schema you defined.
Also handles pgvector VECTOR type for embeddings tables.

Run once to create tables:
  python -c "from models.schema import Base, engine; Base.metadata.create_all(engine)"
"""

from sqlalchemy import (
    create_engine, Column, String, Integer, Float,
    Text, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

try:
    from pgvector.sqlalchemy import Vector
    PGVECTOR_AVAILABLE = True
except ImportError:
    # Fallback: store as Text JSON if pgvector not installed
    Vector = None
    PGVECTOR_AVAILABLE = False

from config.settings import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,        # reconnects on stale connections (important for shared DB)
    pool_size=5,
    max_overflow=10,
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session, closes on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── candidates ────────────────────────────────────────────────────────────────

class Candidate(Base):
    __tablename__ = "candidates"

    candidate_id   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name      = Column(String(255), nullable=False)
    email          = Column(String(255), unique=True, nullable=False, index=True)
    phone          = Column(String(50))
    location       = Column(String(255))
    linkedin_url   = Column(String(500))
    portfolio_url  = Column(String(500))
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())
    pipeline_stage = Column(String(50), default='Applied', server_default='Applied')

    # ── DSU deduplication fields ──────────────────────────────────────────────
    # is_duplicate: marks records identified as duplicates by the DSU engine.
    # Hidden from all list/search views when True.
    # Using Boolean-as-String for SQLite/Postgres compatibility.
    is_duplicate        = Column(String(5), default='false', server_default='false', nullable=False)

    # master_candidate_id: the canonical record this duplicate maps to.
    # NULL for the master record itself and for non-duplicates.
    master_candidate_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # Audit timestamp for when the merge was recorded
    dedup_merged_at     = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    professional_info = relationship("ProfessionalInfo", back_populates="candidate",
                                     uselist=False, cascade="all, delete-orphan")
    educations        = relationship("Education",        back_populates="candidate",
                                     cascade="all, delete-orphan")
    resumes           = relationship("Resume",           back_populates="candidate",
                                     cascade="all, delete-orphan")
    candidate_skills  = relationship("CandidateSkill",  back_populates="candidate",
                                     cascade="all, delete-orphan")
    embedding         = relationship("ResumeEmbedding", back_populates="candidate",
                                     uselist=False, cascade="all, delete-orphan")


# ── professional_info ─────────────────────────────────────────────────────────

class ProfessionalInfo(Base):
    __tablename__ = "professional_info"

    professional_id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id           = Column(UUID(as_uuid=True), ForeignKey("candidates.candidate_id",
                                    ondelete="CASCADE"), nullable=False, index=True)
    current_job_title      = Column(String(255))
    current_company        = Column(String(255))
    total_experience_years = Column(Float)

    candidate = relationship("Candidate", back_populates="professional_info")


# ── education ─────────────────────────────────────────────────────────────────

class Education(Base):
    __tablename__ = "education"

    education_id     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id     = Column(UUID(as_uuid=True), ForeignKey("candidates.candidate_id",
                               ondelete="CASCADE"), nullable=False, index=True)
    degree           = Column(String(255))
    university       = Column(String(255))
    graduation_year  = Column(Integer)
    field_of_study   = Column(String(255))

    candidate = relationship("Candidate", back_populates="educations")


# ── resumes ───────────────────────────────────────────────────────────────────

class Resume(Base):
    __tablename__ = "resumes"

    resume_id       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id    = Column(UUID(as_uuid=True), ForeignKey("candidates.candidate_id",
                              ondelete="CASCADE"), nullable=False, index=True)
    resume_file_url = Column(String(1000))   # local path or s3:// URL
    resume_text     = Column(Text)           # full extracted text
    resume_source   = Column(String(100))    # "pdf_upload" | "linkedin" | "hrms" | "email"
    uploaded_at     = Column(DateTime(timezone=True), server_default=func.now())

    candidate = relationship("Candidate", back_populates="resumes")


# ── skills (master list) ──────────────────────────────────────────────────────

class Skill(Base):
    __tablename__ = "skills"

    skill_id   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skill_name = Column(String(255), unique=True, nullable=False, index=True)

    candidate_skills = relationship("CandidateSkill", back_populates="skill")


# ── candidate_skills (junction) ───────────────────────────────────────────────

class CandidateSkill(Base):
    __tablename__ = "candidate_skills"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.candidate_id",
                           ondelete="CASCADE"), nullable=False)
    skill_id     = Column(UUID(as_uuid=True), ForeignKey("skills.skill_id",
                           ondelete="CASCADE"), nullable=False)
    proficiency  = Column(String(50))   # "beginner" | "intermediate" | "expert" — bonus field

    __table_args__ = (
        UniqueConstraint("candidate_id", "skill_id", name="uq_candidate_skill"),
    )

    candidate = relationship("Candidate", back_populates="candidate_skills")
    skill     = relationship("Skill",     back_populates="candidate_skills")


# ── jobs ──────────────────────────────────────────────────────────────────────

class Job(Base):
    __tablename__ = "jobs"

    job_id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_title           = Column(String(255), nullable=False)
    company             = Column(String(255))
    job_description     = Column(Text)
    location            = Column(String(255))
    experience_required = Column(Float)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    embedding = relationship("JobEmbedding", back_populates="job",
                             uselist=False, cascade="all, delete-orphan")


# ── resume_embeddings ─────────────────────────────────────────────────────────

class ResumeEmbedding(Base):
    __tablename__ = "resume_embeddings"

    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.candidate_id",
                           ondelete="CASCADE"), primary_key=True)

    if PGVECTOR_AVAILABLE and Vector:
        embedding = Column(Vector(384))
    else:
        embedding = Column(Text)  # fallback: JSON string of float list

    candidate = relationship("Candidate", back_populates="embedding")


# ── job_embeddings ────────────────────────────────────────────────────────────

class JobEmbedding(Base):
    __tablename__ = "job_embeddings"

    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.job_id",
                    ondelete="CASCADE"), primary_key=True)

    if PGVECTOR_AVAILABLE and Vector:
        embedding = Column(Vector(384))
    else:
        embedding = Column(Text)

    job = relationship("Job", back_populates="embedding")


# ── required_job_roles ────────────────────────────────────────────────────────
# Stores the recruiter's saved job role templates shown in the search bar.
# Each row is one template (e.g. "Senior Frontend Engineer").
# Displayed as quick-select chips below the search input.

class RequiredJobRole(Base):
    __tablename__ = "required_job_roles"

    role_id    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_title = Column(String(500), nullable=False)          # e.g. "Senior Frontend Engineer"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Optional: who created it (for future multi-user support)
    created_by = Column(String(255), nullable=True)           # e.g. "priya@company.com"
