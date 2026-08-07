"""The profiler: turns a mission log into an interview strategy.

This runs before a single token of LLM context is built, and it is the reason
the product is not a ChatGPT wrapper. Everything downstream -- which topics are
even eligible, what difficulty to open at, how the report is weighted -- comes
from here, deterministically, from the candidate's own record.

The core reading of the source data:

    attempts == 1 and passed  ->  MASTERED    (fluent; probe deep)
    attempts in 2..3 and passed -> SOLID      (secure; probe normally)
    attempts >= 4 and passed  ->  STRUGGLED   (verify the model actually landed)
    passed is False           ->  FAILED      (diagnose, never punish)
    skipped is True           ->  SKIPPED     (permanently off limits)

That last line is a product decision, not a technical one. A candidate who
skipped Docker never saw Docker. Asking anyway is not rigour -- it manufactures
a failure and destroys the trust the whole experience depends on.
"""

from __future__ import annotations

from app.core.logging import get_logger
from app.domain.enums import Difficulty, EvidenceStrength
from app.domain.models import (
    Candidate,
    Curriculum,
    EvidenceProfile,
    Mission,
    TopicEvidence,
)
from app.domain.rubric import is_engineering_role, seniority_band

logger = get_logger(__name__)

COHORT_DAYS = 31

# Modules that test AI-native skill (embeddings/vector search, LLM core and
# prompting, agentic systems and MCP) versus modules that test classic software
# engineering (tooling, data handling, security, deployment, production).
#
# Splitting fluency across these two groups surfaces a pattern that aggregate
# fluency destroys. Harold Whitfield is 56% first-try overall, which reads as
# unremarkable -- but he is 5-of-6 on classic engineering and 0-of-3 on agentic
# AI, every one of those a four-or-five-attempt grind. That is not a middling
# candidate; it is a strong systems engineer meeting genuinely new vocabulary,
# and it should change how the interview opens.
_AI_NATIVE_MODULES = {3, 4, 6}
_CLASSIC_ENGINEERING_MODULES = {1, 2, 7, 8}

# Module 5 (Chatbot Application Build) is deliberately in neither group: it is
# a mix of API plumbing and LLM integration, so it muddies the comparison.


def classify_mission(mission: Mission) -> EvidenceStrength:
    """Read one mission record.

    Order matters: `skipped` is checked first because skipped records carry no
    `passed`/`attempts` at all, and treating a missing `passed` as a failure
    would be exactly backwards.
    """
    if mission.skipped:
        return EvidenceStrength.SKIPPED

    if mission.passed is False:
        return EvidenceStrength.FAILED

    if mission.passed is True:
        attempts = mission.attempts or 1
        if attempts <= 1:
            return EvidenceStrength.MASTERED
        if attempts <= 3:
            return EvidenceStrength.SOLID
        return EvidenceStrength.STRUGGLED

    # Neither passed nor skipped recorded -- no evidence either way.
    return EvidenceStrength.NOT_ATTEMPTED


# A domain comparison drawn from one or two missions is noise, not a pattern.
# Three is the point where "0 of 3 first try" stops being plausible bad luck.
_MIN_DOMAIN_SAMPLE = 3


def _domain_fluency(topics: list[TopicEvidence], modules: set[int]) -> float | None:
    """First-try rate within a group of modules.

    Returns None when the candidate attempted too little in that group to
    support a comparison -- absence of evidence, which must never be read as a
    score of zero. Without this guard the gap fires on a two-mission sample and
    tells an interviewer something the data does not actually say.
    """
    attempted = [
        t for t in topics
        if t.module_n in modules and t.strength.is_questionable
    ]
    if len(attempted) < _MIN_DOMAIN_SAMPLE:
        return None
    mastered = sum(1 for t in attempted if t.strength == EvidenceStrength.MASTERED)
    return mastered / len(attempted)


def _baseline_difficulty(
    band: str, fluency: float, mastered_count: int, struggled_count: int
) -> Difficulty:
    """Where the interview opens.

    Deliberately blends title-derived seniority with *demonstrated* fluency,
    because the dataset contains people where those two disagree sharply.
    Harold Whitfield is a Distinguished Engineer who needed five attempts on
    LangChain Agents; opening him at Adversarial on agentic AI would be
    misjudging him just as badly as opening a fluent junior at Foundational.
    Evidence moderates the title in both directions.
    """
    band_floor = {
        "entry": Difficulty.FOUNDATIONAL,
        "mid": Difficulty.APPLIED,
        "senior": Difficulty.ANALYTICAL,
        "principal": Difficulty.ANALYTICAL,
    }.get(band, Difficulty.APPLIED)

    base = band_floor.value

    if fluency >= 0.85 and mastered_count >= 5:
        base += 1          # demonstrated fluency earns a harder opening
    elif fluency <= 0.25 or struggled_count >= 5:
        base -= 1          # heavy friction earns a gentler one

    # Never open at Adversarial. Opening at the ceiling leaves the controller
    # nowhere to escalate, and it is a hostile first impression.
    return Difficulty(max(1, min(4, base)))


def _strategy_notes(
    *,
    band: str,
    engineering: bool,
    fluency: float,
    consistency: float,
    coverage: float,
    mastered: list[TopicEvidence],
    struggled: list[TopicEvidence],
    failed: list[TopicEvidence],
    skipped: list[TopicEvidence],
    years: int,
    job_role: str,
    ai_fluency: float | None,
    classic_fluency: float | None,
) -> list[str]:
    """Plain-language guidance shown in the UI and reused verbatim in prompts.

    Written as instructions to a human interviewer, because that is exactly
    what the model is being asked to behave like.
    """
    notes: list[str] = []

    if not engineering:
        notes.append(
            f"This candidate is a {job_role}, not an engineer, and completed an AI "
            f"cohort. Assess applied AI literacy and their ability to reason about "
            f"and communicate these systems. Do not run a systems-design gauntlet."
        )

    # The domain-split read comes first: it is the most actionable thing we can
    # tell an interviewer, and it frequently contradicts the aggregate.
    domain_gap = (
        classic_fluency - ai_fluency
        if ai_fluency is not None and classic_fluency is not None
        else None
    )

    if domain_gap is not None and domain_gap >= 0.4:
        notes.append(
            f"Classic engineering is fluent ({round(classic_fluency * 100)}% first "
            f"try) but AI-native material is not ({round(ai_fluency * 100)}%). This "
            f"is new territory for them, not weak engineering. Anchor questions in "
            f"systems reasoning they already own, and let them reach the AI "
            f"vocabulary rather than testing it cold."
        )
    elif domain_gap is not None and domain_gap <= -0.4:
        notes.append(
            f"Unusual shape: stronger on AI-native material "
            f"({round(ai_fluency * 100)}% first try) than on classic engineering "
            f"({round(classic_fluency * 100)}%). Push on production concerns — "
            f"deployment, observability, failure modes — rather than on model theory."
        )
    elif band in ("senior", "principal") and fluency < 0.5:
        notes.append(
            f"Seniority and cohort performance disagree: {years} years of experience "
            f"but only {round(fluency * 100)}% first-try passes. They likely have "
            f"strong general engineering instincts and genuinely new AI-specific "
            f"vocabulary. Lean on their systems intuition; go gently on jargon."
        )
    elif band in ("senior", "principal"):
        notes.append(
            "Experienced and fluent. Skip definitions entirely — open on trade-offs "
            "and design, and be willing to reach Adversarial."
        )

    if fluency <= 0.15 and len(failed) == 0 and coverage >= 0.7:
        notes.append(
            "High persistence profile: almost nothing passed first try, yet they "
            "completed nearly everything and failed nothing. This is grit, not "
            "weakness. Give them room to think — they get there."
        )

    if consistency < 0.4:
        notes.append(
            f"Engaged on only {round(consistency * 31)} of 31 days. Coverage is "
            f"patchy, so stay tightly inside what they actually completed."
        )

    if struggled:
        titles = ", ".join(f"Day {t.day}" for t in struggled[:4])
        notes.append(
            f"Repeated-attempt topics ({titles}) are the highest-value probes in "
            f"this interview — they reveal whether the model landed or the "
            f"procedure was memorised. Approach warmly."
        )

    if failed:
        titles = ", ".join(f"Day {t.day} {t.title}" for t in failed[:3])
        notes.append(
            f"Did not pass: {titles}. Probe at most one of these, at Foundational, "
            f"framed as a learning conversation rather than a re-test."
        )

    if skipped:
        titles = ", ".join(f"Day {t.day}" for t in skipped)
        notes.append(
            f"OFF LIMITS — skipped entirely: {titles}. Never reference this "
            f"material as something they should know."
        )

    if mastered and len(mastered) >= 3:
        titles = ", ".join(f"Day {t.day}" for t in mastered[:4])
        notes.append(
            f"First-try passes ({titles}) should be probed at Design or "
            f"Adversarial. Anything easier wastes their time and tells us nothing."
        )

    return notes


def _headline(profile_bits: dict) -> str:
    """One sentence the dashboard leads with."""
    band = profile_bits["band"]
    fluency = profile_bits["fluency"]
    coverage = profile_bits["coverage"]
    ai_fluency = profile_bits.get("ai_fluency")
    classic_fluency = profile_bits.get("classic_fluency")

    if (
        ai_fluency is not None
        and classic_fluency is not None
        and classic_fluency - ai_fluency >= 0.4
    ):
        return "Strong engineering foundations meeting genuinely new AI territory."

    if fluency >= 0.85 and coverage >= 0.9:
        return "Fluent and complete — this interview should run hard and fast."
    if fluency <= 0.25 and coverage >= 0.7:
        return "High persistence, high coverage — earned every pass the hard way."
    if coverage < 0.6:
        return "Partial cohort coverage — the interview will stay inside what was completed."
    if fluency < 0.35:
        return "Worked hard for every pass — the interview will build up, not start hard."
    if band in ("senior", "principal") and fluency < 0.55:
        return "Deep engineering experience meeting genuinely new AI territory."
    return "Solid, consistent progression through the cohort."


def build_profile(candidate: Candidate, curriculum: Curriculum) -> EvidenceProfile:
    member = candidate.member
    signals = candidate.signals

    topics: list[TopicEvidence] = []
    for mission in candidate.missions:
        day = curriculum.day_by_number(mission.day)
        if day is None:
            # Mission references a day not in the curriculum. Skip rather than
            # fabricate: we would have no objectives to ground a question in.
            logger.warning(
                "mission_day_not_in_curriculum",
                extra={"candidate": candidate.id, "day": mission.day},
            )
            continue

        module = curriculum.module_for_day(mission.day)
        topics.append(
            TopicEvidence(
                day=day.day,
                # Curriculum title wins over the mission's abbreviated one --
                # candidates.json shortens some titles ("LangChain Agents" vs
                # "Agentic Frameworks: LangChain Agents & Tool Use").
                title=day.title,
                module_n=module.n if module else 0,
                module_title=module.title if module else "General",
                day_type=day.type,
                tools=day.tools,
                objectives=day.objectives,
                strength=classify_mission(mission),
                attempts=mission.attempts,
                passed=mission.passed,
            )
        )

    topics.sort(key=lambda t: t.day)

    by_strength: dict[EvidenceStrength, list[TopicEvidence]] = {}
    for topic in topics:
        by_strength.setdefault(topic.strength, []).append(topic)

    mastered = by_strength.get(EvidenceStrength.MASTERED, [])
    solid = by_strength.get(EvidenceStrength.SOLID, [])
    struggled = by_strength.get(EvidenceStrength.STRUGGLED, [])
    failed = by_strength.get(EvidenceStrength.FAILED, [])
    skipped = by_strength.get(EvidenceStrength.SKIPPED, [])

    consistency = min(1.0, signals.commitDays / COHORT_DAYS)
    coverage = min(1.0, signals.missionsCompleted / COHORT_DAYS)
    fluency = (
        min(1.0, signals.missionsFirstTry / signals.missionsCompleted)
        if signals.missionsCompleted
        else 0.0
    )

    band = seniority_band(member.jobRole, member.yearsExperience)
    engineering = is_engineering_role(member.jobRole)

    ai_fluency = _domain_fluency(topics, _AI_NATIVE_MODULES)
    classic_fluency = _domain_fluency(topics, _CLASSIC_ENGINEERING_MODULES)

    profile = EvidenceProfile(
        candidate_id=member.id,
        candidate_name=member.name,
        job_role=member.jobRole,
        years_experience=member.yearsExperience,
        education=member.education,
        topics=topics,
        consistency=round(consistency, 4),
        fluency=round(fluency, 4),
        coverage=round(coverage, 4),
        friction=round(1.0 - fluency, 4),
        baseline_difficulty=_baseline_difficulty(
            band, fluency, len(mastered), len(struggled)
        ),
        seniority_band=band,
        is_engineering_role=engineering,
        mastered_days=[t.day for t in mastered],
        struggled_days=[t.day for t in struggled],
        failed_days=[t.day for t in failed],
        skipped_days=[t.day for t in skipped],
        strategy_notes=_strategy_notes(
            band=band,
            engineering=engineering,
            fluency=fluency,
            consistency=consistency,
            coverage=coverage,
            mastered=mastered,
            struggled=struggled,
            failed=failed,
            skipped=skipped,
            years=member.yearsExperience,
            job_role=member.jobRole,
            ai_fluency=ai_fluency,
            classic_fluency=classic_fluency,
        ),
    )
    profile.ai_fluency = round(ai_fluency, 4) if ai_fluency is not None else None
    profile.classic_fluency = (
        round(classic_fluency, 4) if classic_fluency is not None else None
    )
    profile.headline = _headline(
        {
            "band": band,
            "fluency": fluency,
            "coverage": coverage,
            "ai_fluency": ai_fluency,
            "classic_fluency": classic_fluency,
        }
    )

    logger.info(
        "profile_built",
        extra={
            "candidate": member.id,
            "band": band,
            "baseline": profile.baseline_difficulty.value,
            "questionable_topics": len(profile.questionable_topics),
            "skipped": len(skipped),
        },
    )
    return profile
