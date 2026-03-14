"""
services/ai_config.py

In-memory singleton that holds the AI scoring weights shown in the
"AI Configuration" panel on the frontend.

Four weights:
  skill_weight       — how much skill match contributes to final score
  experience_weight  — how much experience match contributes
  culture_fit_weight — how much RAG confidence contributes
  education_weight   — how much education signal contributes

NORMALISATION RULE:
  If the recruiter sets weights that sum > 100, each weight is scaled
  down proportionally so they always sum to exactly 100.
  e.g. skill=60, exp=50, culture=30, edu=20 → total=160
       normalised: skill=37.5, exp=31.25, culture=18.75, edu=12.5

WHY IN-MEMORY (not DB):
  Weights are a session-level preference, not persistent data.
  Any recruiter changing the sliders affects the current scoring
  immediately without a DB round-trip.
  For multi-user production, swap this singleton for a per-user
  DB-backed config — the interface stays identical.
"""

import logging
from dataclasses import dataclass
from threading import Lock

logger = logging.getLogger(__name__)


@dataclass
class AIWeights:
    skill_weight:       float = 40.0   # maps to the 45% RRF/skill component
    experience_weight:  float = 30.0   # maps to the 15% experience component
    culture_fit_weight: float = 20.0   # maps to the 10% RAG confidence component
    education_weight:   float = 10.0   # bonus applied to education matches


class AIConfigStore:
    """
    Thread-safe singleton holding the current AI scoring weights.
    All reads and writes go through get_weights() / set_weights().
    """

    def __init__(self):
        self._weights = AIWeights()
        self._lock    = Lock()

    def get_weights(self) -> AIWeights:
        """Return a copy of the current weights (always normalised to 100)."""
        with self._lock:
            return AIWeights(
                skill_weight       = self._weights.skill_weight,
                experience_weight  = self._weights.experience_weight,
                culture_fit_weight = self._weights.culture_fit_weight,
                education_weight   = self._weights.education_weight,
            )

    def set_weights(
        self,
        skill_weight:       float,
        experience_weight:  float,
        culture_fit_weight: float,
        education_weight:   float,
    ) -> AIWeights:
        """
        Validate, normalise, and store new weights.

        Rules:
          1. Each weight must be >= 0
          2. Total must be > 0 (can't all be zero)
          3. If total > 100 → normalise proportionally to sum to 100
          4. If total < 100 → keep as-is (scores just won't reach 100%)
          5. If total == 100 → store exactly

        Returns the final stored weights (post-normalisation).
        """
        weights = {
            "skill":       max(0.0, float(skill_weight)),
            "experience":  max(0.0, float(experience_weight)),
            "culture_fit": max(0.0, float(culture_fit_weight)),
            "education":   max(0.0, float(education_weight)),
        }

        total = sum(weights.values())

        if total == 0:
            raise ValueError(
                "All weights are zero. At least one weight must be greater than 0."
            )

        # Normalise down if total exceeds 100
        if total > 100:
            logger.info(
                f"Weights sum to {total:.1f} > 100. "
                f"Normalising proportionally to 100."
            )
            factor = 100.0 / total
            weights = {k: round(v * factor, 2) for k, v in weights.items()}

            # Fix floating-point rounding drift — adjust skill (largest) to make exact sum
            current_sum = sum(weights.values())
            diff = round(100.0 - current_sum, 2)
            weights["skill"] = round(weights["skill"] + diff, 2)

        with self._lock:
            self._weights = AIWeights(
                skill_weight       = weights["skill"],
                experience_weight  = weights["experience"],
                culture_fit_weight = weights["culture_fit"],
                education_weight   = weights["education"],
            )
            logger.info(
                f"AI weights updated → skill={weights['skill']}% "
                f"exp={weights['experience']}% "
                f"culture={weights['culture_fit']}% "
                f"edu={weights['education']}% "
                f"(total={sum(weights.values()):.1f}%)"
            )

        return self.get_weights()

    def as_dict(self) -> dict:
        """Return current weights as a plain dict (for API responses)."""
        w = self.get_weights()
        total = w.skill_weight + w.experience_weight + w.culture_fit_weight + w.education_weight
        return {
            "skill_weight":       w.skill_weight,
            "experience_weight":  w.experience_weight,
            "culture_fit_weight": w.culture_fit_weight,
            "education_weight":   w.education_weight,
            "total":              round(total, 2),
        }


# ── Module-level singleton — imported everywhere ──────────────────────────────
ai_config = AIConfigStore()
