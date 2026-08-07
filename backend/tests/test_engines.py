"""Tests for the deterministic policy engines.

Adaptation and fairness are the headline product claims. These are the tests
that make them claims we can actually defend, and they run with no network and
no model involved -- which is the whole reason the policy lives in Python.
"""

from __future__ import annotations

import pytest

from app.data.loader import get_candidate, load_curriculum
from app.domain.enums import (
    Competency,
    ControllerAction,
    Difficulty,
    EvidenceStrength,
)
from app.domain.models import (
    CompetencyScore,
    InterviewSession,
    Mission,
    TurnEvaluation,
)
from app.engine import controller
from app.engine.planner import build_plan
from app.engine.profiler import build_profile, classify_mission


# ---------------------------------------------------------------------------
# Profiler
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "mission,expected",
    [
        (Mission(day=7, title="x", passed=True, attempts=1), EvidenceStrength.MASTERED),
        (Mission(day=7, title="x", passed=True, attempts=2), EvidenceStrength.SOLID),
        (Mission(day=7, title="x", passed=True, attempts=3), EvidenceStrength.SOLID),
        (Mission(day=7, title="x", passed=True, attempts=4), EvidenceStrength.STRUGGLED),
        (Mission(day=7, title="x", passed=True, attempts=5), EvidenceStrength.STRUGGLED),
        (Mission(day=7, title="x", passed=False, attempts=3), EvidenceStrength.FAILED),
        (Mission(day=7, title="x", skipped=True), EvidenceStrength.SKIPPED),
    ],
)
def test_mission_classification(mission, expected):
    assert classify_mission(mission) == expected


def test_skipped_missions_are_never_questionable():
    """The single most important fairness guarantee in the product."""
    curriculum = load_curriculum()
    # Wendy Foster skipped Security (27) and Docker/K8s (28).
    profile = build_profile(get_candidate("CAND-006"), curriculum)

    assert 27 in profile.skipped_days
    assert 28 in profile.skipped_days

    eligible_days = {t.day for t in profile.questionable_topics}
    assert 27 not in eligible_days
    assert 28 not in eligible_days


def test_no_plan_ever_probes_skipped_material():
    """Swept across every candidate in the dataset, not just a convenient one."""
    curriculum = load_curriculum()
    from app.data.loader import load_candidates

    for candidate in load_candidates():
        profile = build_profile(candidate, curriculum)
        plan = build_plan(profile, min_turns=8, max_turns=14)
        probed = {p.day for p in plan.probes}
        overlap = probed & set(profile.skipped_days)
        assert not overlap, f"{candidate.id} would be asked about skipped days {overlap}"


def test_high_persistence_candidate_is_not_misread_as_weak():
    """Tyler Brooks: 1 first-try pass out of 31 completed, and zero failures.

    A naive scorer reads 1/31 as incompetence. It is the opposite -- he cleared
    every single mission, just never on the first attempt.
    """
    profile = build_profile(get_candidate("CAND-017"), load_curriculum())

    assert profile.fluency < 0.1
    assert profile.coverage >= 0.9
    assert not profile.failed_days
    assert any("persistence" in note.lower() for note in profile.strategy_notes)


def test_senior_with_low_fluency_gets_a_calibrated_strategy():
    """Harold Whitfield: Distinguished Engineer, 28 years, 5 attempts on MCP."""
    profile = build_profile(get_candidate("CAND-008"), load_curriculum())

    assert profile.seniority_band == "principal"
    assert profile.baseline_difficulty.value <= Difficulty.DESIGN.value
    assert any(
        "disagree" in note.lower() or "new" in note.lower()
        for note in profile.strategy_notes
    )


def test_non_engineering_role_is_flagged():
    profile = build_profile(get_candidate("CAND-006"), load_curriculum())  # Marketing
    assert profile.is_engineering_role is False
    assert any("not an engineer" in note.lower() for note in profile.strategy_notes)


def test_fluent_candidate_opens_harder_than_a_struggling_one():
    curriculum = load_curriculum()
    fluent = build_profile(get_candidate("CAND-018"), curriculum)   # Diane, 31/31
    grinding = build_profile(get_candidate("CAND-010"), curriculum)  # Gerald, 1/23
    assert fluent.baseline_difficulty.value > grinding.baseline_difficulty.value


# ---------------------------------------------------------------------------
# Planner
# ---------------------------------------------------------------------------

def test_plan_never_repeats_a_topic():
    curriculum = load_curriculum()
    from app.data.loader import load_candidates

    for candidate in load_candidates():
        plan = build_plan(
            build_profile(candidate, curriculum), min_turns=8, max_turns=14
        )
        days = [p.day for p in plan.probes]
        assert len(days) == len(set(days)), f"{candidate.id} has a repeated topic"


def test_plan_covers_multiple_competencies():
    """The report scores six axes; a plan that probes one produces a hollow report."""
    curriculum = load_curriculum()
    from app.data.loader import load_candidates

    for candidate in load_candidates():
        plan = build_plan(
            build_profile(candidate, curriculum), min_turns=8, max_turns=14
        )
        if len(plan.probes) >= 6:
            assert len({p.competency for p in plan.probes}) >= 3


def test_plan_never_opens_at_maximum_difficulty():
    curriculum = load_curriculum()
    from app.data.loader import load_candidates

    for candidate in load_candidates():
        plan = build_plan(
            build_profile(candidate, curriculum), min_turns=8, max_turns=14
        )
        if plan.probes:
            assert plan.probes[0].difficulty.value < Difficulty.ADVERSARIAL.value


def test_plan_probes_at_most_one_failed_topic():
    curriculum = load_curriculum()
    profile = build_profile(get_candidate("CAND-010"), curriculum)  # 3 failures
    plan = build_plan(profile, min_turns=8, max_turns=14)
    failed_probes = [p for p in plan.probes if p.evidence == EvidenceStrength.FAILED]
    assert len(failed_probes) <= 1


# ---------------------------------------------------------------------------
# Controller
# ---------------------------------------------------------------------------

def _session(candidate_id: str = "CAND-002") -> InterviewSession:
    candidate = get_candidate(candidate_id)
    profile = build_profile(candidate, load_curriculum())
    plan = build_plan(profile, min_turns=8, max_turns=14)
    return InterviewSession(
        session_id="t",
        candidate=candidate,
        profile=profile,
        plan=plan,
        current_difficulty=profile.baseline_difficulty,
    )


def _evaluation(score: int, *, missing=None, non_answer=False) -> TurnEvaluation:
    return TurnEvaluation(
        scores=[
            CompetencyScore(competency=Competency.TECHNICAL_KNOWLEDGE, score=score),
            CompetencyScore(competency=Competency.COMMUNICATION, score=score),
        ],
        missing_points=missing or [],
        is_non_answer=non_answer,
        signal_quality=70,
    )


def test_strong_answer_drills_down_and_raises_difficulty():
    session = _session()
    session.current_difficulty = Difficulty.APPLIED
    session.evaluations.append(_evaluation(90))

    decision = controller.decide(session, _evaluation(90), min_turns=8, max_turns=14)

    assert decision.action == ControllerAction.DRILL_DOWN
    assert decision.difficulty.value == Difficulty.ANALYTICAL.value
    assert decision.reason


def test_adequate_answer_with_a_gap_follows_up_on_that_gap():
    session = _session()
    session.evaluations.append(_evaluation(65))

    decision = controller.decide(
        session, _evaluation(65, missing=["chunk overlap"]), min_turns=8, max_turns=14
    )

    assert decision.action == ControllerAction.FOLLOW_UP
    assert "chunk overlap" in decision.reason


def _turn(session, evaluation):
    """Drive a turn the way the service actually does.

    The unit tests must mirror the real call order -- register, then decide --
    or they will happily encode an off-by-one in the weak-turn streak. That
    exact bug shipped once and produced two consecutive pivots after a single
    weak answer.
    """
    controller.register_evaluation(session, evaluation)
    return controller.decide(session, evaluation, min_turns=8, max_turns=14)


def test_first_weak_answer_eases_off_rather_than_pivoting():
    session = _session()
    session.current_difficulty = Difficulty.ANALYTICAL

    decision = _turn(session, _evaluation(30))

    assert decision.action == ControllerAction.EASE_OFF, (
        "one weak answer must lower difficulty on the same topic, not abandon it"
    )
    assert decision.difficulty.value == Difficulty.APPLIED.value


def test_two_weak_turns_pivot_instead_of_grinding():
    session = _session()
    session.current_difficulty = Difficulty.ANALYTICAL

    _turn(session, _evaluation(30))          # first weak -> ease off
    decision = _turn(session, _evaluation(25))  # second weak -> pivot

    assert session.consecutive_weak_turns == 2
    assert decision.action == ControllerAction.PIVOT
    assert decision.probe is not None
    assert decision.probe.index > session.probe_cursor


def test_a_recovery_answer_resets_the_weak_streak():
    """One bad answer must not follow someone for the rest of the interview."""
    session = _session()

    _turn(session, _evaluation(30))
    assert session.consecutive_weak_turns == 1

    _turn(session, _evaluation(80))
    assert session.consecutive_weak_turns == 0


def test_non_answer_advances_without_penalising_the_streak():
    session = _session()
    evaluation = _evaluation(10, non_answer=True)
    controller.register_evaluation(session, evaluation)

    assert session.consecutive_weak_turns == 0, "a skip must not count toward a pivot"

    decision = controller.decide(session, evaluation, min_turns=8, max_turns=14)
    assert decision.action == ControllerAction.ADVANCE


def test_interview_always_terminates_at_the_ceiling():
    session = _session()
    for _ in range(14):
        session.evaluations.append(_evaluation(70))

    decision = controller.decide(session, _evaluation(70), min_turns=8, max_turns=14)
    assert decision.should_close is True
    assert decision.action == ControllerAction.CLOSE


def test_difficulty_never_leaves_the_one_to_five_band():
    session = _session()
    session.current_difficulty = Difficulty.ADVERSARIAL
    decision = controller.decide(session, _evaluation(95), min_turns=8, max_turns=14)
    assert 1 <= decision.difficulty.value <= 5

    session.current_difficulty = Difficulty.FOUNDATIONAL
    decision = controller.decide(session, _evaluation(10), min_turns=8, max_turns=14)
    assert 1 <= decision.difficulty.value <= 5
