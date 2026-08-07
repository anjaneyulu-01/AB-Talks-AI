"""The planner: builds the question plan before the interview starts.

Why plan up front instead of letting the model pick each next question:

- **Repeats become impossible.** One topic per probe, allocated once. This is a
  data structure, not a prompt instruction the model may ignore on turn 9.
- **Coverage is guaranteed.** The report scores six competencies. If the model
  freestyles, it will ask five knowledge questions and we will have no
  architecture evidence to report. The planner assigns competencies explicitly.
- **The interview has a shape.** Real interviews open accessibly, build to a
  peak, and land somewhere the candidate can succeed. That arc is designed here.
- **It stays fast.** Topic selection costs no tokens and no latency.

The plan is a *plan*, not a script. The controller (next module) re-difficulties
probes live, inserts follow-ups, and skips ahead — but always within the topic
allocation the planner made.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from app.core.logging import get_logger
from app.domain.enums import Competency, Difficulty, EvidenceStrength
from app.domain.models import EvidenceProfile, InterviewPlan, Probe, TopicEvidence
from app.domain.rubric import DIFFICULTY_COMPETENCIES

logger = get_logger(__name__)


# How much interview signal each kind of evidence yields.
# STRUGGLED ranks highest on purpose: "passed on the fifth attempt" is the most
# informative record in the dataset. It is the only one where we genuinely do
# not know whether understanding landed or the procedure was memorised, and
# that is exactly what an interview is for.
_EVIDENCE_VALUE: dict[EvidenceStrength, float] = {
    EvidenceStrength.STRUGGLED: 1.00,
    EvidenceStrength.MASTERED: 0.88,
    EvidenceStrength.SOLID: 0.62,
    EvidenceStrength.FAILED: 0.45,
}

# Days that carry real conceptual weight. SETUP days ("install VS Code") are
# poor interview material regardless of how the candidate performed on them.
_TYPE_VALUE: dict[str, float] = {
    "AI_CORE": 1.00,
    "SHIP_IT": 0.95,
    "BUILD": 0.85,
    "OPTIMIZE": 0.80,
    "CAPSTONE": 0.75,
    "LEARN": 0.70,
    "SETUP": 0.25,
}

# At most one probe on a topic the candidate failed. More than one turns a
# diagnostic into an interrogation.
_MAX_FAILED_PROBES = 1


@dataclass(slots=True)
class _Scored:
    topic: TopicEvidence
    value: float


def _stable_jitter(candidate_id: str, day: int) -> float:
    """Tiny deterministic tiebreak.

    Two candidates with identical records should not get an identical question
    order, but the *same* candidate must get a reproducible plan — that is what
    makes a bug reportable. Hash-derived, so it is stable across processes.
    """
    digest = hashlib.sha256(f"{candidate_id}:{day}".encode()).digest()
    return (digest[0] / 255.0) * 0.06


def _score_topics(profile: EvidenceProfile) -> list[_Scored]:
    scored: list[_Scored] = []
    for topic in profile.questionable_topics:
        base = _EVIDENCE_VALUE.get(topic.strength, 0.4)
        type_weight = _TYPE_VALUE.get(topic.day_type, 0.7)

        # Later curriculum days are more advanced and make for richer
        # questions; a mild gradient, not a hard preference.
        recency = 0.85 + 0.15 * (topic.day / 31)

        value = base * type_weight * recency + _stable_jitter(profile.candidate_id, topic.day)
        scored.append(_Scored(topic=topic, value=round(value, 5)))

    scored.sort(key=lambda s: s.value, reverse=True)
    return scored


def _select_topics(profile: EvidenceProfile, target: int) -> list[TopicEvidence]:
    """Pick topics for the plan, spread across modules.

    Module diversity is enforced with a two-pass sweep rather than a penalty
    term: pass one takes the best topic from each distinct module, pass two
    backfills by raw value. This reliably produces an interview that ranges
    across the cohort instead of drilling one module — which matters because
    the report claims to assess breadth.
    """
    scored = _score_topics(profile)
    if not scored:
        return []

    selected: list[TopicEvidence] = []
    used_days: set[int] = set()
    used_modules: set[int] = set()
    failed_used = 0

    def _take(entry: _Scored) -> bool:
        nonlocal failed_used
        topic = entry.topic
        if topic.day in used_days:
            return False
        if topic.strength == EvidenceStrength.FAILED:
            if failed_used >= _MAX_FAILED_PROBES:
                return False
            failed_used += 1
        selected.append(topic)
        used_days.add(topic.day)
        used_modules.add(topic.module_n)
        return True

    # Pass 1 — breadth.
    for entry in scored:
        if len(selected) >= target:
            break
        if entry.topic.module_n not in used_modules:
            _take(entry)

    # Pass 2 — depth.
    for entry in scored:
        if len(selected) >= target:
            break
        _take(entry)

    return selected


def _difficulty_arc(baseline: Difficulty, count: int) -> list[Difficulty]:
    """The dramatic shape of the interview.

    Ramp in, peak around three-quarters through, then step back for the close.
    The final easing is deliberate and is a product decision: the last question
    is what a candidate remembers, and we would rather they leave having
    answered something well. "Reward progress instead of punishing mistakes"
    has to survive contact with the last thirty seconds.
    """
    if count <= 0:
        return []

    arc: list[Difficulty] = []
    peak_at = max(1, int(count * 0.75))

    for i in range(count):
        if i == 0:
            # Open one rung below baseline — momentum first.
            level = baseline.value - 1
        elif i <= peak_at:
            progress = i / max(1, peak_at)
            level = baseline.value + round(progress * 1.6)
        else:
            level = baseline.value

        arc.append(Difficulty(max(1, min(5, level))))

    return arc


def _assign_competencies(
    difficulties: list[Difficulty], engineering: bool
) -> list[Competency]:
    """Spread competencies so every axis in the report has real evidence.

    Constrained by what each difficulty can actually measure — a Foundational
    "define X" question cannot produce architecture signal, and asking the
    evaluator to score it anyway just injects noise into the average.

    Least-used-first selection, so the axes stay balanced without needing a
    second optimisation pass.
    """
    usage: dict[Competency, int] = {c: 0 for c in Competency}

    # Non-engineering candidates get architecture de-prioritised rather than
    # removed: a Business Analyst reasoning about where a vector DB belongs is
    # legitimate signal, it just should not dominate their interview.
    if not engineering:
        usage[Competency.ARCHITECTURE] = 2

    assigned: list[Competency] = []
    for difficulty in difficulties:
        eligible = DIFFICULTY_COMPETENCIES[difficulty]
        # Confidence is scored on nearly every answer by the evaluator anyway,
        # so it rarely needs to be the headline competency of a question.
        primary = [c for c in eligible if c != Competency.CONFIDENCE] or list(eligible)
        choice = min(primary, key=lambda c: (usage[c], list(Competency).index(c)))
        usage[choice] += 1
        assigned.append(choice)

    return assigned


def _rationale(topic: TopicEvidence, difficulty: Difficulty, competency: Competency) -> str:
    """The 'why this question' string, surfaced in the UI.

    Explaining the AI's decisions was a stated product principle. This is where
    that principle becomes a string a candidate can actually read.
    """
    if topic.strength == EvidenceStrength.MASTERED:
        stem = f"You cleared Day {topic.day} on the first attempt"
    elif topic.strength == EvidenceStrength.STRUGGLED:
        stem = f"Day {topic.day} took you {topic.attempts} attempts"
    elif topic.strength == EvidenceStrength.FAILED:
        stem = f"Day {topic.day} didn't come together during the cohort"
    else:
        stem = f"You worked through Day {topic.day} in {topic.attempts or 2} attempts"

    intent = {
        Difficulty.FOUNDATIONAL: "so this checks the core idea is solid",
        Difficulty.APPLIED: "so this looks at how you'd actually use it",
        Difficulty.ANALYTICAL: "so this asks you to defend a choice",
        Difficulty.DESIGN: "so this moves straight to designing with it",
        Difficulty.ADVERSARIAL: "so this pushes on where it breaks",
    }[difficulty]

    return f"{stem}, {intent} — probing {competency.label.lower()}."


def _pick_objective(topic: TopicEvidence, difficulty: Difficulty) -> str:
    """Choose which learning objective grounds this question.

    Objectives in curriculum.json run roughly easy-to-hard within a day, so
    difficulty indexes into that ordering. This is what keeps a Design-level
    question anchored to a real syllabus line rather than a hallucinated one.
    """
    if not topic.objectives:
        return topic.title
    index = min(len(topic.objectives) - 1, max(0, difficulty.value - 1))
    return topic.objectives[index]


def build_plan(
    profile: EvidenceProfile, *, min_turns: int, max_turns: int
) -> InterviewPlan:
    # Aim high in the allowed band, then clamp to available material. A
    # candidate with only six eligible topics gets a shorter, honest interview
    # rather than padded repetition.
    available = len(profile.questionable_topics)
    target = max(min_turns, min(max_turns, available))
    target = min(target, available)

    topics = _select_topics(profile, target)
    if not topics:
        logger.error(
            "no_questionable_topics",
            extra={"candidate": profile.candidate_id},
        )
        return InterviewPlan(probes=[], target_turns=0)

    difficulties = _difficulty_arc(profile.baseline_difficulty, len(topics))
    competencies = _assign_competencies(difficulties, profile.is_engineering_role)

    # Order the selected topics along the arc so an easier-evidence topic isn't
    # landed on an Adversarial slot. Sorting by evidence value against a sorted
    # difficulty list pairs the strongest evidence with the hardest questions.
    order = sorted(
        range(len(topics)),
        key=lambda i: _EVIDENCE_VALUE.get(topics[i].strength, 0.4),
    )
    difficulty_order = sorted(range(len(difficulties)), key=lambda i: difficulties[i].value)
    paired: list[tuple[TopicEvidence, Difficulty, Competency]] = [None] * len(topics)  # type: ignore[list-item]
    for rank, topic_idx in enumerate(order):
        slot = difficulty_order[rank]
        paired[slot] = (topics[topic_idx], difficulties[slot], competencies[slot])

    probes: list[Probe] = []
    for index, (topic, difficulty, competency) in enumerate(paired):
        objective = _pick_objective(topic, difficulty)
        probes.append(
            Probe(
                index=index,
                day=topic.day,
                day_title=topic.title,
                module_title=topic.module_title,
                objective=objective,
                tools=topic.tools,
                competency=competency,
                difficulty=difficulty,
                evidence=topic.strength,
                rationale=_rationale(topic, difficulty, competency),
            )
        )

    plan = InterviewPlan(
        probes=probes,
        target_turns=len(probes),
        opening_note=profile.headline,
    )

    logger.info(
        "plan_built",
        extra={
            "candidate": profile.candidate_id,
            "probes": len(probes),
            "days": [p.day for p in probes],
            "difficulties": [p.difficulty.value for p in probes],
            "competencies": sorted({p.competency.value for p in probes}),
        },
    )
    return plan
