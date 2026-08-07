"""Curriculum endpoints.

The frontend renders the roadmap and topic chips from these, so the curriculum
stays a single source of truth end to end -- no duplicated day titles living in
a TypeScript constant somewhere, drifting quietly out of sync.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.schemas import CurriculumDayOut
from app.core.errors import AppError
from app.data.loader import load_curriculum

router = APIRouter(prefix="/curriculum", tags=["curriculum"])


@router.get("", summary="Full cohort curriculum")
async def curriculum() -> dict:
    data = load_curriculum()
    return {
        "cohort": data.cohort,
        "modules": [
            {
                "n": m.n,
                "title": m.title,
                "day_start": m.day_start,
                "day_end": m.day_end,
                "day_count": m.day_end - m.day_start + 1,
            }
            for m in data.modules
        ],
        "days": [
            CurriculumDayOut(
                day=d.day,
                title=d.title,
                type=d.type,
                module=(data.module_for_day(d.day).title if data.module_for_day(d.day) else ""),
                tools=d.tools,
                objectives=d.objectives,
            ).model_dump()
            for d in data.days
        ],
    }


@router.get("/{day}", response_model=CurriculumDayOut, summary="One curriculum day")
async def curriculum_day(day: int) -> CurriculumDayOut:
    data = load_curriculum()
    found = data.day_by_number(day)
    if found is None:
        raise AppError(f"No curriculum day {day}.", details={"valid_range": "1-31"})

    module = data.module_for_day(day)
    return CurriculumDayOut(
        day=found.day,
        title=found.title,
        type=found.type,
        module=module.title if module else "",
        tools=found.tools,
        objectives=found.objectives,
    )
