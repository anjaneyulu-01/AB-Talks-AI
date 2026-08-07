"""Platform interview API -- what our own frontend drives.

Everything the spec endpoint hides, this one exposes: the evidence profile, the
full question plan, per-turn controller reasoning, and live telemetry. That
transparency is the product. A candidate who can see *why* the next question
got harder trusts the assessment; one who cannot is just being quizzed.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.api.deps import (
    get_service,
    serialize_candidate_turn,
    serialize_interviewer_turn,
    serialize_messages,
    serialize_plan,
    serialize_profile,
)
from app.api.schemas import (
    InterviewStateResponse,
    LiveState,
    StartInterviewRequest,
    TurnRequest,
    TurnResponse,
)
from app.core.errors import CandidateNotFoundError, ValidationError
from app.core.logging import session_id_ctx
from app.data.loader import get_candidate
from app.domain.enums import Role
from app.domain.models import InterviewSession
from app.engine.interview_service import InterviewService

router = APIRouter(prefix="/interviews", tags=["interviews"])


def _state(session: InterviewSession) -> InterviewStateResponse:
    return InterviewStateResponse(
        session_id=session.session_id,
        status=session.status.value,
        done=session.is_complete,
        profile=serialize_profile(session.profile),
        plan=serialize_plan(session),
        live=LiveState(**InterviewService.live_state(session)),
        messages=serialize_messages(session),
        report=session.report.model_dump(mode="json") if session.report else None,
    )


@router.post(
    "",
    response_model=InterviewStateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start an interview",
)
async def start_interview(
    payload: StartInterviewRequest,
    service: InterviewService = Depends(get_service),
) -> InterviewStateResponse:
    candidate = payload.candidate

    if candidate is None:
        if not payload.candidate_id:
            raise ValidationError("Provide either `candidate_id` or a `candidate` object.")
        candidate = get_candidate(payload.candidate_id)
        if candidate is None:
            raise CandidateNotFoundError(
                f"No candidate with id {payload.candidate_id!r}."
            )

    session_id = payload.session_id or str(uuid.uuid4())
    session_id_ctx.set(session_id)

    session = await service.start(session_id=session_id, candidate=candidate)
    return _state(session)


@router.get(
    "/{session_id}",
    response_model=InterviewStateResponse,
    summary="Fetch full interview state",
)
async def get_interview(
    session_id: str,
    service: InterviewService = Depends(get_service),
) -> InterviewStateResponse:
    session_id_ctx.set(session_id)
    return _state(await service.get(session_id))


@router.post(
    "/{session_id}/turns",
    response_model=TurnResponse,
    summary="Submit an answer and receive the next question",
)
async def submit_turn(
    session_id: str,
    payload: TurnRequest,
    service: InterviewService = Depends(get_service),
) -> TurnResponse:
    session_id_ctx.set(session_id)
    session = await service.submit_answer(session_id=session_id, answer=payload.message)

    latest_interviewer = next(
        (m for m in reversed(session.messages) if m.role == Role.INTERVIEWER), None
    )
    latest_candidate = next(
        (m for m in reversed(session.messages) if m.role == Role.CANDIDATE), None
    )

    return TurnResponse(
        session_id=session.session_id,
        done=session.is_complete,
        reply=latest_interviewer.content if latest_interviewer else "",
        turn=serialize_interviewer_turn(latest_interviewer) if latest_interviewer else None,
        evaluation=serialize_candidate_turn(latest_candidate) if latest_candidate else None,
        live=LiveState(**InterviewService.live_state(session)),
        report=session.report.model_dump(mode="json") if session.report else None,
    )


@router.get("/{session_id}/report", summary="Fetch the final report")
async def get_report(
    session_id: str,
    service: InterviewService = Depends(get_service),
) -> dict:
    session_id_ctx.set(session_id)
    report = await service.get_report(session_id)
    return report.model_dump(mode="json")


@router.get(
    "/{session_id}/diagnostics",
    summary="Provider call trail for this session",
)
async def diagnostics(
    session_id: str,
    service: InterviewService = Depends(get_service),
) -> dict:
    """Operational view of the failover path.

    The candidate is never supposed to notice a provider switch. We very much
    are -- this is how we verify the fallback actually fired and how long it
    cost.
    """
    session = await service.get(session_id)
    calls = [c.model_dump(mode="json") for c in session.provider_calls]
    successful = [c for c in session.provider_calls if c.ok]
    return {
        "session_id": session_id,
        "total_calls": len(calls),
        "failovers": sum(1 for c in session.provider_calls if c.fell_back_from),
        "avg_latency_ms": (
            int(sum(c.latency_ms for c in successful) / len(successful))
            if successful
            else 0
        ),
        "by_provider": {
            provider: sum(1 for c in successful if c.provider.value == provider)
            for provider in {c.provider.value for c in successful}
        },
        "calls": calls,
    }
