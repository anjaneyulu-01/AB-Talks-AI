"""Deterministic offline strategist -- the third tier of the provider chain.

This is not a mock. It produces genuinely usable interview questions and
defensible evaluations without any network call, because the *policy* has
already been decided by the deterministic engines before it is invoked. All it
has to do is render language for a decision that has already been made.

How it knows what to render: the prompt builder appends a machine-readable
hint block to the system prompt. Hosted models treat it as an HTML comment and
ignore it; this module reads it and dispatches on it. That keeps the provider
interface uniform -- no special-casing anywhere upstream.

Quality expectations are honest: questions here are competent and on-topic but
templated, and heuristic scoring is coarser than a model's. It keeps a session
alive and coherent; it is not a substitute for Grok or Gemini.
"""

from __future__ import annotations

import json
import re
from typing import Any

from app.ai.base import ChatMessage

HINT_OPEN = "<!--ABTALKS_LOCAL_HINT"
HINT_CLOSE = "-->"
_HINT_RE = re.compile(re.escape(HINT_OPEN) + r"(.*?)" + re.escape(HINT_CLOSE), re.DOTALL)


def embed_hint(system_prompt: str, hint: dict[str, Any]) -> str:
    return f"{system_prompt}\n\n{HINT_OPEN}{json.dumps(hint)}{HINT_CLOSE}"


def read_hint(system_prompt: str) -> dict[str, Any]:
    match = _HINT_RE.search(system_prompt)
    if not match:
        return {}
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return {}


def strip_hint(system_prompt: str) -> str:
    return _HINT_RE.sub("", system_prompt).strip()


# ---------------------------------------------------------------------------
# Question rendering
# ---------------------------------------------------------------------------

_OPENERS = {
    "open": "Let's start somewhere you've spent real time.",
    "advance": "Let's move to a different area.",
    "follow_up": "I want to stay on this for one more moment.",
    "drill_down": "Good — let me push on that.",
    "ease_off": "Let me come at this from a simpler angle.",
    "pivot": "Let's move on to something else.",
}

_STEMS: dict[int, tuple[str, ...]] = {
    1: (
        "In your own words, how would you explain {topic} to a teammate who has never used it?",
        "What is {topic} actually doing under the hood, and why does that matter?",
    ),
    2: (
        "Walk me through how you used {topic} in practice. What did you actually build?",
        "Suppose you had to apply {topic} to a new dataset tomorrow. What are your first three steps?",
    ),
    3: (
        "You have two viable options for {topic}. How do you decide between them, and what would change your mind?",
        "What trade-off did you accept when you worked on {topic}, and what did it cost you?",
    ),
    4: (
        "Design the {topic} layer for a system serving 10,000 users a day. Where are the boundaries, and why?",
        "Sketch how you'd architect {topic} end to end, and tell me which part you'd expect to fail first.",
    ),
    5: (
        "Your {topic} implementation works at 1,000 documents and falls over at 10 million. Diagnose it.",
        "Someone reports that {topic} is returning confident, wrong results in production. Walk me through your investigation.",
    ),
}


def _render_question(hint: dict[str, Any]) -> str:
    topic = hint.get("day_title") or hint.get("topic") or "this area"
    difficulty = int(hint.get("difficulty", 2))
    action = hint.get("action", "advance")
    objective = hint.get("objective", "")

    stems = _STEMS.get(difficulty, _STEMS[2])
    # Deterministic pick, varied across turns so consecutive questions don't
    # share a stem.
    stem = stems[int(hint.get("turn", 0)) % len(stems)]
    question = stem.format(topic=topic)

    lead = _OPENERS.get(action, "")

    if action == "follow_up" and hint.get("missing"):
        missing = hint["missing"][0]
        question = (
            f"You covered the mechanics well, but didn't touch on {missing}. "
            f"How does that factor into your thinking?"
        )
    elif action == "ease_off":
        question = (
            f"Let's take {topic} back to fundamentals — what problem does it solve, "
            f"and when would you reach for it?"
        )

    parts = [p for p in (lead, question) if p]
    body = " ".join(parts)

    if objective and difficulty >= 3:
        body += f"\n\nFor context, I'm probing this because the cohort covered: {objective.lower()}"

    return body


# ---------------------------------------------------------------------------
# Heuristic evaluation
# ---------------------------------------------------------------------------

_DEPTH_MARKERS = (
    "because", "trade-off", "tradeoff", "however", "instead", "whereas",
    "the reason", "which means", "so that", "otherwise", "in contrast",
    "depends on", "at scale", "bottleneck", "latency", "throughput",
)
_UNCERTAINTY_MARKERS = (
    "i'm not sure", "i am not sure", "i don't know", "i do not know",
    "i'd have to check", "i would have to check", "i'm unclear", "not certain",
)
_NON_ANSWER = ("idk", "no idea", "pass", "skip", "n/a", "dunno")


def _heuristic_scores(answer: str, competencies: list[str]) -> dict[str, Any]:
    text = answer.strip()
    lowered = text.lower()
    words = text.split()
    word_count = len(words)

    is_non_answer = word_count < 4 or lowered.strip(".! ") in _NON_ANSWER
    admitted = any(m in lowered for m in _UNCERTAINTY_MARKERS)
    depth_hits = sum(1 for m in _DEPTH_MARKERS if m in lowered)

    if is_non_answer:
        base = 12
    else:
        # Length is a weak proxy, so it is capped hard at 55 and the remaining
        # 40 points come only from reasoning markers and specificity.
        length_component = min(55, 20 + word_count * 0.55)
        depth_component = min(30, depth_hits * 7)
        specificity = min(10, sum(1 for w in words if any(c.isdigit() for c in w)) * 3)
        base = length_component + depth_component + specificity

    scores = []
    for competency in competencies:
        value = base
        if competency == "communication":
            # Structured writing reads as clearer communication.
            if any(marker in text for marker in ("\n-", "\n*", "1.", "First", "Second")):
                value += 8
        elif competency == "reasoning":
            value = base if depth_hits else base * 0.75
        elif competency == "confidence":
            # Calibrated uncertainty is rewarded; a non-answer is not.
            if admitted and not is_non_answer:
                value = max(value, 62)
            elif is_non_answer:
                value = 20
        scores.append(
            {
                "competency": competency,
                "score": int(max(0, min(100, round(value)))),
                "evidence": "Heuristic assessment (offline mode).",
            }
        )

    return {
        "scores": scores,
        "covered_points": [],
        "missing_points": [] if depth_hits >= 2 else ["explicit reasoning about trade-offs"],
        "misconceptions": [],
        "signal_quality": 30 if is_non_answer else min(85, 40 + word_count // 4),
        "is_non_answer": is_non_answer,
        "admitted_uncertainty": admitted,
        "notes": "Generated offline; scoring is heuristic rather than model-based.",
    }


def _render_report(hint: dict[str, Any]) -> str:
    name = hint.get("candidate_name", "the candidate")
    strong = hint.get("strong_areas") or []
    weak = hint.get("weak_areas") or []
    days = hint.get("recommended_days") or []

    summary = (
        f"{name} completed the interview across {hint.get('turns', 0)} questions "
        f"spanning {len(hint.get('topics', []))} curriculum areas. "
    )
    if strong:
        summary += f"The strongest signal came through on {strong[0]}. "
    if weak:
        summary += f"The clearest area to develop is {weak[0]}."

    return json.dumps(
        {
            "summary": summary.strip(),
            "strengths": [f"Demonstrated solid command of {s}" for s in strong[:3]]
            or ["Engaged consistently across every question asked"],
            "gaps": [f"Room to deepen {w}" for w in weak[:3]]
            or ["Add more explicit trade-off reasoning to technical explanations"],
            "next": [f"Revisit curriculum Day {d}" for d in days[:3]]
            or ["Re-run this interview after another practice cycle"],
            "recommendation_reason": "Scores aggregated from per-answer evidence.",
            "interviewer_note": "Report generated in offline mode.",
        }
    )


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

def render_local_response(
    *, system: str, messages: list[ChatMessage], json_mode: bool
) -> str:
    hint = read_hint(system)
    task = hint.get("task", "question")

    if task == "question":
        return _render_question(hint)

    if task == "evaluate":
        last_answer = next(
            (m.content for m in reversed(messages) if m.role == "user"), ""
        )
        competencies = hint.get("competencies") or [
            "technical_knowledge", "communication", "confidence"
        ]
        return json.dumps(_heuristic_scores(last_answer, competencies))

    if task == "report":
        return _render_report(hint)

    if task == "greeting":
        name = hint.get("candidate_name", "there")
        role = hint.get("job_role", "engineer")
        return (
            f"Hi {name} — thanks for making the time. I've had a look at your "
            f"cohort record, and I'll tailor this to what you actually worked "
            f"through rather than running a generic script for a {role}. "
            f"There's no trick here: think out loud, and if you're unsure of "
            f"something, say so and tell me how you'd find out. Ready when you are."
        )

    if json_mode:
        return "{}"
    return "Let's continue. Could you expand on your last point?"
