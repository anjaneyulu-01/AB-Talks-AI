"""Longitudinal memory service — what we write, and what we read back.

The interesting design question is not *how* to call Breeth (that's the client)
but **what is worth remembering**. A knowledge graph filled with noise is worse
than an empty one: it produces confident, irrelevant recall.

So we write exactly three kinds of fact, all of them things a human interviewer
would genuinely carry into a second conversation:

1. **Demonstrated strength** — a topic they handled well, with the level.
2. **Demonstrated gap** — a topic that came apart, and at what level.
3. **A one-paragraph summary** — the shape of the candidate on the day.

We deliberately do NOT write: raw answer text (privacy, and it is already in
Mongo), per-turn scores (they are session-relative and would mislead later),
or anything about skipped curriculum days (that asymmetry is load-bearing —
skipped material must never become an interview question, and putting it in
memory invites exactly that).
"""

from __future__ import annotations

import asyncio

from app.core.logging import get_logger
from app.domain.models import FeedbackReport, InterviewSession
from app.memory.breeth import BreethClient, PriorInterview, get_breeth

logger = get_logger(__name__)

# Scores above/below which a topic is worth remembering as a strength/gap.
# Deliberately wide of the middle: a 65 tells us nothing durable about someone.
STRENGTH_THRESHOLD = 75
GAP_THRESHOLD = 50

# Cap what we write per interview. A graph that grows without bound produces
# slower, noisier recall, and after three interviews the signal is already there.
MAX_FACTS_PER_INTERVIEW = 6


class LongitudinalMemory:
    def __init__(self, client: BreethClient | None = None) -> None:
        self._breeth = client or get_breeth()

    @property
    def enabled(self) -> bool:
        return self._breeth.enabled

    # -- write path ---------------------------------------------------------

    async def remember_interview(
        self, *, session: InterviewSession, report: FeedbackReport
    ) -> int:
        """Persist the durable outcomes of one completed interview.

        Called after the report is built and saved — never inside a turn. The
        Breeth pipeline takes ~15s to settle, which is fine here because
        nothing is waiting on it.

        Returns the number of facts written (0 if disabled or unavailable).
        """
        if not self.enabled:
            return 0

        name = session.profile.candidate_name
        candidate_id = session.profile.candidate_id

        strengths: list[tuple[str, str, str]] = []
        gaps: list[tuple[str, str, str]] = []

        for topic in report.topics_covered:
            title = topic.get("title") or ""
            score = topic.get("score") or 0
            level = (topic.get("difficulty") or "").lower()
            if not title:
                continue

            # Keep the predicate SHORT and put everything identifying in the
            # object. A long predicate like "demonstrated strength in" gets
            # split by the graph extractor into a bare edge with no object,
            # producing useless fragments ("showed a gap in") that read as
            # damning when surfaced back to an interviewer. Short verb +
            # complete object survives extraction intact.
            detail = f"{title} ({level} level)" if level else title

            if score >= STRENGTH_THRESHOLD:
                strengths.append((name, "is strong at", detail))
            elif score <= GAP_THRESHOLD:
                gaps.append((name, "needs work on", detail))

        # Gaps first: they are the more actionable memory for a follow-up
        # interview, and the budget is finite.
        selected = (gaps + strengths)[:MAX_FACTS_PER_INTERVIEW]

        tasks = [
            self._breeth.record_outcome(
                candidate_id=candidate_id,
                subject=subject,
                predicate=predicate,
                obj=obj,
            )
            for subject, predicate, obj in selected
        ]

        summary = (
            f"{name} completed an ABTalks technical interview scoring "
            f"{report.overall_score}/100 across {report.turns_taken} questions. "
            f"Recommendation: {report.recommendation.label}. {report.summary}"
        )
        tasks.append(
            self._breeth.record_narrative(candidate_id=candidate_id, content=summary)
        )

        results = await asyncio.gather(*tasks, return_exceptions=True)
        written = sum(1 for r in results if isinstance(r, str) and r)

        logger.info(
            "longitudinal_memory_written",
            extra={
                "candidate": candidate_id,
                "attempted": len(tasks),
                "written": written,
            },
        )
        return written

    # -- read path ----------------------------------------------------------

    async def recall_for(self, *, candidate_id: str, candidate_name: str) -> PriorInterview:
        """Prior-interview context, or an empty result. Never raises."""
        if not self.enabled:
            return PriorInterview()
        return await self._breeth.recall(
            candidate_id=candidate_id, candidate_name=candidate_name
        )


def render_prior_context(prior: PriorInterview) -> str:
    """Format recalled memory for the interviewer's system prompt.

    Framing matters enormously here. The interviewer must treat this as
    *context to build on*, not a score to defend or a stick to beat someone
    with. A candidate who fixed a gap since last time should be able to
    demonstrate that and be believed — so the instruction explicitly says the
    prior read may now be out of date.
    """
    if not prior.has_content:
        return ""

    lines: list[str] = [
        "PREVIOUS INTERVIEWS WITH THIS CANDIDATE",
        "",
        "You have interviewed this person before. What follows is what you "
        "remember — treat it as a starting point, not a verdict.",
        "",
    ]

    if prior.narrative:
        lines.append(f"Your overall recollection: {prior.narrative}")
        lines.append("")

    if prior.facts:
        lines.append("Specific things you noted last time:")
        lines.extend(f"- {fact}" for fact in prior.facts)
        lines.append("")

    lines.extend(
        [
            "HOW TO USE THIS",
            "- Reference it naturally once or twice, the way a human interviewer "
            "would: \"last time you weren't sure about X — where are you with "
            "that now?\"",
            "- A previously weak area is the single best place to look for "
            "growth. Revisit one of them.",
            "- People improve. If they now handle something they struggled with "
            "before, say so and mean it.",
            "- Do NOT recite this list back to them, and never imply their "
            "score is already decided.",
        ]
    )
    return "\n".join(lines)


_service: LongitudinalMemory | None = None


def get_memory() -> LongitudinalMemory:
    global _service
    if _service is None:
        _service = LongitudinalMemory()
    return _service
