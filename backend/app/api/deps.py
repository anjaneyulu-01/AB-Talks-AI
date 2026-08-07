"""Shared dependencies and domain-to-API serialisation.

Serialisation lives here rather than on the models so the domain layer stays
free of transport concerns -- the engines should not know an HTTP client
exists.
"""

from __future__ import annotations

from typing import Any

from app.api.schemas import (
    CandidateTurn,
    InterviewerTurn,
    PlannedProbe,
    ProfileSummary,
)
from app.db.repositories import get_repositories
from app.domain.enums import Role
from app.domain.models import EvidenceProfile, InterviewSession, Message
from app.engine.interview_service import InterviewService


def get_service() -> InterviewService:
    return InterviewService(repositories=get_repositories())


def serialize_profile(profile: EvidenceProfile) -> ProfileSummary:
    return ProfileSummary(
        candidate_id=profile.candidate_id,
        candidate_name=profile.candidate_name,
        job_role=profile.job_role,
        years_experience=profile.years_experience,
        education=profile.education,
        seniority_band=profile.seniority_band,
        headline=profile.headline,
        consistency=profile.consistency,
        fluency=profile.fluency,
        coverage=profile.coverage,
        baseline_difficulty=profile.baseline_difficulty.value,
        mastered_days=profile.mastered_days,
        struggled_days=profile.struggled_days,
        failed_days=profile.failed_days,
        skipped_days=profile.skipped_days,
        strategy_notes=profile.strategy_notes,
    )


def serialize_plan(session: InterviewSession) -> list[PlannedProbe]:
    return [
        PlannedProbe(
            index=p.index,
            day=p.day,
            day_title=p.day_title,
            module_title=p.module_title,
            competency=p.competency.value,
            difficulty=p.difficulty.value,
            difficulty_label=p.difficulty.label,
            evidence=p.evidence.value,
            rationale=p.rationale,
        )
        for p in session.plan.probes
    ]


def serialize_interviewer_turn(message: Message) -> InterviewerTurn:
    return InterviewerTurn(
        id=message.id,
        content=message.content,
        turn_index=message.turn_index,
        day=message.day,
        day_title=message.day_title,
        module_title=message.module_title,
        competency=message.competency.value if message.competency else None,
        difficulty=message.difficulty.value if message.difficulty else None,
        difficulty_label=message.difficulty.label if message.difficulty else None,
        action=message.action.value if message.action else None,
        reason=message.reason,
        provider=message.provider.value if message.provider else None,
        latency_ms=message.latency_ms,
    )


def serialize_candidate_turn(message: Message) -> CandidateTurn:
    evaluation = message.evaluation
    return CandidateTurn(
        id=message.id,
        content=message.content,
        turn_index=message.turn_index,
        score=int(round(evaluation.overall)) if evaluation else None,
        covered_points=evaluation.covered_points if evaluation else [],
        missing_points=evaluation.missing_points if evaluation else [],
        flagged=message.flagged,
    )


def serialize_messages(session: InterviewSession) -> list[dict[str, Any]]:
    """Full transcript for replay.

    Deliberately omits raw evaluator internals (`notes`, `misconceptions`) from
    the candidate-facing transcript. Those exist for the report and for us --
    surfacing "the model thinks you have a misconception" live, mid-interview,
    would spike anxiety for no benefit.
    """
    out: list[dict[str, Any]] = []
    for message in session.messages:
        if message.role == Role.INTERVIEWER:
            out.append({"role": "interviewer", **serialize_interviewer_turn(message).model_dump()})
        elif message.role == Role.CANDIDATE:
            out.append({"role": "candidate", **serialize_candidate_turn(message).model_dump()})
    return out
