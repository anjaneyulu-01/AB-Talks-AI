"""The reporter: aggregates evidence into a final report.

The division of labour here is the point.

**Python owns every number.** Per-competency scores are a weighted mean over
the turns that actually measured that competency, weighted by recency and by
how much signal the answer carried. The overall score applies role-aware
weights. The recommendation is a threshold lookup banded by seniority. No model
is ever asked "what should the score be" — that question has no defensible
answer and invites a vibe.

**The model owns the prose.** It is handed the final numbers as fixed inputs
and asked to explain them honestly. It cannot revise them.

**The curriculum owns the roadmap.** Recommended next steps are real days from
`curriculum.json`, chosen from this candidate's own record. Nothing invented.

One deliberate asymmetry worth calling out: skipped days are permanently
excluded as *question* sources but are prime *roadmap* material. Never having
learned Kubernetes is not something to be interviewed on — it is precisely
something to be pointed at afterwards. Same fact, opposite treatment, because
the two contexts have opposite ethics.
"""

from __future__ import annotations

from app.ai.base import ChatMessage, JSONParseError
from app.ai.prompts import build_report_prompt
from app.ai.router import AIRouter
from app.core.config import settings
from app.core.logging import get_logger
from app.domain.enums import Competency, EvidenceStrength, Role
from app.domain.models import (
    Curriculum,
    FeedbackReport,
    InterviewSession,
    ProviderCall,
    RoadmapStep,
    ScoreBreakdown,
    utcnow,
)
from app.domain.rubric import (
    band_for_score,
    recency_weight,
    recommend,
    weights_for,
)

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Deterministic aggregation
# ---------------------------------------------------------------------------

def _aggregate_competencies(
    session: InterviewSession,
) -> tuple[dict[Competency, float], dict[Competency, list[int]]]:
    """Weighted mean per competency, plus the turns that produced each score.

    Two weights combine:

    - `recency_weight` — later turns count up to 1.5x. An interview is partly a
      warm-up and settling in deserves credit; capped so a strong finish cannot
      erase a weak body of work.
    - `signal_quality / 100` — a turn the evaluator itself rated as thin
      evidence contributes proportionally less. This is what keeps a fallback
      evaluation (signal 20) from distorting the report.
    """
    total = len(session.evaluations)
    weighted: dict[Competency, float] = {}
    weights: dict[Competency, float] = {}
    evidence_turns: dict[Competency, list[int]] = {}

    for position, evaluation in enumerate(session.evaluations):
        recency = recency_weight(position, total)
        signal = max(0.15, evaluation.signal_quality / 100)
        weight = recency * signal

        for score in evaluation.scores:
            weighted[score.competency] = weighted.get(score.competency, 0.0) + score.score * weight
            weights[score.competency] = weights.get(score.competency, 0.0) + weight
            evidence_turns.setdefault(score.competency, []).append(position + 1)

    aggregated = {
        competency: weighted[competency] / weights[competency]
        for competency in weighted
        if weights[competency] > 0
    }
    return aggregated, evidence_turns


def _overall(scores: dict[Competency, float], job_role: str, years: int) -> float:
    """Role-weighted overall score.

    Weights are renormalised across only the competencies we actually measured.
    Without that, an interview that never reached a Design question would
    silently score architecture as zero and drag the overall down for a reason
    that has nothing to do with the candidate.
    """
    weights = weights_for(job_role, years)
    measured = {c: w for c, w in weights.items() if c in scores}
    if not measured:
        return 0.0
    total_weight = sum(measured.values())
    return sum(scores[c] * w for c, w in measured.items()) / total_weight


# ---------------------------------------------------------------------------
# Roadmap
# ---------------------------------------------------------------------------

_EFFORT_BY_TYPE = {
    "AI_CORE": "3-4 hours",
    "BUILD": "4-6 hours",
    "SHIP_IT": "1 day",
    "OPTIMIZE": "2-3 hours",
    "LEARN": "2 hours",
    "SETUP": "1 hour",
    "CAPSTONE": "2-3 days",
}


def _build_roadmap(
    session: InterviewSession,
    curriculum: Curriculum,
    weak_competencies: list[Competency],
) -> list[RoadmapStep]:
    """Rank real curriculum days by how much they would help *this* candidate.

    Priority order, highest first:
      1. Topics they were asked about and scored poorly on — proven gaps.
      2. Days they skipped entirely — unproven, but definitionally uncovered.
      3. Days they failed during the cohort.
      4. Days that took four or five attempts.
    """
    profile = session.profile
    scored_by_day: dict[int, float] = {}

    for position, evaluation in enumerate(session.evaluations):
        message = _interviewer_message_for_turn(session, position)
        if message and message.day is not None:
            scored_by_day.setdefault(message.day, evaluation.overall)

    candidates: list[tuple[float, int, str]] = []

    for day, score in scored_by_day.items():
        if score < 62:
            candidates.append((100 - score, day, "You were asked about this and the answer had gaps"))

    for day in profile.skipped_days:
        candidates.append((55.0, day, "You skipped this during the cohort, so it's uncovered ground"))

    for day in profile.failed_days:
        candidates.append((70.0, day, "This one didn't pass during the cohort"))

    for day in profile.struggled_days:
        if day not in scored_by_day:
            candidates.append((40.0, day, "This took several attempts — worth consolidating"))

    # Highest priority wins per day; no duplicates.
    best: dict[int, tuple[float, str]] = {}
    for priority, day, why in candidates:
        if day not in best or priority > best[day][0]:
            best[day] = (priority, why)

    ordered = sorted(best.items(), key=lambda kv: kv[1][0], reverse=True)[:5]

    steps: list[RoadmapStep] = []
    for order, (day_number, (_, why)) in enumerate(ordered, start=1):
        day = curriculum.day_by_number(day_number)
        if day is None:
            continue
        module = curriculum.module_for_day(day_number)
        steps.append(
            RoadmapStep(
                order=order,
                title=f"Day {day.day} · {day.title}",
                why=why,
                curriculum_days=[day.day],
                est_effort=_EFFORT_BY_TYPE.get(day.type, "3-4 hours"),
                resources=day.tools[:4],
            )
        )

    # If the interview went well enough that nothing surfaced, point them at
    # the hardest thing they have already touched rather than padding the
    # report with filler.
    if not steps and weak_competencies:
        for topic in sorted(
            profile.topics, key=lambda t: t.day, reverse=True
        ):
            if topic.strength in (EvidenceStrength.SOLID, EvidenceStrength.MASTERED):
                steps.append(
                    RoadmapStep(
                        order=1,
                        title=f"Day {topic.day} · {topic.title}",
                        why=(
                            f"Nothing major surfaced today — revisit this one to "
                            f"deepen {weak_competencies[0].label.lower()}"
                        ),
                        curriculum_days=[topic.day],
                        est_effort=_EFFORT_BY_TYPE.get(topic.day_type, "3-4 hours"),
                        resources=topic.tools[:4],
                    )
                )
                break

    return steps


def _interviewer_message_for_turn(session: InterviewSession, turn_position: int):
    """The interviewer message that prompted evaluation N."""
    interviewer_turns = [
        m for m in session.messages
        if m.role == Role.INTERVIEWER and m.probe_index is not None
    ]
    if turn_position < len(interviewer_turns):
        return interviewer_turns[turn_position]
    return None


# ---------------------------------------------------------------------------
# Narrative
# ---------------------------------------------------------------------------

def _fallback_narrative(
    session: InterviewSession,
    strong: list[str],
    weak: list[str],
    roadmap: list[RoadmapStep],
) -> dict:
    name = session.profile.candidate_name.split()[0]
    turns = len(session.evaluations)
    return {
        "summary": (
            f"{name} worked through {turns} questions spanning "
            f"{len(set(session.consumed_days))} areas of the cohort curriculum. "
            f"The strongest signal came through on {strong[0] if strong else 'engagement'}, "
            f"and the clearest room to grow is {weak[0] if weak else 'depth of reasoning'}."
        ),
        "strengths": [f"Handled {s} well under questioning" for s in strong[:3]]
        or ["Engaged with every question asked"],
        "gaps": [f"More depth needed on {w}" for w in weak[:3]]
        or ["Add explicit trade-off reasoning to technical explanations"],
        "next": [step.title for step in roadmap[:4]]
        or ["Re-run this interview after another practice cycle"],
        "recommendation_reason": "Derived from weighted per-answer scores across the interview.",
        "interviewer_note": (
            "Detailed narrative was unavailable for this report, but the scores "
            "and roadmap below are computed from your actual answers."
        ),
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def build_report(
    *,
    session: InterviewSession,
    curriculum: Curriculum,
    router: AIRouter,
) -> tuple[FeedbackReport, list[ProviderCall]]:
    profile = session.profile

    aggregated, evidence_turns = _aggregate_competencies(session)
    overall_value = _overall(aggregated, profile.job_role, profile.years_experience)
    overall = int(round(overall_value))

    recommendation = recommend(overall_value, profile.seniority_band)

    ranked = sorted(aggregated.items(), key=lambda kv: kv[1], reverse=True)
    strong_areas = [c.label for c, v in ranked if v >= 70][:3]
    weak_competencies = [c for c, v in reversed(ranked) if v < 65][:3]
    weak_areas = [c.label for c in weak_competencies]

    breakdown = [
        ScoreBreakdown(
            competency=competency,
            score=int(round(value)),
            band=band_for_score(value),
            summary=competency.description,
            evidence_turns=evidence_turns.get(competency, []),
        )
        for competency, value in sorted(
            aggregated.items(), key=lambda kv: list(Competency).index(kv[0])
        )
    ]

    # What was actually covered — the report's audit trail.
    topics_covered: list[dict] = []
    for position, evaluation in enumerate(session.evaluations):
        message = _interviewer_message_for_turn(session, position)
        if message is None or message.day is None:
            continue
        topics_covered.append(
            {
                "turn": position + 1,
                "day": message.day,
                "title": message.day_title or "",
                "module": message.module_title or "",
                "difficulty": message.difficulty.label if message.difficulty else "",
                "competency": message.competency.label if message.competency else "",
                "score": int(round(evaluation.overall)),
            }
        )

    roadmap = _build_roadmap(session, curriculum, weak_competencies)

    misconceptions: list[str] = []
    for evaluation in session.evaluations:
        misconceptions.extend(evaluation.misconceptions)

    system, _, _ = build_report_prompt(
        profile=profile,
        scored={c.label: int(round(v)) for c, v in aggregated.items()},
        overall=overall,
        recommendation_label=recommendation.label,
        topics_covered=topics_covered,
        strong_areas=strong_areas,
        weak_areas=weak_areas,
        misconceptions=misconceptions,
        recommended_days=[
            {"day": step.curriculum_days[0], "title": step.title, "why": step.why}
            for step in roadmap
        ],
        turns=len(session.evaluations),
    )

    calls: list[ProviderCall] = []
    try:
        response, calls = await router.complete(
            system=system,
            messages=[ChatMessage(role="user", content="Write the report now.")],
            purpose="report",
            temperature=0.5,
            max_tokens=settings.ai_report_max_tokens,
            json_mode=True,
        )
        narrative = response.as_json()
    except (JSONParseError, Exception) as exc:  # noqa: BLE001 - report must ship
        logger.warning("report_narrative_failed", extra={"error": str(exc)[:200]})
        narrative = _fallback_narrative(session, strong_areas, weak_areas, roadmap)

    def _list(key: str, limit: int) -> list[str]:
        raw = narrative.get(key) or []
        if isinstance(raw, str):
            raw = [raw]
        return [str(item)[:400] for item in raw if str(item).strip()][:limit]

    duration = 0
    if session.messages:
        first = session.messages[0].created_at
        last = utcnow()
        if first.tzinfo is None:
            first = first.replace(tzinfo=last.tzinfo)
        duration = max(0, int((last - first).total_seconds()))

    report = FeedbackReport(
        session_id=session.session_id,
        candidate_id=profile.candidate_id,
        candidate_name=profile.candidate_name,
        overall_score=overall,
        recommendation=recommendation,
        recommendation_reason=str(
            narrative.get("recommendation_reason") or recommendation.blurb
        )[:600],
        breakdown=breakdown,
        summary=str(narrative.get("summary", ""))[:1600],
        strengths=_list("strengths", 5),
        gaps=_list("gaps", 5),
        next=_list("next", 6),
        roadmap=roadmap,
        recommended_days=[step.curriculum_days[0] for step in roadmap],
        topics_covered=topics_covered,
        interviewer_note=str(narrative.get("interviewer_note", ""))[:600],
        turns_taken=len(session.evaluations),
        duration_seconds=duration,
    )

    # The spec requires all four feedback arrays to be present and useful.
    # Never ship an empty one.
    if not report.summary:
        report.summary = _fallback_narrative(session, strong_areas, weak_areas, roadmap)["summary"]
    if not report.strengths:
        report.strengths = ["Completed the full interview and engaged with every question"]
    if not report.gaps:
        report.gaps = ["Continue building depth in trade-off reasoning"]
    if not report.next:
        report.next = [step.title for step in roadmap[:3]] or [
            "Re-run this interview to track progress"
        ]

    logger.info(
        "report_built",
        extra={
            "session": session.session_id,
            "overall": overall,
            "recommendation": recommendation.value,
            "turns": report.turns_taken,
            "roadmap_steps": len(roadmap),
        },
    )
    return report, calls
