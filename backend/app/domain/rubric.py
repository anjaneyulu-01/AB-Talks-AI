"""The scoring rubric.

This module is why the final numbers mean something. Three principles:

1. **Weights depend on the role.** Scoring a Marketing Manager who completed an
   AI cohort on the same architecture weighting as a Principal Architect is not
   rigour, it is a category error. Both took the same course; they are not
   preparing for the same interview.

2. **Aggregation is arithmetic, not opinion.** The model scores individual
   answers against explicit anchors. Python averages them. No LLM is ever asked
   "so what's the overall score?" -- that question invites a vibe.

3. **Recency is weighted, but gently.** A candidate who finds their footing by
   turn 8 should be rewarded for it, without letting one strong closing answer
   erase five weak ones.
"""

from __future__ import annotations

from app.domain.enums import Competency, Difficulty, HiringRecommendation

# ---------------------------------------------------------------------------
# Scoring anchors -- handed to the evaluator verbatim so the model and the
# report agree on what a number means.
# ---------------------------------------------------------------------------

SCORE_ANCHORS: dict[str, str] = {
    "90-100": (
        "Exceptional. Correct, specific, and reasoned. Volunteers trade-offs or "
        "failure modes without being asked. A senior engineer would learn "
        "something or nod along."
    ),
    "75-89": (
        "Strong. Correct and well-structured with concrete detail. Minor gaps or "
        "an unexplored trade-off, but no misconceptions."
    ),
    "60-74": (
        "Competent. Broadly correct with real understanding, but generic in "
        "places, thin on specifics, or missing an important consideration."
    ),
    "40-59": (
        "Developing. Partial understanding. Right vocabulary, shaky mechanics, "
        "or a correct conclusion reached by an unreliable route."
    ),
    "20-39": (
        "Emerging. A recognisable attempt with a material misconception, or "
        "surface recall with no underlying model."
    ),
    "0-19": (
        "No usable signal. Off-topic, empty, or a refusal to engage. Note: an "
        "honest 'I don't know, here's how I'd find out' is NOT a zero -- score "
        "confidence and communication on their merits."
    ),
}

# ---------------------------------------------------------------------------
# Role-aware competency weights
# ---------------------------------------------------------------------------

_ENGINEERING_ROLE_MARKERS = (
    "engineer", "developer", "architect", "programmer", "sre", "devops",
    "data scientist", "scientist", "intern",
)

_ARCHITECT_ROLE_MARKERS = ("architect", "principal", "staff", "distinguished", "lead")

# Baseline: what a generic technical interview cares about.
_DEFAULT_WEIGHTS: dict[Competency, float] = {
    Competency.TECHNICAL_KNOWLEDGE: 0.25,
    Competency.ARCHITECTURE: 0.18,
    Competency.PROBLEM_SOLVING: 0.20,
    Competency.COMMUNICATION: 0.14,
    Competency.REASONING: 0.15,
    Competency.CONFIDENCE: 0.08,
}

# Senior IC / architect: systems thinking dominates. They are hired for
# judgement about structure, not for recalling an API signature.
_ARCHITECT_WEIGHTS: dict[Competency, float] = {
    Competency.TECHNICAL_KNOWLEDGE: 0.18,
    Competency.ARCHITECTURE: 0.30,
    Competency.PROBLEM_SOLVING: 0.20,
    Competency.COMMUNICATION: 0.12,
    Competency.REASONING: 0.15,
    Competency.CONFIDENCE: 0.05,
}

# Entry level: we are measuring trajectory, not accumulated depth. Reasoning
# and communication predict growth far better than current knowledge does.
_ENTRY_WEIGHTS: dict[Competency, float] = {
    Competency.TECHNICAL_KNOWLEDGE: 0.22,
    Competency.ARCHITECTURE: 0.10,
    Competency.PROBLEM_SOLVING: 0.22,
    Competency.COMMUNICATION: 0.18,
    Competency.REASONING: 0.18,
    Competency.CONFIDENCE: 0.10,
}

# Non-engineering roles who completed the AI cohort (Marketing, HR, BA, UX).
# They are being assessed on applied AI literacy and their ability to reason
# about and communicate these systems -- which is genuinely their job.
_NON_ENGINEERING_WEIGHTS: dict[Competency, float] = {
    Competency.TECHNICAL_KNOWLEDGE: 0.20,
    Competency.ARCHITECTURE: 0.08,
    Competency.PROBLEM_SOLVING: 0.20,
    Competency.COMMUNICATION: 0.26,
    Competency.REASONING: 0.18,
    Competency.CONFIDENCE: 0.08,
}


def is_engineering_role(job_role: str) -> bool:
    role = job_role.lower()
    return any(marker in role for marker in _ENGINEERING_ROLE_MARKERS)


def seniority_band(job_role: str, years: int) -> str:
    """Band a candidate by title first, tenure second.

    Title wins because it is the stronger signal: 'Principal Architect' at 20
    years and 'IT Support Specialist' at 20 years are not the same interview,
    and tenure alone cannot tell them apart.
    """
    role = job_role.lower()
    if any(m in role for m in ("distinguished", "principal", "staff")):
        return "principal"
    if "senior" in role or "lead" in role or "architect" in role:
        return "senior"
    if years >= 12:
        return "senior"
    if years >= 4:
        return "mid"
    return "entry"


def weights_for(job_role: str, years: int) -> dict[Competency, float]:
    band = seniority_band(job_role, years)
    if not is_engineering_role(job_role):
        return dict(_NON_ENGINEERING_WEIGHTS)
    role = job_role.lower()
    if band in ("principal", "senior") and any(m in role for m in _ARCHITECT_ROLE_MARKERS):
        return dict(_ARCHITECT_WEIGHTS)
    if band == "entry":
        return dict(_ENTRY_WEIGHTS)
    return dict(_DEFAULT_WEIGHTS)


# ---------------------------------------------------------------------------
# Which competencies a given difficulty can actually measure
# ---------------------------------------------------------------------------
# A "define embeddings" question cannot measure architecture. Asking the
# evaluator to score it anyway produces noise that then pollutes the average --
# so the planner only assigns competencies a difficulty can genuinely surface.

DIFFICULTY_COMPETENCIES: dict[Difficulty, tuple[Competency, ...]] = {
    Difficulty.FOUNDATIONAL: (
        Competency.TECHNICAL_KNOWLEDGE,
        Competency.COMMUNICATION,
        Competency.CONFIDENCE,
    ),
    Difficulty.APPLIED: (
        Competency.TECHNICAL_KNOWLEDGE,
        Competency.PROBLEM_SOLVING,
        Competency.COMMUNICATION,
        Competency.CONFIDENCE,
    ),
    Difficulty.ANALYTICAL: (
        Competency.TECHNICAL_KNOWLEDGE,
        Competency.REASONING,
        Competency.PROBLEM_SOLVING,
        Competency.COMMUNICATION,
        Competency.CONFIDENCE,
    ),
    Difficulty.DESIGN: (
        Competency.ARCHITECTURE,
        Competency.REASONING,
        Competency.PROBLEM_SOLVING,
        Competency.COMMUNICATION,
        Competency.CONFIDENCE,
    ),
    Difficulty.ADVERSARIAL: (
        Competency.ARCHITECTURE,
        Competency.REASONING,
        Competency.TECHNICAL_KNOWLEDGE,
        Competency.PROBLEM_SOLVING,
        Competency.CONFIDENCE,
    ),
}


# ---------------------------------------------------------------------------
# Bands and thresholds
# ---------------------------------------------------------------------------

def band_for_score(score: float) -> str:
    if score >= 85:
        return "exceptional"
    if score >= 70:
        return "strong"
    if score >= 50:
        return "developing"
    return "emerging"


# Recommendation thresholds shift with seniority: 72 is a strong result for an
# intern and a mediocre one for a Distinguished Engineer. A fixed cut-off would
# systematically over-reward the experienced and punish the junior.
_RECOMMENDATION_CUTOFFS: dict[str, tuple[int, int, int]] = {
    # band: (strong_hire, hire, lean_hire)
    "entry": (78, 63, 48),
    "mid": (82, 68, 53),
    "senior": (85, 72, 58),
    "principal": (88, 75, 62),
}


def recommend(score: float, band: str) -> HiringRecommendation:
    strong, hire, lean = _RECOMMENDATION_CUTOFFS.get(band, _RECOMMENDATION_CUTOFFS["mid"])
    if score >= strong:
        return HiringRecommendation.STRONG_HIRE
    if score >= hire:
        return HiringRecommendation.HIRE
    if score >= lean:
        return HiringRecommendation.LEAN_HIRE
    return HiringRecommendation.NOT_YET


# ---------------------------------------------------------------------------
# Recency weighting
# ---------------------------------------------------------------------------
# Later turns count slightly more: an interview is partly a warm-up, and a
# candidate who settles in deserves credit. Capped at 1.5x so a strong finish
# cannot paper over a weak body of work.

def recency_weight(turn_position: int, total_turns: int) -> float:
    if total_turns <= 1:
        return 1.0
    progress = turn_position / (total_turns - 1)
    return 1.0 + 0.5 * progress


# ---------------------------------------------------------------------------
# Live confidence indicator
# ---------------------------------------------------------------------------
# Shown to the candidate during the interview. Deliberately smoothed and
# floored: a live number that craters after one weak answer would do the exact
# opposite of the "build confidence throughout" principle. It rises quickly and
# falls slowly, and it never renders below 25.

def live_readiness(scores: list[float]) -> int:
    if not scores:
        return 50
    weighted, total = 0.0, 0.0
    for i, s in enumerate(scores):
        w = 1.0 + 0.35 * i
        weighted += s * w
        total += w
    raw = weighted / total
    return max(25, min(99, round(raw)))
