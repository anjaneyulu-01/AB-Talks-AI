/**
 * API types, mirroring the backend Pydantic schemas.
 *
 * Hand-written rather than generated: the surface is small enough that a
 * generator would be more machinery than it saves, and these carry doc
 * comments explaining what the fields *mean*, which a generator cannot.
 */

export type Competency =
  | 'technical_knowledge'
  | 'architecture'
  | 'problem_solving'
  | 'communication'
  | 'reasoning'
  | 'confidence'

export type ControllerAction =
  | 'open'
  | 'advance'
  | 'follow_up'
  | 'drill_down'
  | 'ease_off'
  | 'pivot'
  | 'close'

export type EvidenceStrength =
  | 'mastered'
  | 'solid'
  | 'struggled'
  | 'failed'
  | 'skipped'
  | 'not_attempted'

export type Recommendation = 'strong_hire' | 'hire' | 'lean_hire' | 'not_yet'

export type ScoreBand = 'exceptional' | 'strong' | 'developing' | 'emerging'

/** The candidate's evidence profile, derived from their cohort record. */
export interface ProfileSummary {
  candidate_id: string
  candidate_name: string
  job_role: string
  years_experience: number
  education: string
  seniority_band: string
  headline: string
  consistency: number
  fluency: number
  coverage: number
  baseline_difficulty: number
  mastered_days: number[]
  struggled_days: number[]
  failed_days: number[]
  /** Never used as question material. Shown so the candidate knows it's off the table. */
  skipped_days: number[]
  strategy_notes: string[]
}

/** One slot in the pre-computed question plan. */
export interface PlannedProbe {
  index: number
  day: number
  day_title: string
  module_title: string
  competency: Competency
  difficulty: number
  difficulty_label: string
  evidence: EvidenceStrength
  /** Why this question exists — surfaced to the candidate verbatim. */
  rationale: string
}

/** Live telemetry rendered in the interview side rail. */
export interface LiveState {
  turn: number
  planned_turns: number
  answered: number
  progress: number
  /** Smoothed and floored at 25 — never tells someone mid-interview they've failed. */
  readiness: number
  difficulty: number
  difficulty_label: string
  current_day: number | null
  current_topic: string | null
  current_module: string | null
  competency_signal: Partial<Record<Competency, number>>
  topics_covered: number[]
  status: string
}

export interface InterviewerMessage {
  role: 'interviewer'
  id: string
  content: string
  turn_index: number | null
  day: number | null
  day_title: string | null
  module_title: string | null
  competency: Competency | null
  difficulty: number | null
  difficulty_label: string | null
  action: ControllerAction | null
  /** The controller's decision, in plain language. */
  reason: string | null
  provider: string | null
  latency_ms: number | null
}

export interface CandidateMessage {
  role: 'candidate'
  id: string
  content: string
  turn_index: number | null
  score: number | null
  covered_points: string[]
  missing_points: string[]
  flagged: boolean
}

export type TranscriptMessage = InterviewerMessage | CandidateMessage

export interface ScoreBreakdown {
  competency: Competency
  score: number
  band: ScoreBand
  summary: string
  /** Turn numbers that produced this score — the report is auditable. */
  evidence_turns: number[]
}

export interface RoadmapStep {
  order: number
  title: string
  why: string
  curriculum_days: number[]
  est_effort: string
  resources: string[]
}

export interface TopicCovered {
  turn: number
  day: number
  title: string
  module: string
  difficulty: string
  competency: string
  score: number
}

export interface FeedbackReport {
  session_id: string
  candidate_id: string
  candidate_name: string
  overall_score: number
  recommendation: Recommendation
  recommendation_reason: string
  breakdown: ScoreBreakdown[]
  /** The four fields the technical specification requires verbatim. */
  summary: string
  strengths: string[]
  gaps: string[]
  next: string[]
  roadmap: RoadmapStep[]
  recommended_days: number[]
  topics_covered: TopicCovered[]
  interviewer_note: string
  turns_taken: number
  duration_seconds: number
  generated_at: string
}

export interface InterviewState {
  session_id: string
  status: string
  done: boolean
  profile: ProfileSummary
  plan: PlannedProbe[]
  live: LiveState
  messages: TranscriptMessage[]
  report: FeedbackReport | null
}

export interface TurnResponse {
  session_id: string
  done: boolean
  reply: string
  turn: Omit<InterviewerMessage, 'role'> | null
  evaluation: Omit<CandidateMessage, 'role'> | null
  live: LiveState
  report: FeedbackReport | null
}

export interface CandidateListItem {
  id: string
  name: string
  job_role: string
  years_experience: number
  education: string
  seniority_band: string
  headline: string
  coverage: number
  fluency: number
  consistency: number
  missions_completed: number
  skipped_count: number
  eligible_topics: number
}

export interface EvidenceTopic {
  day: number
  title: string
  module: string
  type: string
  strength: EvidenceStrength
  attempts: number | null
  passed: boolean | null
  eligible: boolean
}

export interface CandidateProfileResponse {
  candidate: unknown
  profile: ProfileSummary
  planned_probes: PlannedProbe[]
  evidence: EvidenceTopic[]
  distribution: Record<EvidenceStrength, number>
}

export interface CurriculumDay {
  day: number
  title: string
  type: string
  module: string
  tools: string[]
  objectives: string[]
}

export interface CurriculumResponse {
  cohort: string
  modules: { n: number; title: string; day_start: number; day_end: number; day_count: number }[]
  days: CurriculumDay[]
}

export interface HistoryResponse {
  candidate_id: string
  total_interviews: number
  completed: number
  best_score: number | null
  latest_score: number | null
  trend: {
    session_id: string
    date: string
    overall: number
    recommendation: Recommendation
    turns: number
    breakdown: Partial<Record<Competency, number>>
  }[]
  sessions: {
    session_id: string
    status: string
    created_at: string
    turns: number
    planned_turns: number
    overall: number | null
    topics: number[]
  }[]
}

export interface HealthResponse {
  status: string
  environment: string
  persistence: string
  providers: string[]
  breakers: Record<string, string>
  prompt_version: string
  curriculum_days: number
  candidates: number
}
