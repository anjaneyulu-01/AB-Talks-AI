"""The evaluator: scores one answer at a time, with a schema and a safety net.

Two things make this trustworthy rather than a vibe:

**Bounded structure.** The model returns JSON validated by Pydantic into
integers in 0..100. Even a wholly successful prompt injection cannot write
prose into `score`, invent a seventh competency, or reach the final aggregate —
because the reporter computes that itself from these values.

**Never fatal.** An evaluation failure must not end a live interview. If the
model returns garbage, we fall back to a heuristic score, mark the turn as
low-confidence, and keep going. Losing precision on one turn is a bad outcome;
losing the interview is an unacceptable one.
"""

from __future__ import annotations

from app.ai.base import ChatMessage, JSONParseError
from app.ai.prompts import build_evaluation_prompt
from app.ai.router import AIRouter
from app.core.config import settings
from app.core.logging import get_logger
from app.domain.enums import Competency, Difficulty
from app.domain.models import (
    CompetencyScore,
    Probe,
    ProviderCall,
    TurnEvaluation,
)
from app.domain.rubric import DIFFICULTY_COMPETENCIES

logger = get_logger(__name__)


def _coerce_evaluation(
    payload: dict, allowed: list[Competency]
) -> TurnEvaluation:
    """Turn a model's JSON into a validated evaluation.

    Defensive on every field. Models drift: they rename competencies, return
    scores as strings, emit 0-10 instead of 0-100, or hand back a bare string
    where a list was asked for. All of that is recoverable and none of it
    should surface to the candidate.
    """
    allowed_values = {c.value for c in allowed}
    scores: list[CompetencyScore] = []

    for raw in payload.get("scores") or []:
        if not isinstance(raw, dict):
            continue
        key = str(raw.get("competency", "")).strip().lower().replace(" ", "_")
        if key not in allowed_values:
            # Silently drop anything outside the requested axes rather than
            # letting an off-rubric score pollute the average.
            continue
        try:
            value = float(raw.get("score", 0))
        except (TypeError, ValueError):
            continue
        # Some models answer on a 0-10 scale despite the instruction.
        if 0 < value <= 10 and float(value).is_integer():
            value *= 10
        scores.append(
            CompetencyScore(
                competency=Competency(key),
                score=int(max(0, min(100, round(value)))),
                evidence=str(raw.get("evidence", ""))[:400],
            )
        )

    # Deduplicate, keeping the first score per competency.
    seen: set[Competency] = set()
    deduped: list[CompetencyScore] = []
    for score in scores:
        if score.competency not in seen:
            seen.add(score.competency)
            deduped.append(score)

    def _strings(key: str, limit: int = 6) -> list[str]:
        raw = payload.get(key) or []
        if isinstance(raw, str):
            raw = [raw]
        return [str(item)[:300] for item in raw if str(item).strip()][:limit]

    try:
        signal = int(float(payload.get("signal_quality", 50)))
    except (TypeError, ValueError):
        signal = 50

    return TurnEvaluation(
        scores=deduped,
        covered_points=_strings("covered_points"),
        missing_points=_strings("missing_points"),
        misconceptions=_strings("misconceptions"),
        signal_quality=max(0, min(100, signal)),
        is_non_answer=bool(payload.get("is_non_answer", False)),
        admitted_uncertainty=bool(payload.get("admitted_uncertainty", False)),
        notes=str(payload.get("notes", ""))[:600],
    )


def _fallback_evaluation(answer: str, allowed: list[Competency]) -> TurnEvaluation:
    """Heuristic scoring when the model fails us.

    Deliberately conservative and centred: an unreliable evaluation should not
    swing the final report in either direction. `signal_quality` is set low so
    the reporter can down-weight it.
    """
    words = len(answer.split())
    is_non_answer = words < 4

    if is_non_answer:
        base = 15
    else:
        base = min(72, 35 + words * 0.5)

    return TurnEvaluation(
        scores=[
            CompetencyScore(
                competency=c,
                score=int(base),
                evidence="Automatic estimate — detailed assessment unavailable for this turn.",
            )
            for c in allowed
        ],
        covered_points=[],
        missing_points=[],
        misconceptions=[],
        signal_quality=20,
        is_non_answer=is_non_answer,
        notes="Fallback scoring used; this turn is weighted down in the final report.",
    )


async def evaluate_answer(
    *,
    router: AIRouter,
    probe: Probe,
    difficulty: Difficulty,
    question: str,
    answer: str,
    injection_flagged: bool,
) -> tuple[TurnEvaluation, list[ProviderCall]]:
    # Score the probe's headline competency plus whatever else this difficulty
    # can genuinely surface. Asking for axes the question cannot measure would
    # manufacture noise and then average it into the report.
    allowed = list(
        dict.fromkeys([probe.competency, *DIFFICULTY_COMPETENCIES[difficulty]])
    )

    system, messages, _ = build_evaluation_prompt(
        probe=probe,
        difficulty=difficulty,
        competencies=allowed,
        question=question,
        answer=answer,
        injection_flagged=injection_flagged,
    )

    try:
        response, calls = await router.complete(
            system=system,
            messages=[ChatMessage(role=m["role"], content=m["content"]) for m in messages],
            purpose="evaluate",
            temperature=0.15,   # scoring should be near-deterministic
            max_tokens=settings.ai_eval_max_tokens,
            json_mode=True,
        )
    except Exception as exc:  # noqa: BLE001 - never fatal
        logger.warning("evaluation_call_failed", extra={"error": str(exc)[:200]})
        return _fallback_evaluation(answer, allowed), []

    try:
        payload = response.as_json()
    except JSONParseError as exc:
        logger.warning(
            "evaluation_parse_failed",
            extra={"provider": response.provider.value, "error": str(exc)[:200]},
        )
        return _fallback_evaluation(answer, allowed), calls

    evaluation = _coerce_evaluation(payload, allowed)

    # A parse that yields no usable scores is a failure in everything but name.
    if not evaluation.scores:
        logger.warning("evaluation_had_no_valid_scores")
        fallback = _fallback_evaluation(answer, allowed)
        fallback.missing_points = evaluation.missing_points
        return fallback, calls

    logger.info(
        "answer_evaluated",
        extra={
            "day": probe.day,
            "difficulty": difficulty.value,
            "overall": round(evaluation.overall, 1),
            "signal": evaluation.signal_quality,
            "provider": response.provider.value,
        },
    )
    return evaluation, calls
