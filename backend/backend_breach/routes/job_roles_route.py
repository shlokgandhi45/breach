"""
routes/job_roles_route.py

Endpoints for the "Required Job Roles" section in Settings > Job Roles.

The recruiter types a job role title (e.g. "Senior Frontend Engineer")
and saves it. These saved roles appear as clickable template chips just
below the search bar in the Candidates / AI Search view.
Clicking a chip pre-fills the search query and runs it immediately.

Endpoints:
  GET    /api/job-roles          — list all saved job roles (for search chips + settings page)
  POST   /api/job-roles          — create a new role template
  DELETE /api/job-roles/{role_id}— delete a role template
"""

import logging
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session

from models.schema import get_db, RequiredJobRole

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/job-roles", tags=["job-roles"])


# ── Request / Response models ─────────────────────────────────────────────────

class JobRoleCreate(BaseModel):
    role_title: str = Field(
        ...,
        min_length=2,
        max_length=500,
        description="Job role title e.g. 'Senior Frontend Engineer'"
    )
    created_by: Optional[str] = Field(
        None,
        description="Email of recruiter who created this (optional)"
    )

    @validator("role_title")
    def strip_and_validate(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Role title cannot be blank")
        return v


class JobRoleResponse(BaseModel):
    role_id:    str
    role_title: str
    created_by: Optional[str]
    created_at: Optional[str]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[JobRoleResponse])
async def list_job_roles(db: Session = Depends(get_db)):
    """
    Return all saved job role templates, ordered newest-first.
    Frontend calls this on:
      1. Settings > Job Roles page load (to populate the list)
      2. Search bar open (to populate the template chips)
    """
    try:
        roles = (
            db.query(RequiredJobRole)
            .order_by(RequiredJobRole.created_at.desc())
            .all()
        )
        return [
            JobRoleResponse(
                role_id    = str(r.role_id),
                role_title = r.role_title,
                created_by = r.created_by,
                created_at = r.created_at.isoformat() if r.created_at else None,
            )
            for r in roles
        ]
    except Exception as e:
        logger.error(f"Failed to fetch job roles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=JobRoleResponse, status_code=201)
async def create_job_role(req: JobRoleCreate, db: Session = Depends(get_db)):
    """
    Save a new required job role template.
    Prevents exact duplicates (case-insensitive).

    Example body:
      { "role_title": "Senior Frontend Engineer", "created_by": "priya@company.com" }
    """
    # Case-insensitive duplicate check
    existing = (
        db.query(RequiredJobRole)
        .filter(
            RequiredJobRole.role_title.ilike(req.role_title.strip())
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Role '{req.role_title}' already exists."
        )

    try:
        new_role = RequiredJobRole(
            role_id    = uuid.uuid4(),
            role_title = req.role_title.strip(),
            created_by = req.created_by,
        )
        db.add(new_role)
        db.commit()
        db.refresh(new_role)

        logger.info(f"Job role created: '{new_role.role_title}' by {new_role.created_by}")

        return JobRoleResponse(
            role_id    = str(new_role.role_id),
            role_title = new_role.role_title,
            created_by = new_role.created_by,
            created_at = new_role.created_at.isoformat() if new_role.created_at else None,
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create job role: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{role_id}", status_code=200)
async def delete_job_role(role_id: str, db: Session = Depends(get_db)):
    """
    Delete a saved job role template by its ID.
    Called when recruiter clicks the X button on a role in Settings.
    """
    try:
        role = (
            db.query(RequiredJobRole)
            .filter(RequiredJobRole.role_id == uuid.UUID(role_id))
            .first()
        )
        if not role:
            raise HTTPException(status_code=404, detail="Job role not found.")

        db.delete(role)
        db.commit()
        logger.info(f"Job role deleted: '{role.role_title}'")
        return {"success": True, "deleted_role": role.role_title}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete job role {role_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
