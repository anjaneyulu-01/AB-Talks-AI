"""The adaptive controller.

One pure function, `decide()`, is the entire adaptation policy. Given the
session state and the evaluation of the last answer, it returns the next move,
the difficulty to ask at, and — crucially — a human-readable reason.

Keeping this deterministic and pure buys three things that a model-driven
policy cannot give us:

- **It is testable.** Adaptation is the headline claim of this product. A claim
  you cannot unit-test is a demo, not a feature.
- **It is explainable.** Every decision carries a sentence we show the
  candidate. "Explain important AI decisions" stops being a design aspiration
  and becomes a return value.
- **It is bounded.** No sequence of model outputs can make the interview loop
  forever, skip the report, or drill the same topic six times.

The policy in one paragraph: strong answers earn a harder question on the same
topic (drill down) or a targeted follow-up on what they missed. Weak answers
earn an easier reframing of the same topic (ease off), and two weak turns in a
row abandon the topic entirely (pivot) rather than grinding someone down.
Everything else advances to the next planned probe.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.logging import get_logger
from app.domain.enums import ControllerAction, Difficulty
from app.domain.models import InterviewSession, Probe, TurnEvaluation

logger = get_logger(__name__)

# Score thresholds. Named, so the policy reads as prose rather than magic numbers.
STRONG = 78.0        # comfortably cleared it -> escalate
ADEQUATE = 58.0      # solid but incomplete -> follow up on the gap
WEAK = 42.0          # struggling -> make it easier

# Guardrails against pathological loops.
MAX_FOLLOW_UPS_PER_PROBE = 2
WEAK_TURNS_BEFORE_PIVOT = 2


@dataclass(slots=True)
class Decision:
    action: ControllerAction
    probe: Probe | None
    difficulty: Difficulty
    reason: str            # shown to the candidate
    missing_points: list[str]
    should_close: bool = False


def _advance_reason(probe: Probe) -> str:
    return probe.rationale


def decide(
    session: InterviewSession,
    last_evaluation: TurnEvaluation | None,
    *,
    min_turns: int,
    max_turns: int,
) -> Decision:
    plan = session.plan
    probes = plan.probes

    # ---- Termination ------------------------------------------------------
    # Checked first and unconditionally, so no branch below can keep an
    # interview alive past its budget.
    out_of_probes = session.probe_cursor >= len(probes)
    hit_ceiling = session.answered_turns >= max_turns
    met_minimum = session.answered_turns >= min_turns

    if out_of_probes or hit_ceiling or (met_minimum and session.answered_turns >= plan.target_turns):
        return Decision(
            action=ControllerAction.CLOSE,
            probe=None,
            difficulty=session.current_difficulty,
            reason="We've covered enough ground for a well-evidenced report.",
            missing_points=[],
            should_close=True,
        )

    current = probes[session.probe_cursor]

    # ---- Opening ----------------------------------------------------------
    if last_evaluation is None:
        return Decision(
            action=ControllerAction.OPEN,
            probe=current,
            difficulty=current.difficulty,
            reason=(
                f"Starting on Day {current.day} — {current.day_title}. "
                f"{current.rationale}"
            ),
            missing_points=[],
        )

    score = last_evaluation.overall
    missing = last_evaluation.missing_points
    follow_ups = session.follow_ups_on_current_probe
    difficulty = session.current_difficulty

    # ---- A non-answer is not a wrong answer -------------------------------
    # Someone typing "idk" has given us no signal about the topic, so easing
    # the difficulty would be measuring the wrong thing. Move on cleanly
    # instead — and do not count it toward the pivot streak, because pivoting
    # on a skip would punish honesty.
    if last_evaluation.is_non_answer:
        next_probe = probes[session.probe_cursor + 1] if session.probe_cursor + 1 < len(probes) else None
        if next_probe is None:
            return Decision(
                action=ControllerAction.CLOSE,
                probe=None,
                difficulty=difficulty,
                reason="We've reached the end of what I planned to cover.",
                missing_points=[],
                should_close=True,
            )
        return Decision(
            action=ControllerAction.ADVANCE,
            probe=next_probe,
            difficulty=next_probe.difficulty,
            reason=(
                "No problem — that one's not landing, so let's use the time "
                f"somewhere better. {_advance_reason(next_probe)}"
            ),
            missing_points=[],
        )

    # ---- Strong: escalate on the same topic -------------------------------
    if score >= STRONG:
        if difficulty.value < Difficulty.ADVERSARIAL.value and follow_ups < MAX_FOLLOW_UPS_PER_PROBE:
            harder = difficulty.shifted(+1)
            return Decision(
                action=ControllerAction.DRILL_DOWN,
                probe=current,
                difficulty=harder,
                reason=(
                    f"That was a strong answer, so I'm raising this to "
                    f"{harder.label.lower()} on the same topic rather than "
                    f"moving on — I want to find your ceiling, not confirm your floor."
                ),
                missing_points=missing,
            )
        # Already at the ceiling, or we've drilled enough. Bank it and move on.
        return _advance(session, probes, "You've clearly got this one.")

    # ---- Adequate but incomplete: chase the specific gap -------------------
    if score >= ADEQUATE:
        if missing and follow_ups < MAX_FOLLOW_UPS_PER_PROBE:
            gap = missing[0]
            return Decision(
                action=ControllerAction.FOLLOW_UP,
                probe=current,
                difficulty=difficulty,
                reason=(
                    f"Solid answer, but it didn't touch on {gap} — that's worth "
                    f"one more question before we move."
                ),
                missing_points=missing,
            )
        return _advance(session, probes, "Good — that's covered.")

    # ---- Weak: ease off, then pivot rather than grind ---------------------
    if score < WEAK:
        # `register_evaluation()` has already folded this turn into the streak,
        # so read it as-is. Adding 1 here would double-count and pivot on the
        # first weak answer, skipping the ease-off rung entirely -- which is
        # precisely the "grind them down or bail" behaviour this policy exists
        # to prevent.
        streak = session.consecutive_weak_turns

        if streak >= WEAK_TURNS_BEFORE_PIVOT:
            return _advance(
                session,
                probes,
                "This one isn't clicking today, and that's genuinely fine — "
                "let's spend the time where you can show me more.",
                action=ControllerAction.PIVOT,
            )

        if difficulty.value > Difficulty.FOUNDATIONAL.value and follow_ups < MAX_FOLLOW_UPS_PER_PROBE:
            easier = difficulty.shifted(-1)
            return Decision(
                action=ControllerAction.EASE_OFF,
                probe=current,
                difficulty=easier,
                reason=(
                    "Let me come at this from a more concrete angle — the "
                    "question was probably doing too much at once."
                ),
                missing_points=missing,
            )

        return _advance(
            session,
            probes,
            "Let's move to different ground.",
            action=ControllerAction.PIVOT,
        )

    # ---- Middling: keep the interview moving ------------------------------
    return _advance(session, probes, "Let's keep moving.")


def _advance(
    session: InterviewSession,
    probes: list[Probe],
    lead: str,
    *,
    action: ControllerAction = ControllerAction.ADVANCE,
) -> Decision:
    next_index = session.probe_cursor + 1
    if next_index >= len(probes):
        return Decision(
            action=ControllerAction.CLOSE,
            probe=None,
            difficulty=session.current_difficulty,
            reason="That's everything I planned to cover.",
            missing_points=[],
            should_close=True,
        )

    next_probe = probes[next_index]
    return Decision(
        action=action,
        probe=next_probe,
        difficulty=next_probe.difficulty,
        reason=f"{lead} {_advance_reason(next_probe)}",
        missing_points=[],
    )


def apply(session: InterviewSession, decision: Decision) -> None:
    """Fold a decision back into session state.

    Separated from `decide()` so the policy stays a pure function: tests can
    assert on decisions without constructing mutation side effects, and the
    session can be persisted at a single known point.
    """
    stays_on_topic = decision.action in (
        ControllerAction.FOLLOW_UP,
        ControllerAction.DRILL_DOWN,
        ControllerAction.EASE_OFF,
    )

    if decision.probe is not None:
        if stays_on_topic:
            session.follow_ups_on_current_probe += 1
        else:
            session.probe_cursor = decision.probe.index
            session.follow_ups_on_current_probe = 0
            if decision.probe.day not in session.consumed_days:
                session.consumed_days.append(decision.probe.day)

    session.current_difficulty = decision.difficulty

    logger.info(
        "controller_decision",
        extra={
            "action": decision.action.value,
            "difficulty": decision.difficulty.value,
            "probe_day": decision.probe.day if decision.probe else None,
            "cursor": session.probe_cursor,
        },
    )


def register_evaluation(session: InterviewSession, evaluation: TurnEvaluation) -> None:
    """Update the weak-turn streak. Called once per scored answer."""
    session.evaluations.append(evaluation)
    if evaluation.is_non_answer:
        # Explicitly does not increment the streak -- see `decide()`.
        return
    if evaluation.overall < WEAK:
        session.consecutive_weak_turns += 1
    else:
        session.consecutive_weak_turns = 0
