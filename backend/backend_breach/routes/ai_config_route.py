"""
routes/ai_config_route.py

Two endpoints for the "AI Configuration" panel on the frontend:

  GET  /api/ai-config        — fetch current weights (on page load)
  POST /api/ai-config        — save new weights from sliders
  POST /api/ai-config/reset  — reset to defaults

The frontend slider panel sends the four weights. This route
validates them, normalises if total > 100, stores them in the
in-memory AIConfigStore, and returns the final applied values
so the frontend can update the slider display accordingly.
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator

from services.ai_config import ai_config

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai-config", tags=["ai-config"])


# ── Request / Response models ─────────────────────────────────────────────────

class AIConfigRequest(BaseModel):
    skill_weight:       float = Field(..., ge=0, le=100, description="Skill match weight (0-100)")
    experience_weight:  float = Field(..., ge=0, le=100, description="Experience match weight (0-100)")
    culture_fit_weight: float = Field(..., ge=0, le=100, description="Culture fit / RAG confidence weight (0-100)")
    education_weight:   float = Field(..., ge=0, le=100, description="Education weight (0-100)")

    @validator("skill_weight", "experience_weight", "culture_fit_weight", "education_weight")
    def must_be_non_negative(cls, v):
        if v < 0:
            raise ValueError("Weight must be >= 0")
        return round(float(v), 2)


class AIConfigResponse(BaseModel):
    skill_weight:       float
    experience_weight:  float
    culture_fit_weight: float
    education_weight:   float
    total:              float
    normalised:         bool    # True if weights were scaled down from > 100
    message:            str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=AIConfigResponse)
async def get_ai_config():
    """
    Return the current AI scoring weights.
    Call this on dashboard load to initialise the sliders.
    """
    data = ai_config.as_dict()
    return AIConfigResponse(
        **data,
        normalised = False,
        message    = "Current AI configuration weights."
    )


@router.post("", response_model=AIConfigResponse)
async def save_ai_config(req: AIConfigRequest):
    """
    Save new AI scoring weights from the frontend slider panel.

    If the four weights sum to more than 100, they are automatically
    normalised proportionally so they sum to exactly 100. The response
    includes the final stored values and a normalised=True flag so
    the frontend can update the sliders to reflect the adjustment.

    Example:
      Input:  skill=60, exp=50, culture=30, edu=20  (total=160)
      Stored: skill=37.5, exp=31.25, culture=18.75, edu=12.5 (total=100)
    """
    raw_total = (
        req.skill_weight + req.experience_weight +
        req.culture_fit_weight + req.education_weight
    )

    try:
        stored = ai_config.set_weights(
            skill_weight       = req.skill_weight,
            experience_weight  = req.experience_weight,
            culture_fit_weight = req.culture_fit_weight,
            education_weight   = req.education_weight,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    normalised = raw_total > 100.0
    data = ai_config.as_dict()

    message = (
        f"Weights normalised from {raw_total:.1f}% to 100% proportionally."
        if normalised else
        f"Weights saved. Total: {data['total']}%."
    )

    return AIConfigResponse(
        **data,
        normalised = normalised,
        message    = message,
    )


@router.post("/reset", response_model=AIConfigResponse)
async def reset_ai_config():
    """
    Reset weights to default values:
    skill=40%, experience=30%, culture_fit=20%, education=10%
    """
    ai_config.set_weights(
        skill_weight       = 40.0,
        experience_weight  = 30.0,
        culture_fit_weight = 20.0,
        education_weight   = 10.0,
    )
    data = ai_config.as_dict()
    return AIConfigResponse(
        **data,
        normalised = False,
        message    = "Weights reset to defaults."
    )
