"""Request and response schemas.

Two API surfaces live side by side, and the separation is deliberate:

- `/api/interview` is the hackathon contract, byte-for-byte. It is frozen. No
  extra required fields, no renamed keys, no surprises for whatever harness
  grades it.
- `/api/v1/*` is the platform API our own frontend uses. It returns the rich
  state — live telemetry, per-turn reasoning, evidence profile — that makes the
  product feel intelligent.

Serving both from the same engine means the graded contract is exercised by
every single interview we run ourselves, rather than being a side path that
rots.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.models import Candidate


# ---------------------------------------------------------------------------
# Spec contract -- POST /api/interview
# ---------------------------------------------------------------------------

class SpecInterviewRequest(BaseModel):
    """The one request shape the specification defines.

    `candidate` is present only on the first call; `message` only on
    subsequent ones. Both are optional here because a single endpoint serves
    both phases -- the router disambiguates on which one is present.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    sessionId: str = Field(min_length=1, max_length=200)
    candidate: Candidate | None = None
    message: str | None = None

    @field_validator("sessionId")
    @classmethod
    def _clean_session_id(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("sessionId must not be empty")
        return v


class SpecFeedback(BaseModel):
    summary: str
    strengths: list[str]
    gaps: list[str]
    next: list[str]


class SpecInterviewResponse(BaseModel):
    """Exactly the fields the specification requires.

    `feedback` is excluded from serialisation until the interview is done, so
    intermediate responses are `{reply, done}` and nothing else.
    """

    model_config = ConfigDict(populate_by_name=True)

    reply: str
    done: bool
    feedback: SpecFeedback | None = None


# ---------------------------------------------------------------------------
# Platform API -- /api/v1
# ---------------------------------------------------------------------------

class StartInterviewRequest(BaseModel):
    candidate_id: str | None = Field(default=None, description="Use a seeded candidate")
    candidate: Candidate | None = Field(default=None, description="Or supply one inline")
    session_id: str | None = None


class TurnRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class InterviewerTurn(BaseModel):
    """One interviewer message plus the reasoning behind it.

    `reason` is the payload that makes adaptation visible. Shipping the
    controller's decision to the UI is what turns "the AI adapted" from a claim
    in a pitch deck into something the candidate can read on screen.
    """

    id: str
    content: str
    turn_index: int | None = None
    day: int | None = None
    day_title: str | None = None
    module_title: str | None = None
    competency: str | None = None
    difficulty: int | None = None
    difficulty_label: str | None = None
    action: str | None = None
    reason: str | None = None
    provider: str | None = None
    latency_ms: int | None = None


class CandidateTurn(BaseModel):
    id: str
    content: str
    turn_index: int | None = None
    score: int | None = None
    covered_points: list[str] = Field(default_factory=list)
    missing_points: list[str] = Field(default_factory=list)
    flagged: bool = False


class LiveState(BaseModel):
    turn: int
    planned_turns: int
    answered: int
    progress: float
    readiness: int
    difficulty: int
    difficulty_label: str
    current_day: int | None = None
    current_topic: str | None = None
    current_module: str | None = None
    competency_signal: dict[str, int] = Field(default_factory=dict)
    topics_covered: list[int] = Field(default_factory=list)
    status: str


class ProfileSummary(BaseModel):
    candidate_id: str
    candidate_name: str
    job_role: str
    years_experience: int
    education: str
    seniority_band: str
    headline: str
    consistency: float
    fluency: float
    coverage: float
    baseline_difficulty: int
    mastered_days: list[int]
    struggled_days: list[int]
    failed_days: list[int]
    skipped_days: list[int]
    strategy_notes: list[str]


class PlannedProbe(BaseModel):
    index: int
    day: int
    day_title: str
    module_title: str
    competency: str
    difficulty: int
    difficulty_label: str
    evidence: str
    rationale: str


class InterviewStateResponse(BaseModel):
    session_id: str
    status: str
    done: bool
    profile: ProfileSummary
    plan: list[PlannedProbe]
    live: LiveState
    messages: list[dict[str, Any]]
    report: dict[str, Any] | None = None


class TurnResponse(BaseModel):
    session_id: str
    done: bool
    reply: str
    turn: InterviewerTurn | None = None
    evaluation: CandidateTurn | None = None
    live: LiveState
    report: dict[str, Any] | None = None


class CandidateListItem(BaseModel):
    id: str
    name: str
    job_role: str
    years_experience: int
    education: str
    seniority_band: str
    headline: str
    coverage: float
    fluency: float
    consistency: float
    missions_completed: int
    skipped_count: int
    eligible_topics: int


class CurriculumDayOut(BaseModel):
    day: int
    title: str
    type: str
    module: str
    tools: list[str]
    objectives: list[str]


class HealthResponse(BaseModel):
    status: str
    environment: str
    persistence: str
    providers: list[str]
    breakers: dict[str, str]
    prompt_version: str
    curriculum_days: int
    candidates: int
    longitudinal_memory: str = "disabled"
