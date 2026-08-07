"""Candidate and dashboard endpoints.

The profile endpoint is worth a note: it runs the full profiler and returns the
interview strategy *before* any interview happens. That powers the dashboard's
"here's how your interview will be calibrated" panel, which is one of the
strongest anxiety-reducing moments in the product -- the candidate sees the
system has actually read their record, and sees that skipped material is off
the table, before they commit to starting.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import serialize_plan, serialize_profile
from app.api.schemas import CandidateListItem, ProfileSummary
from app.core.config import settings
from app.core.errors import CandidateNotFoundError
from app.data.loader import get_candidate, load_candidates, load_curriculum
from app.db.repositories import get_repositories
from app.domain.enums import EvidenceStrength
from app.domain.models import InterviewPlan, InterviewSession
from app.engine.planner import build_plan
from app.engine.profiler import build_profile

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.get("", response_model=list[CandidateListItem], summary="List cohort candidates")
async def list_candidates() -> list[CandidateListItem]:
    curriculum = load_curriculum()
    out: list[CandidateListItem] = []

    for candidate in load_candidates():
        profile = build_profile(candidate, curriculum)
        out.append(
            CandidateListItem(
                id=candidate.id,
                name=candidate.name,
                job_role=candidate.member.jobRole,
                years_experience=candidate.member.yearsExperience,
                education=candidate.member.education,
                seniority_band=profile.seniority_band,
                headline=profile.headline,
                coverage=profile.coverage,
                fluency=profile.fluency,
                consistency=profile.consistency,
                missions_completed=candidate.signals.missionsCompleted,
                skipped_count=len(profile.skipped_days),
                eligible_topics=len(profile.questionable_topics),
            )
        )
    return out


@router.get("/{candidate_id}/profile", summary="Evidence profile and interview strategy")
async def candidate_profile(candidate_id: str) -> dict:
    candidate = get_candidate(candidate_id)
    if candidate is None:
        raise CandidateNotFoundError(f"No candidate with id {candidate_id!r}.")

    curriculum = load_curriculum()
    profile = build_profile(candidate, curriculum)
    plan = build_plan(
        profile,
        min_turns=settings.interview_min_turns,
        max_turns=settings.interview_max_turns,
    )

    # Reuse the session serialiser so the shape matches exactly what the
    # interview screen will later receive -- one component renders both.
    stub = InterviewSession(
        session_id="preview",
        candidate=candidate,
        profile=profile,
        plan=plan,
    )

    return {
        "candidate": candidate.model_dump(mode="json"),
        "profile": serialize_profile(profile).model_dump(),
        "planned_probes": [p.model_dump() for p in serialize_plan(stub)],
        "evidence": [
            {
                "day": topic.day,
                "title": topic.title,
                "module": topic.module_title,
                "type": topic.day_type,
                "strength": topic.strength.value,
                "attempts": topic.attempts,
                "passed": topic.passed,
                "eligible": topic.is_questionable,
            }
            for topic in profile.topics
        ],
        "distribution": {
            strength.value: sum(1 for t in profile.topics if t.strength == strength)
            for strength in EvidenceStrength
        },
    }


@router.get("/{candidate_id}/history", summary="Past interviews and reports")
async def candidate_history(
    candidate_id: str,
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    if get_candidate(candidate_id) is None:
        raise CandidateNotFoundError(f"No candidate with id {candidate_id!r}.")

    repos = get_repositories()
    reports = await repos.reports.list_for_candidate(candidate_id, limit=limit)
    sessions = await repos.sessions.list_for_candidate(candidate_id, limit=limit)

    trend = [
        {
            "session_id": r.session_id,
            "date": r.generated_at.isoformat(),
            "overall": r.overall_score,
            "recommendation": r.recommendation.value,
            "turns": r.turns_taken,
            "breakdown": {b.competency.value: b.score for b in r.breakdown},
        }
        for r in reversed(reports)
    ]

    return {
        "candidate_id": candidate_id,
        "total_interviews": len(sessions),
        "completed": sum(1 for s in sessions if s.is_complete),
        "best_score": max((r.overall_score for r in reports), default=None),
        "latest_score": reports[0].overall_score if reports else None,
        "trend": trend,
        "sessions": [
            {
                "session_id": s.session_id,
                "status": s.status.value,
                "created_at": s.created_at.isoformat(),
                "turns": s.answered_turns,
                "planned_turns": s.plan.target_turns,
                "overall": s.report.overall_score if s.report else None,
                "topics": sorted(set(s.consumed_days)),
            }
            for s in sessions
        ],
    }
