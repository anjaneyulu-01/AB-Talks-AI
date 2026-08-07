"""The interview service: orchestration.

This is the only module that knows the full turn lifecycle. Everything it calls
is either a pure policy function or a narrow I/O adapter, which keeps the
orchestration itself short enough to read in one sitting.

One turn, end to end:

    sanitise answer
      -> evaluate it            (LLM, structured, never fatal)
      -> register the evaluation (updates the weak-turn streak)
      -> decide the next move    (pure Python, returns a reason)
      -> apply the decision      (mutates session state at one known point)
      -> generate the question   (LLM, phrasing only)
      -> persist

Note the ordering: the decision is made *before* the question is generated, and
the question generator receives the decision. The model never chooses what
happens next — it only says the thing that was already chosen.
"""

from __future__ import annotations

import asyncio
import uuid

from app.ai.base import ChatMessage
from app.ai.prompts import build_greeting_prompt, build_question_prompt
from app.ai.router import AIRouter, get_router
from app.core.config import settings
from app.core.errors import SessionAlreadyCompleteError, SessionNotFoundError
from app.core.logging import get_logger, session_id_ctx
from app.core.security import sanitize_candidate_text
from app.data.loader import load_curriculum
from app.db.repositories import RepositoryBundle, get_repositories
from app.domain.enums import ControllerAction, Role, SessionStatus
from app.domain.models import (
    Candidate,
    FeedbackReport,
    InterviewSession,
    Message,
    ProviderCall,
    utcnow,
)
from app.domain.rubric import live_readiness
from app.memory.longitudinal import get_memory, render_prior_context
from app.engine import controller
from app.engine.evaluator import evaluate_answer
from app.engine.planner import build_plan
from app.engine.profiler import build_profile
from app.engine.reporter import build_report

logger = get_logger(__name__)

# How much transcript the question generator sees. Full history would blow the
# context budget on turn 14 and, more importantly, buries the current topic in
# noise. Six turns is enough for natural callbacks ("you mentioned chunking
# earlier") without drowning the instruction.
TRANSCRIPT_WINDOW = 6

# Strong references to detached background tasks. `asyncio.create_task` only
# holds a weak reference, so without this the loop can garbage-collect a task
# while it is still running -- the write would vanish silently.
_BACKGROUND_TASKS: set[asyncio.Task] = set()


class InterviewService:
    def __init__(
        self,
        repositories: RepositoryBundle | None = None,
        router: AIRouter | None = None,
    ) -> None:
        self._repos = repositories or get_repositories()
        self._router = router or get_router()
        self._curriculum = load_curriculum()
        self._memory = get_memory()
        # Recalled once at session start and reused for every turn. Re-fetching
        # per turn would add a network round trip to a latency-critical path
        # for data that cannot change mid-interview.
        self._prior_context: dict[str, str] = {}

    # -- helpers ------------------------------------------------------------

    def _recent_transcript(self, session: InterviewSession) -> list[ChatMessage]:
        turns = session.transcript()[-TRANSCRIPT_WINDOW:]
        return [
            ChatMessage(
                role="assistant" if m.role == Role.INTERVIEWER else "user",
                content=m.content,
            )
            for m in turns
        ]

    async def _generate_question(
        self,
        session: InterviewSession,
        decision: controller.Decision,
    ) -> tuple[str, list[ProviderCall]]:
        assert decision.probe is not None

        system, _, _ = build_question_prompt(
            profile=session.profile,
            probe=decision.probe,
            action=decision.action,
            difficulty=decision.difficulty,
            transcript=[],
            reason=decision.reason,
            missing_points=decision.missing_points,
            turn=session.turn_index,
            prior_context=self._prior_context.get(session.session_id, ""),
        )

        response, calls = await self._router.complete(
            system=system,
            messages=self._recent_transcript(session),
            purpose="question",
            # Warm enough to sound human, cool enough to stay on task.
            temperature=0.8,
            max_tokens=400,
        )
        return response.text.strip(), calls

    def _record_interviewer_turn(
        self,
        session: InterviewSession,
        content: str,
        decision: controller.Decision,
        calls: list[ProviderCall],
    ) -> Message:
        provider = calls[-1].provider if calls else None
        latency = calls[-1].latency_ms if calls else None

        message = Message(
            id=str(uuid.uuid4()),
            session_id=session.session_id,
            role=Role.INTERVIEWER,
            content=content,
            turn_index=session.turn_index,
            probe_index=decision.probe.index if decision.probe else None,
            day=decision.probe.day if decision.probe else None,
            day_title=decision.probe.day_title if decision.probe else None,
            module_title=decision.probe.module_title if decision.probe else None,
            competency=decision.probe.competency if decision.probe else None,
            difficulty=decision.difficulty,
            action=decision.action,
            reason=decision.reason,
            provider=provider,
            latency_ms=latency,
        )
        session.messages.append(message)
        session.provider_calls.extend(calls)
        return message

    # -- public API ---------------------------------------------------------

    async def start(
        self, *, session_id: str, candidate: Candidate
    ) -> InterviewSession:
        """Create a session and produce the opening turn.

        The opening reply deliberately contains both the greeting *and* the
        first question. A greeting alone leaves the candidate with nothing to
        respond to, which is a dead turn and an awkward first impression.
        """
        session_id_ctx.set(session_id)

        profile = build_profile(candidate, self._curriculum)
        plan = build_plan(
            profile,
            min_turns=settings.interview_min_turns,
            max_turns=settings.interview_max_turns,
        )

        session = InterviewSession(
            session_id=session_id,
            candidate=candidate,
            profile=profile,
            plan=plan,
            status=SessionStatus.IN_PROGRESS,
            current_difficulty=profile.baseline_difficulty,
        )

        # Longitudinal recall. Runs once, before the first question, and is
        # cached for the session. Fails soft: no memory means the interview
        # proceeds exactly as a first-time session.
        prior = await self._memory.recall_for(
            candidate_id=profile.candidate_id, candidate_name=profile.candidate_name
        )
        prior_context = render_prior_context(prior)
        self._prior_context[session_id] = prior_context
        if prior_context:
            logger.info(
                "returning_candidate",
                extra={"candidate": profile.candidate_id, "facts": prior.source_count},
            )

        # Greeting.
        greeting_system, _, _ = build_greeting_prompt(profile, prior_context)
        greeting_response, greeting_calls = await self._router.complete(
            system=greeting_system,
            messages=[ChatMessage(role="user", content="Begin the interview.")],
            purpose="greeting",
            temperature=0.85,
            max_tokens=300,
        )
        session.provider_calls.extend(greeting_calls)

        # First question.
        decision = controller.decide(
            session,
            None,
            min_turns=settings.interview_min_turns,
            max_turns=settings.interview_max_turns,
        )
        controller.apply(session, decision)

        if decision.probe is None:
            # No eligible material at all. Extremely unlikely given the
            # dataset, but it must not produce a broken session.
            session.status = SessionStatus.COMPLETED
            session.completed_at = utcnow()
            await self._repos.sessions.save(session)
            return session

        question, question_calls = await self._generate_question(session, decision)

        combined = f"{greeting_response.text.strip()}\n\n{question}"
        self._record_interviewer_turn(session, combined, decision, question_calls)
        session.turn_index += 1

        await self._repos.sessions.save(session)
        logger.info(
            "interview_started",
            extra={
                "candidate": candidate.id,
                "planned_turns": plan.target_turns,
                "baseline": profile.baseline_difficulty.value,
            },
        )
        return session

    async def submit_answer(
        self, *, session_id: str, answer: str
    ) -> InterviewSession:
        session_id_ctx.set(session_id)

        session = await self._repos.sessions.get(session_id)
        if session is None:
            raise SessionNotFoundError()
        if session.is_complete:
            raise SessionAlreadyCompleteError()

        # 1. Sanitise. Neutralise-and-flag, never reject: a false positive that
        #    erased a real answer would be far worse than an injection attempt
        #    that gets scored on its technical merits.
        cleaned = sanitize_candidate_text(
            answer, max_chars=settings.interview_answer_max_chars
        )
        if cleaned.injection_detected:
            logger.warning(
                "prompt_injection_neutralised",
                extra={"patterns": len(cleaned.matched_patterns)},
            )

        session.messages.append(
            Message(
                id=str(uuid.uuid4()),
                session_id=session_id,
                role=Role.CANDIDATE,
                content=cleaned.text,
                turn_index=session.turn_index,
                flagged=cleaned.injection_detected,
            )
        )

        # 2. Evaluate against the probe that was actually asked.
        asked = next(
            (
                m for m in reversed(session.messages)
                if m.role == Role.INTERVIEWER and m.probe_index is not None
            ),
            None,
        )
        probe = (
            session.plan.probes[asked.probe_index]
            if asked and asked.probe_index is not None
            and asked.probe_index < len(session.plan.probes)
            else session.current_probe
        )

        if probe is None:
            return await self._close(session)

        evaluation, eval_calls = await evaluate_answer(
            router=self._router,
            probe=probe,
            difficulty=asked.difficulty if asked and asked.difficulty else session.current_difficulty,
            question=asked.content if asked else "",
            answer=cleaned.text,
            injection_flagged=cleaned.injection_detected,
        )
        session.provider_calls.extend(eval_calls)

        # Attach the evaluation to the candidate's message so the UI can show
        # per-turn signal without a second lookup.
        session.messages[-1].evaluation = evaluation
        controller.register_evaluation(session, evaluation)

        # 3. Decide, then apply. Policy before language, always.
        decision = controller.decide(
            session,
            evaluation,
            min_turns=settings.interview_min_turns,
            max_turns=settings.interview_max_turns,
        )

        if decision.should_close or decision.probe is None:
            return await self._close(session)

        controller.apply(session, decision)

        # 4. Generate the question the decision already chose.
        question, question_calls = await self._generate_question(session, decision)
        self._record_interviewer_turn(session, question, decision, question_calls)
        session.turn_index += 1

        await self._repos.sessions.save(session)
        return session

    async def _close(self, session: InterviewSession) -> InterviewSession:
        report, calls = await build_report(
            session=session,
            curriculum=self._curriculum,
            router=self._router,
        )
        session.provider_calls.extend(calls)
        session.report = report
        session.status = SessionStatus.COMPLETED
        session.completed_at = utcnow()

        closing = (
            f"That's everything I wanted to cover — thanks for thinking out loud "
            f"with me, {session.profile.candidate_name.split()[0]}. "
            f"Your report is ready below."
        )
        session.messages.append(
            Message(
                id=str(uuid.uuid4()),
                session_id=session.session_id,
                role=Role.INTERVIEWER,
                content=closing,
                turn_index=session.turn_index,
            )
        )

        await self._repos.sessions.save(session)
        await self._repos.reports.save(report)

        # Longitudinal write. Detached deliberately: the Breeth pipeline takes
        # ~15s to settle and the candidate is waiting on this response to see
        # their report. Nothing downstream reads it back in this request, so
        # there is no ordering requirement -- and a slow or failed write must
        # not delay or break report delivery.
        self._prior_context.pop(session.session_id, None)
        if self._memory.enabled:
            task = asyncio.create_task(
                self._remember(session=session, report=report)
            )
            # Hold a reference: without one, the event loop may garbage-collect
            # a running task mid-flight.
            _BACKGROUND_TASKS.add(task)
            task.add_done_callback(_BACKGROUND_TASKS.discard)

        logger.info(
            "interview_completed",
            extra={
                "session": session.session_id,
                "overall": report.overall_score,
                "turns": report.turns_taken,
            },
        )
        return session

    async def _remember(
        self, *, session: InterviewSession, report: FeedbackReport
    ) -> None:
        """Detached longitudinal write. Swallows everything.

        This runs with nobody awaiting it, so an escaping exception would
        surface as an unhandled-task-exception warning and nothing else. Catch
        it here and log it properly instead.
        """
        try:
            await self._memory.remember_interview(session=session, report=report)
        except Exception as exc:  # noqa: BLE001 — detached, must not propagate
            logger.warning(
                "longitudinal_write_failed",
                extra={"session": session.session_id, "error": str(exc)[:200]},
            )

    async def get(self, session_id: str) -> InterviewSession:
        session = await self._repos.sessions.get(session_id)
        if session is None:
            raise SessionNotFoundError()
        return session

    async def get_report(self, session_id: str) -> FeedbackReport:
        report = await self._repos.reports.get(session_id)
        if report is None:
            session = await self.get(session_id)
            if session.report is None:
                raise SessionNotFoundError("No report exists for that session yet.")
            return session.report
        return report

    # -- live UI state ------------------------------------------------------

    @staticmethod
    def live_state(session: InterviewSession) -> dict:
        """The telemetry the interview screen renders in its side rail.

        Readiness is smoothed and floored at 25 on purpose. A live number that
        cratered after one weak answer would do the exact opposite of "build
        confidence throughout the interview" — it would tell someone mid-way
        that they have already failed.
        """
        overalls = [e.overall for e in session.evaluations]
        per_competency: dict[str, list[float]] = {}
        for evaluation in session.evaluations:
            for score in evaluation.scores:
                per_competency.setdefault(score.competency.value, []).append(score.score)

        current = session.current_probe
        return {
            "turn": session.turn_index,
            "planned_turns": session.plan.target_turns,
            "answered": session.answered_turns,
            "progress": (
                round(min(1.0, session.answered_turns / max(1, session.plan.target_turns)), 3)
            ),
            "readiness": live_readiness(overalls),
            "difficulty": session.current_difficulty.value,
            "difficulty_label": session.current_difficulty.label,
            "current_day": current.day if current else None,
            "current_topic": current.day_title if current else None,
            "current_module": current.module_title if current else None,
            "competency_signal": {
                key: int(round(sum(values) / len(values)))
                for key, values in per_competency.items()
            },
            "topics_covered": sorted(set(session.consumed_days)),
            "status": session.status.value,
        }
