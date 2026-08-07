"""Domain vocabulary.

These enums are the shared language between the deterministic policy engines,
the LLM prompts, and the frontend. Defining them once, here, is what stops the
system from drifting into three slightly different ideas of "difficulty".
"""

from __future__ import annotations

from enum import Enum


class Competency(str, Enum):
    """The six axes every answer is scored on.

    Chosen to match what the final report must contain, and deliberately
    including two axes that most interview tools ignore:

    - `reasoning`: did they think, or did they recall? A candidate can know the
      right answer for the wrong reason, and that predicts on-the-job failure.
    - `confidence`: calibration, not bravado. Saying "I don't know, but here's
      how I'd find out" scores *well* here. Bluffing scores badly.
    """

    TECHNICAL_KNOWLEDGE = "technical_knowledge"
    ARCHITECTURE = "architecture"
    PROBLEM_SOLVING = "problem_solving"
    COMMUNICATION = "communication"
    REASONING = "reasoning"
    CONFIDENCE = "confidence"

    @property
    def label(self) -> str:
        return _COMPETENCY_LABELS[self]

    @property
    def description(self) -> str:
        return _COMPETENCY_DESCRIPTIONS[self]


_COMPETENCY_LABELS: dict[Competency, str] = {
    Competency.TECHNICAL_KNOWLEDGE: "Technical Knowledge",
    Competency.ARCHITECTURE: "Architecture",
    Competency.PROBLEM_SOLVING: "Problem Solving",
    Competency.COMMUNICATION: "Communication",
    Competency.REASONING: "Reasoning",
    Competency.CONFIDENCE: "Confidence",
}

_COMPETENCY_DESCRIPTIONS: dict[Competency, str] = {
    Competency.TECHNICAL_KNOWLEDGE: (
        "Command of the concepts, tools and mechanics the answer depends on. "
        "Accuracy of specifics, not breadth of buzzwords."
    ),
    Competency.ARCHITECTURE: (
        "Ability to reason about systems: component boundaries, data flow, "
        "trade-offs, failure modes and what happens at scale."
    ),
    Competency.PROBLEM_SOLVING: (
        "How the candidate approaches an unfamiliar or under-specified problem: "
        "decomposition, prioritisation, and choosing a workable path."
    ),
    Competency.COMMUNICATION: (
        "Clarity and structure. Could a teammate act on this explanation "
        "without a follow-up meeting?"
    ),
    Competency.REASONING: (
        "Depth of the 'why'. Justified choices and acknowledged trade-offs "
        "rather than recalled conclusions."
    ),
    Competency.CONFIDENCE: (
        "Calibration. Certainty proportional to actual knowledge. Naming a "
        "limit and a way to resolve it scores highly; bluffing does not."
    ),
}


class Difficulty(int, Enum):
    """Five rungs, so the controller can move by a real integer.

    Anchored to observable behaviour rather than adjectives, because "medium"
    means nothing to a prompt.
    """

    FOUNDATIONAL = 1   # Define it. Recall it.
    APPLIED = 2        # Use it in a concrete task.
    ANALYTICAL = 3     # Compare options and justify a choice.
    DESIGN = 4         # Architect something end to end under constraints.
    ADVERSARIAL = 5    # Break it. Scale it. Handle the failure mode.

    @property
    def label(self) -> str:
        return _DIFFICULTY_LABELS[self]

    @property
    def intent(self) -> str:
        return _DIFFICULTY_INTENT[self]

    def shifted(self, delta: int) -> "Difficulty":
        return Difficulty(min(5, max(1, self.value + delta)))


_DIFFICULTY_LABELS: dict[Difficulty, str] = {
    Difficulty.FOUNDATIONAL: "Foundational",
    Difficulty.APPLIED: "Applied",
    Difficulty.ANALYTICAL: "Analytical",
    Difficulty.DESIGN: "Design",
    Difficulty.ADVERSARIAL: "Adversarial",
}

_DIFFICULTY_INTENT: dict[Difficulty, str] = {
    Difficulty.FOUNDATIONAL: (
        "Ask them to explain the concept in their own words. Checking that the "
        "mental model exists at all."
    ),
    Difficulty.APPLIED: (
        "Ask how they used it, or would use it, on a concrete task. Checking "
        "that knowledge survives contact with practice."
    ),
    Difficulty.ANALYTICAL: (
        "Ask them to compare two viable options and defend a choice. Checking "
        "for judgement rather than recall."
    ),
    Difficulty.DESIGN: (
        "Give them a realistic constraint and ask them to design the approach "
        "end to end. Checking systems thinking."
    ),
    Difficulty.ADVERSARIAL: (
        "Introduce scale, failure, cost or an edge case that breaks the naive "
        "answer. Checking depth under pressure."
    ),
}


class EvidenceStrength(str, Enum):
    """What the candidate's mission record says about a single topic.

    This is the single most important derived value in the product. It is what
    turns a mission log into an interview strategy.
    """

    MASTERED = "mastered"        # passed first try -> probe deep
    SOLID = "solid"              # passed in 2-3 -> probe normally
    STRUGGLED = "struggled"      # passed in 4-5 -> verify the fundamentals stuck
    FAILED = "failed"            # attempted, did not pass -> diagnose, don't punish
    SKIPPED = "skipped"          # never attempted -> OFF LIMITS as a question source
    NOT_ATTEMPTED = "not_attempted"  # not in their record at all -> off limits

    @property
    def is_questionable(self) -> bool:
        """Whether this topic may be used to generate an interview question.

        Skipped and never-attempted content is excluded, permanently. Asking a
        candidate about material they never saw is not a hard question -- it is
        an unfair one, and it is the fastest way to destroy the trust the whole
        product depends on.
        """
        return self in {
            EvidenceStrength.MASTERED,
            EvidenceStrength.SOLID,
            EvidenceStrength.STRUGGLED,
            EvidenceStrength.FAILED,
        }

    @property
    def base_difficulty(self) -> Difficulty:
        return {
            EvidenceStrength.MASTERED: Difficulty.DESIGN,
            EvidenceStrength.SOLID: Difficulty.ANALYTICAL,
            EvidenceStrength.STRUGGLED: Difficulty.APPLIED,
            EvidenceStrength.FAILED: Difficulty.FOUNDATIONAL,
        }.get(self, Difficulty.APPLIED)

    @property
    def interviewer_note(self) -> str:
        """Guidance handed to the question generator alongside the topic."""
        return {
            EvidenceStrength.MASTERED: (
                "They cleared this on the first attempt. Do not ask them to "
                "define it -- that wastes their time. Go straight to trade-offs, "
                "scale, or failure modes."
            ),
            EvidenceStrength.SOLID: (
                "They cleared this in a couple of attempts. Solid ground. Ask "
                "them to apply it or compare it against an alternative."
            ),
            EvidenceStrength.STRUGGLED: (
                "This took them four or five attempts. Something was hard here. "
                "Check whether the underlying model actually landed, rather than "
                "the surface procedure. Be warm about it."
            ),
            EvidenceStrength.FAILED: (
                "They attempted this and did not pass. Treat it as a diagnostic, "
                "not a gotcha. Ask an accessible question that reveals where the "
                "understanding breaks, and be encouraging about the attempt."
            ),
        }.get(self, "")


class ControllerAction(str, Enum):
    """The move the interview controller decides to make next.

    Every one of these carries a human-readable reason to the UI. Showing the
    candidate *why* the interview just did what it did is what makes the
    adaptation feel intelligent instead of random.
    """

    OPEN = "open"                # first substantive question
    ADVANCE = "advance"          # new topic at the planned difficulty
    FOLLOW_UP = "follow_up"      # same topic, chase a specific missing piece
    DRILL_DOWN = "drill_down"    # same topic, harder -- they cleared it easily
    EASE_OFF = "ease_off"        # same topic, simpler -- rebuild footing
    PIVOT = "pivot"              # abandon topic, move on -- two weak turns here
    CLOSE = "close"              # wrap up and produce the report


class SessionStatus(str, Enum):
    CREATED = "created"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class Role(str, Enum):
    INTERVIEWER = "interviewer"
    CANDIDATE = "candidate"
    SYSTEM = "system"


class HiringRecommendation(str, Enum):
    STRONG_HIRE = "strong_hire"
    HIRE = "hire"
    LEAN_HIRE = "lean_hire"
    NOT_YET = "not_yet"

    @property
    def label(self) -> str:
        return {
            HiringRecommendation.STRONG_HIRE: "Strong Hire",
            HiringRecommendation.HIRE: "Hire",
            HiringRecommendation.LEAN_HIRE: "Lean Hire",
            HiringRecommendation.NOT_YET: "Not Yet",
        }[self]

    @property
    def blurb(self) -> str:
        """Deliberately growth-framed. 'Not Yet' is a stage, not a verdict."""
        return {
            HiringRecommendation.STRONG_HIRE: (
                "Interview-ready now. Depth and communication both held up "
                "under pressure."
            ),
            HiringRecommendation.HIRE: (
                "Interview-ready for most teams. A little polish on the weaker "
                "axes would make this comfortable rather than close."
            ),
            HiringRecommendation.LEAN_HIRE: (
                "Close. The foundations are there and the gaps are specific "
                "enough to fix in weeks, not months."
            ),
            HiringRecommendation.NOT_YET: (
                "Not interview-ready yet -- and the roadmap below is exactly "
                "what closes that gap. Everyone starts here."
            ),
        }[self]


class ProviderName(str, Enum):
    # Groq (fast inference host) and Grok (xAI's model) are different products
    # with confusingly similar names. Both are supported; both are listed here
    # explicitly so a log line is never ambiguous about which one served.
    GROQ = "groq"
    GROK = "grok"
    GEMINI = "gemini"
    LOCAL = "local"
