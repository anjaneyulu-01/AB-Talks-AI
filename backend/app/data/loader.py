"""Loads and validates the two source-of-truth datasets at import time.

Validation happens once, at startup, and loudly. If `curriculum.json` drifts
from the schema the engines expect, the process should refuse to start rather
than fail mysteriously on turn 6 of a live interview.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from app.core.logging import get_logger
from app.domain.models import Candidate, Curriculum

logger = get_logger(__name__)

DATA_DIR = Path(__file__).parent
CURRICULUM_PATH = DATA_DIR / "curriculum.json"
CANDIDATES_PATH = DATA_DIR / "candidates.json"


@lru_cache(maxsize=1)
def load_curriculum() -> Curriculum:
    raw = json.loads(CURRICULUM_PATH.read_text(encoding="utf-8"))
    curriculum = Curriculum.model_validate(raw)

    # Integrity check: every day must fall inside exactly one declared module.
    orphans = [d.day for d in curriculum.days if curriculum.module_for_day(d.day) is None]
    if orphans:
        raise ValueError(f"curriculum.json: days not covered by any module: {orphans}")

    logger.info(
        "curriculum_loaded",
        extra={"cohort": curriculum.cohort, "days": len(curriculum.days),
               "modules": len(curriculum.modules)},
    )
    return curriculum


@lru_cache(maxsize=1)
def load_candidates() -> list[Candidate]:
    raw = json.loads(CANDIDATES_PATH.read_text(encoding="utf-8"))
    candidates = [Candidate.model_validate(c) for c in raw["candidates"]]

    ids = [c.id for c in candidates]
    if len(set(ids)) != len(ids):
        raise ValueError("candidates.json: duplicate candidate ids")

    # Missions must reference real curriculum days, or the whole
    # evidence-grounding premise collapses silently.
    curriculum = load_curriculum()
    valid_days = {d.day for d in curriculum.days}
    for candidate in candidates:
        unknown = [m.day for m in candidate.missions if m.day not in valid_days]
        if unknown:
            logger.warning(
                "candidate_references_unknown_days",
                extra={"candidate": candidate.id, "days": unknown},
            )

    logger.info("candidates_loaded", extra={"count": len(candidates)})
    return candidates


@lru_cache(maxsize=1)
def _candidate_index() -> dict[str, Candidate]:
    return {c.id: c for c in load_candidates()}


def get_candidate(candidate_id: str) -> Candidate | None:
    return _candidate_index().get(candidate_id)


def warm_caches() -> None:
    """Called on startup so validation errors surface immediately."""
    load_curriculum()
    load_candidates()
