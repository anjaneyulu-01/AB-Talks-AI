"""Domain models.

These mirror `curriculum.json` and `candidates.json` field-for-field. Where the
supplied data is loose (`passed` and `attempts` are absent on skipped missions)
the model stays loose too and the *derived* layer does the interpreting. We do
not invent fields on the source objects.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.domain.enums import (
    Competency,
    ControllerAction,
    Difficulty,
    EvidenceStrength,
    HiringRecommendation,
    ProviderName,
    Role,
    SessionStatus,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=False,
        str_strip_whitespace=True,
    )


# ---------------------------------------------------------------------------
# Curriculum -- shape defined by curriculum.json
# ---------------------------------------------------------------------------

class CurriculumModule(Base):
    n: int
    title: str
    # Source encodes an inclusive [start, end] day range, not a list of days.
    days: list[int]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def day_start(self) -> int:
        return self.days[0]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def day_end(self) -> int:
        return self.days[-1]

    def contains(self, day: int) -> bool:
        return self.day_start <= day <= self.day_end


class CurriculumDay(Base):
    day: int
    title: str
    # SETUP | BUILD | AI_CORE | SHIP_IT | LEARN | OPTIMIZE | CAPSTONE
    type: str
    tools: list[str] = Field(default_factory=list)
    objectives: list[str] = Field(default_factory=list)


class Curriculum(Base):
    cohort: str
    modules: list[CurriculumModule]
    days: list[CurriculumDay]

    def day_by_number(self, day: int) -> CurriculumDay | None:
        return next((d for d in self.days if d.day == day), None)

    def module_for_day(self, day: int) -> CurriculumModule | None:
        return next((m for m in self.modules if m.contains(day)), None)


# ---------------------------------------------------------------------------
# Candidate -- shape defined by candidates.json
# ---------------------------------------------------------------------------

class CandidateMember(Base):
    id: str
    name: str
    jobRole: str
    yearsExperience: int
    education: str
    status: str


class Mission(Base):
    """One mission record.

    `passed`/`attempts` are absent when `skipped` is true -- that asymmetry is
    in the source data and we preserve it rather than defaulting it away, so
    "skipped" stays distinguishable from "failed with 0 attempts".
    """

    day: int
    title: str
    passed: bool | None = None
    attempts: int | None = None
    skipped: bool | None = None


class CandidateSignals(Base):
    commitDays: int
    missionsCompleted: int
    missionsFirstTry: int


class Candidate(Base):
    member: CandidateMember
    missions: list[Mission] = Field(default_factory=list)
    signals: CandidateSignals

    @property
    def id(self) -> str:
        return self.member.id

    @property
    def name(self) -> str:
        return self.member.name

    @property
    def first_name(self) -> str:
        return self.member.name.split()[0]


# ---------------------------------------------------------------------------
# Derived: the evidence profile
# ---------------------------------------------------------------------------

class TopicEvidence(Base):
    """What we know about one candidate on one curriculum day."""

    day: int
    title: str
    module_n: int
    module_title: str
    day_type: str
    tools: list[str] = Field(default_factory=list)
    objectives: list[str] = Field(default_factory=list)

    strength: EvidenceStrength
    attempts: int | None = None
    passed: bool | None = None

    @property
    def is_questionable(self) -> bool:
        return self.strength.is_questionable


class EvidenceProfile(Base):
    """The deterministic read of a candidate, computed before a single token
    of LLM context is built. This is the interview's strategy document."""

    candidate_id: str
    candidate_name: str
    job_role: str
    years_experience: int
    education: str

    topics: list[TopicEvidence] = Field(default_factory=list)

    # Derived scalars, all in 0..1 unless noted.
    consistency: float           # commitDays / 31
    fluency: float               # missionsFirstTry / missionsCompleted
    coverage: float              # missionsCompleted / 31
    friction: float              # 1 - fluency; how hard the cohort was for them

    # Fluency split by domain. None when the candidate attempted nothing in
    # that group -- absence of evidence, not a score of zero. A large gap
    # between these two is the single most actionable signal in the profile.
    ai_fluency: float | None = None        # modules 3, 4, 6
    classic_fluency: float | None = None   # modules 1, 2, 7, 8

    baseline_difficulty: Difficulty
    seniority_band: str          # entry | mid | senior | principal
    is_engineering_role: bool

    mastered_days: list[int] = Field(default_factory=list)
    struggled_days: list[int] = Field(default_factory=list)
    failed_days: list[int] = Field(default_factory=list)
    skipped_days: list[int] = Field(default_factory=list)

    # Plain-language sentences the UI shows and the prompt reuses verbatim.
    headline: str = ""
    strategy_notes: list[str] = Field(default_factory=list)

    @property
    def questionable_topics(self) -> list[TopicEvidence]:
        return [t for t in self.topics if t.is_questionable]


# ---------------------------------------------------------------------------
# The plan
# ---------------------------------------------------------------------------

class Probe(Base):
    """One planned question slot.

    Bound to a real curriculum day and objective *before* the LLM is involved.
    This binding is what guarantees we never drift off-syllabus, never repeat a
    topic, and can always tell the candidate exactly why a question was asked.
    """

    index: int
    day: int
    day_title: str
    module_title: str
    objective: str
    tools: list[str] = Field(default_factory=list)
    competency: Competency
    difficulty: Difficulty
    evidence: EvidenceStrength
    rationale: str


class InterviewPlan(Base):
    probes: list[Probe] = Field(default_factory=list)
    target_turns: int
    opening_note: str = ""


# ---------------------------------------------------------------------------
# Turns, evaluation, session
# ---------------------------------------------------------------------------

class CompetencyScore(Base):
    competency: Competency
    score: int = Field(ge=0, le=100)
    evidence: str = ""


class TurnEvaluation(Base):
    """The evaluator's structured read of a single answer.

    Bounded integers by construction: even a wholly successful prompt injection
    cannot write prose into `score`, and cannot reach the aggregate because the
    reporter computes that itself.
    """

    scores: list[CompetencyScore] = Field(default_factory=list)
    covered_points: list[str] = Field(default_factory=list)
    missing_points: list[str] = Field(default_factory=list)
    misconceptions: list[str] = Field(default_factory=list)
    signal_quality: int = Field(default=50, ge=0, le=100)
    is_non_answer: bool = False
    admitted_uncertainty: bool = False
    notes: str = ""

    @property
    def overall(self) -> float:
        if not self.scores:
            return 0.0
        return sum(s.score for s in self.scores) / len(self.scores)

    def score_for(self, competency: Competency) -> int | None:
        for s in self.scores:
            if s.competency == competency:
                return s.score
        return None


class Message(Base):
    id: str
    session_id: str
    role: Role
    content: str
    created_at: datetime = Field(default_factory=utcnow)

    # Interviewer-turn metadata -- powers the live UI rail.
    turn_index: int | None = None
    probe_index: int | None = None
    day: int | None = None
    day_title: str | None = None
    module_title: str | None = None
    competency: Competency | None = None
    difficulty: Difficulty | None = None
    action: ControllerAction | None = None
    reason: str | None = None
    provider: ProviderName | None = None
    latency_ms: int | None = None

    # Candidate-turn metadata.
    evaluation: TurnEvaluation | None = None
    flagged: bool = False


class ProviderCall(Base):
    provider: ProviderName
    model: str
    purpose: str
    latency_ms: int
    ok: bool
    error: str | None = None
    fell_back_from: ProviderName | None = None
    created_at: datetime = Field(default_factory=utcnow)


class InterviewSession(Base):
    session_id: str
    candidate: Candidate
    profile: EvidenceProfile
    plan: InterviewPlan
    status: SessionStatus = SessionStatus.CREATED

    turn_index: int = 0
    probe_cursor: int = 0
    current_difficulty: Difficulty = Difficulty.APPLIED
    consecutive_weak_turns: int = 0
    follow_ups_on_current_probe: int = 0

    # Topic ids already used. A set in code, a list on the wire.
    consumed_days: list[int] = Field(default_factory=list)

    messages: list[Message] = Field(default_factory=list)
    evaluations: list[TurnEvaluation] = Field(default_factory=list)
    provider_calls: list[ProviderCall] = Field(default_factory=list)

    report: "FeedbackReport | None" = None

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    completed_at: datetime | None = None

    @property
    def is_complete(self) -> bool:
        return self.status == SessionStatus.COMPLETED

    @property
    def current_probe(self) -> Probe | None:
        if 0 <= self.probe_cursor < len(self.plan.probes):
            return self.plan.probes[self.probe_cursor]
        return None

    @property
    def answered_turns(self) -> int:
        return len(self.evaluations)

    def transcript(self) -> list[Message]:
        return [m for m in self.messages if m.role in (Role.INTERVIEWER, Role.CANDIDATE)]


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

class RoadmapStep(Base):
    order: int
    title: str
    why: str
    curriculum_days: list[int] = Field(default_factory=list)
    est_effort: str = ""
    resources: list[str] = Field(default_factory=list)


class ScoreBreakdown(Base):
    competency: Competency
    score: int = Field(ge=0, le=100)
    band: str                       # exceptional | strong | developing | emerging
    summary: str = ""
    # Turn indices that produced this score -- the report is auditable.
    evidence_turns: list[int] = Field(default_factory=list)


class FeedbackReport(Base):
    session_id: str
    candidate_id: str
    candidate_name: str

    overall_score: int = Field(ge=0, le=100)
    recommendation: HiringRecommendation
    recommendation_reason: str = ""

    breakdown: list[ScoreBreakdown] = Field(default_factory=list)

    # --- Fields required verbatim by the technical specification -----------
    summary: str = ""
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    next: list[str] = Field(default_factory=list)
    # ----------------------------------------------------------------------

    roadmap: list[RoadmapStep] = Field(default_factory=list)
    recommended_days: list[int] = Field(default_factory=list)

    topics_covered: list[dict[str, Any]] = Field(default_factory=list)
    interviewer_note: str = ""

    turns_taken: int = 0
    duration_seconds: int = 0
    generated_at: datetime = Field(default_factory=utcnow)

    def to_spec_feedback(self) -> dict[str, Any]:
        """The exact object the hackathon spec requires in the final response."""
        return {
            "summary": self.summary,
            "strengths": self.strengths,
            "gaps": self.gaps,
            "next": self.next,
        }


InterviewSession.model_rebuild()
