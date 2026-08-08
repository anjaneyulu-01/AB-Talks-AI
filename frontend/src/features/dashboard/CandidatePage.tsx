import { useMutation, useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarDays,
  Flame,
  Lightbulb,
  ListChecks,
  Play,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { GradientAvatar, GradientTile } from '@/components/ui/GradientTile'
import { CountUp } from '@/components/ui/ScoreRing'
import { CohortJourney } from '@/features/dashboard/CohortJourney'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  EmptyState,
  Skeleton,
  Tooltip,
} from '@/components/ui/primitives'
import { api, ApiError } from '@/lib/api'
import { cardGradient, DIFFICULTY_GRADIENT, DIFFICULTY_TINT } from '@/lib/categoryColors'
import type { EvidenceTopic, PlannedProbe } from '@/lib/types'
import {
  bandStyle,
  cn,
  COMPETENCY_LABELS,
  DIFFICULTY_LABELS,
  EVIDENCE_META,
  formatDate,
} from '@/lib/utils'

export function CandidatePage() {
  const { candidateId = '' } = useParams()
  const navigate = useNavigate()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['candidate-profile', candidateId],
    queryFn: () => api.candidateProfile(candidateId),
    enabled: Boolean(candidateId),
  })

  const { data: history } = useQuery({
    queryKey: ['candidate-history', candidateId],
    queryFn: () => api.candidateHistory(candidateId),
    enabled: Boolean(candidateId),
  })

  const start = useMutation({
    mutationFn: () => api.startInterview(candidateId),
    onSuccess: (state) => navigate(`/interview/${state.session_id}`),
  })

  if (isLoading) return <CandidateSkeleton />

  if (isError || !data) {
    return (
      <Container className="py-16">
        <EmptyState
          icon={<Target className="size-5" />}
          title="Couldn't load this profile"
          description={
            error instanceof ApiError
              ? error.message
              : 'The interview service is unreachable. Check the backend is running and try again.'
          }
          action={
            <Link to="/dashboard">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="size-3.5" />
                Back to cohort
              </Button>
            </Link>
          }
        />
      </Container>
    )
  }

  const { profile, evidence, planned_probes: probes } = data
  const eligible = evidence.filter((t) => t.eligible)

  return (
    <Container className="py-10">
      <Link
        to="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-subtle transition-colors hover:text-ink-muted"
      >
        <ArrowLeft className="size-3.5" />
        Cohort
      </Link>

      {/* ---------------------------------------------------------- Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="overflow-hidden">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-start gap-4">
              <GradientAvatar
                name={profile.candidate_name}
                gradient={cardGradient(profile.candidate_id)}
                size="lg"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-h2 text-ink">{profile.candidate_name}</h1>
                  <Badge tone="brand" className="capitalize">
                    {profile.seniority_band}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {profile.job_role} ·{' '}
                  {profile.years_experience === 0
                    ? 'new to industry'
                    : `${profile.years_experience} years`}{' '}
                  · {profile.education}
                </p>
                <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-ink/90">
                  {profile.headline}
                </p>
              </div>
            </div>

            {/* Hidden on mobile — the sticky footer CTA replaces it there, so
                the same action never appears twice on one screen. */}
            <div className="hidden flex-col gap-3 lg:flex lg:items-end">
              <Button
                variant="primary"
                size="lg"
                loading={start.isPending}
                onClick={() => start.mutate()}
              >
                {start.isPending ? 'Preparing your interview…' : 'Start interview'}
                {!start.isPending && <Play className="size-4" />}
              </Button>
              <p className="text-xs text-ink-faint lg:text-right">
                {probes.length} questions planned · ~20 minutes
              </p>
            </div>
            <p className="text-xs text-ink-faint lg:hidden">
              {probes.length} questions planned · about 20 minutes
            </p>
          </div>

          {start.isError && (
            <div className="border-t border-danger/20 bg-danger/[0.06] px-6 py-3 sm:px-8">
              <p className="text-sm text-danger">
                {start.error instanceof ApiError
                  ? start.error.message
                  : "Couldn't start the interview. Please try again."}
              </p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* --------------------------------------------------------- Metrics */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          icon={CalendarDays}
          gradient="from-brand-500 to-accent-violet"
          label="Consistency"
          value={Math.round(profile.consistency * 31)}
          suffix=" / 31"
          hint="Days active in the cohort"
          fill={profile.consistency}
        />
        <MetricTile
          icon={Flame}
          gradient="from-accent-amber to-warn"
          label="First-try fluency"
          value={Math.round(profile.fluency * 100)}
          suffix="%"
          hint="Missions passed on attempt one"
          fill={profile.fluency}
        />
        <MetricTile
          icon={ListChecks}
          gradient="from-band-exceptional to-accent-teal"
          label="Coverage"
          value={Math.round(profile.coverage * 100)}
          suffix="%"
          hint="Of the 31-day curriculum"
          fill={profile.coverage}
        />
        <MetricTile
          icon={Target}
          gradient={DIFFICULTY_GRADIENT[profile.baseline_difficulty]}
          label="Opening difficulty"
          value={profile.baseline_difficulty}
          suffix=" / 5"
          hint={DIFFICULTY_LABELS[profile.baseline_difficulty]}
          fill={profile.baseline_difficulty / 5}
        />
      </div>

      <Card className="mt-4 p-5 sm:p-6">
        <CohortJourney evidence={evidence} commitDays={Math.round(profile.consistency * 31)} />
      </Card>

      {/* Order matters on mobile, where this becomes one column. Strategy and
          exclusions answer "what will this interview be like?" — the question
          someone actually has before starting — so they come before the
          full evidence map and the plan. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="order-2 space-y-4 lg:order-1">
          <EvidenceMap evidence={evidence} />
          <PlanPreview probes={probes} />
        </div>

        <div className="order-1 space-y-4 lg:order-2">
          <StrategyPanel notes={profile.strategy_notes} />
          <ExclusionPanel
            skipped={evidence.filter((t) => t.strength === 'skipped')}
            eligibleCount={eligible.length}
          />
          <HistoryPanel history={history} />
        </div>
      </div>

      {/* Sticky mobile CTA. The header button scrolls out of view within a
          screen or two, and "start" is the only action this page exists for —
          it should never be more than a thumb-reach away. */}
      <div className="sticky bottom-0 z-30 -mx-5 mt-6 border-t border-line bg-base/95 px-5 py-3 pb-safe backdrop-blur-xl lg:hidden">
        <Button
          variant="primary"
          size="lg"
          loading={start.isPending}
          onClick={() => start.mutate()}
          className="w-full"
        >
          {start.isPending ? 'Preparing your interview…' : `Start interview · ${probes.length} questions`}
          {!start.isPending && <Play className="size-4" />}
        </Button>
      </div>
    </Container>
  )
}

/* ------------------------------------------------------------- Metric tile */

function MetricTile({
  icon,
  gradient,
  label,
  value,
  suffix,
  hint,
  fill,
}: {
  icon: typeof Target
  gradient: string
  label: string
  value: number
  suffix: string
  hint: string
  fill: number
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <GradientTile icon={icon} gradient={gradient} size="md" />
        <div className="min-w-0">
          <p className="nums text-2xl font-bold leading-none tracking-tight text-ink">
            <CountUp value={value} />
            <span className="text-base font-normal text-ink-subtle">{suffix}</span>
          </p>
          <p className="eyebrow mt-1">{label}</p>
        </div>
      </div>
      {/* Bar carries the tile's own colour, so the metric reads as one unit. */}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-tint/[0.07]">
        <motion.div
          className={cn('h-full rounded-full bg-gradient-to-r', gradient)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(fill * 100)}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <p className="mt-2 text-[0.6875rem] text-ink-faint">{hint}</p>
    </Card>
  )
}

/* ------------------------------------------------------------ Evidence map */

/**
 * The evidence map — the most important visual on this page.
 *
 * One cell per mission, coloured by how the candidate performed. It makes the
 * product's core thesis legible in a single glance: the interview is built
 * from *this*, and the grey cells are permanently off the table.
 */
function EvidenceMap({ evidence }: { evidence: EvidenceTopic[] }) {
  const byModule = evidence.reduce<Record<string, EvidenceTopic[]>>((acc, topic) => {
    ;(acc[topic.module] ??= []).push(topic)
    return acc
  }, {})

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence profile</CardTitle>
        <p className="text-sm leading-relaxed text-ink-muted">
          Every mission on record, read as interview evidence. Attempt count decides how deep
          each question goes — and skipped material is excluded entirely.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {Object.entries(byModule).map(([module, topics]) => (
          <div key={module} className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={cn('h-3.5 w-1 rounded-full bg-gradient-to-b', cardGradient(module))}
              />
              <p className="text-xs font-semibold text-ink-muted">{module}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((topic) => {
                const meta = EVIDENCE_META[topic.strength]
                return (
                  <Tooltip
                    key={topic.day}
                    label={`Day ${topic.day} · ${topic.title} — ${meta.blurb}${
                      topic.attempts ? ` (${topic.attempts} attempts)` : ''
                    }`}
                  >
                    <span
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5',
                        'text-xs font-medium transition-colors',
                        meta.bg,
                        meta.text,
                        !topic.eligible && 'opacity-55',
                      )}
                    >
                      <span className={cn('size-1.5 rounded-full', meta.dot)} />
                      <span className="nums">D{topic.day}</span>
                      {topic.attempts && <span className="text-[0.625rem] opacity-70">×{topic.attempts}</span>}
                      {!topic.eligible && <Ban className="size-3 opacity-70" />}
                    </span>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4">
          {(['mastered', 'solid', 'struggled', 'failed', 'skipped'] as const).map((key) => {
            const meta = EVIDENCE_META[key]
            return (
              <span key={key} className="flex items-center gap-1.5 text-[0.6875rem] text-ink-subtle">
                <span className={cn('size-1.5 rounded-full', meta.dot)} />
                {meta.label}
              </span>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------ Plan preview */

function PlanPreview({ probes }: { probes: PlannedProbe[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your interview plan</CardTitle>
        <p className="text-sm leading-relaxed text-ink-muted">
          Computed before you start — which is why it can't repeat itself or wander
          off-syllabus. Difficulty still adapts live to how you answer.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {probes.map((probe, i) => (
          <div
            key={probe.index}
            className="flex items-start gap-3 rounded-xl border border-line bg-base-200/60 p-3 transition-colors hover:border-line-strong"
          >
            {/* Number tile coloured by the difficulty it will be asked at —
                the question order becomes a visible heat ramp. */}
            <span
              className={cn(
                'nums mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg',
                'bg-gradient-to-br text-xs font-bold text-white',
                DIFFICULTY_GRADIENT[probe.difficulty],
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-ink">
                Day {probe.day} · {probe.day_title}
              </span>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{probe.rationale}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold',
                  DIFFICULTY_TINT[probe.difficulty],
                )}
              >
                {probe.difficulty_label}
              </span>
              <span className="text-[0.625rem] text-ink-faint">
                {COMPETENCY_LABELS[probe.competency]}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/* --------------------------------------------------------- Strategy panel */

function StrategyPanel({ notes }: { notes: string[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-brand-400" />
          <CardTitle className="text-base">Interview strategy</CardTitle>
        </div>
        <p className="text-xs leading-relaxed text-ink-muted">
          Derived from your record before any model is involved.
        </p>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {notes.length === 0 && (
          <p className="text-sm text-ink-subtle">
            A standard interview — nothing in the record calls for special calibration.
          </p>
        )}
        {notes.map((note, i) => (
          <div
            key={i}
            className="rounded-xl border border-brand-500/15 bg-brand-500/[0.05] p-3 text-xs leading-relaxed text-ink/85"
          >
            {note}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------- Exclusion panel */

/**
 * Surfacing exclusions is an anxiety-reduction feature.
 *
 * The single most stressful thing about a technical interview is not knowing
 * what might come up. Telling someone up front exactly what *cannot* be asked
 * removes that, and it proves the system read their record.
 */
function ExclusionPanel({
  skipped,
  eligibleCount,
}: {
  skipped: EvidenceTopic[]
  eligibleCount: number
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Ban className="size-4 text-ink-subtle" />
          <CardTitle className="text-base">What you won't be asked</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {skipped.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink-muted">
            You attempted every mission on record, so the full{' '}
            <span className="text-ink">{eligibleCount} topics</span> are in scope.
          </p>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-ink-muted">
              You skipped these during the cohort, so they're excluded from the question pool
              entirely — enforced in code, not requested in a prompt.
            </p>
            <div className="space-y-1.5">
              {skipped.map((topic) => (
                <div
                  key={topic.day}
                  className="flex items-center gap-2 rounded-lg border border-line bg-tint/[0.02] px-2.5 py-2"
                >
                  <span className="nums text-[0.6875rem] text-ink-faint">D{topic.day}</span>
                  <span className="truncate text-xs text-ink-subtle">{topic.title}</span>
                </div>
              ))}
            </div>
            <p className="text-[0.6875rem] leading-relaxed text-ink-faint">
              They'll still appear in your learning roadmap afterwards — that's the right place
              for them.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ---------------------------------------------------------- History panel */

function HistoryPanel({
  history,
}: {
  history:
    | {
        trend: { session_id: string; date: string; overall: number }[]
        best_score: number | null
        sessions?: { session_id: string; status: string; turns: number; planned_turns: number }[]
      }
    | undefined
}) {
  const trend = history?.trend ?? []

  // An interview someone abandoned halfway is the most valuable thing on this
  // panel — it is unfinished work they can resume in one tap. Surfacing it
  // above the completed list is what stops a dropped session becoming a
  // silently lost one.
  const inProgress = (history?.sessions ?? []).find(
    (s) => s.status === 'in_progress' && s.turns > 0,
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-ink-subtle" />
          <CardTitle className="text-base">Interview history</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {inProgress && (
          <Link
            to={`/interview/${inProgress.session_id}`}
            className="block rounded-xl border border-brand-500/30 bg-brand-500/[0.07] p-3.5 transition-colors hover:bg-brand-500/[0.11]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-brand-300">Interview in progress</p>
                <p className="nums mt-0.5 text-xs text-ink-muted">
                  {inProgress.turns} of {inProgress.planned_turns} questions answered
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand-300">
                Resume
                <ArrowRight className="size-3" />
              </span>
            </div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-tint/[0.08]">
              <div
                className="h-full rounded-full bg-brand-400"
                style={{
                  width: `${Math.min(100, (inProgress.turns / Math.max(1, inProgress.planned_turns)) * 100)}%`,
                }}
              />
            </div>
          </Link>
        )}

        {trend.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-tint/[0.015] p-5 text-center">
            <p className="text-sm font-medium text-ink">
              {inProgress ? 'No completed interviews yet' : 'No interviews yet'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
              {inProgress
                ? 'Finish the one above and your report will appear here.'
                : 'Your first report will appear here, and you’ll be able to track progress across attempts.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {trend
              .slice()
              .reverse()
              .map((entry) => {
                const band = bandStyle(entry.overall)
                return (
                  <Link
                    key={entry.session_id}
                    to={`/report/${entry.session_id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-base-200/60 px-3 py-2.5 transition-colors hover:border-line-strong"
                  >
                    <span className="text-xs text-ink-muted">{formatDate(entry.date)}</span>
                    <span className="flex items-center gap-2">
                      <span className={cn('nums text-sm font-semibold', band.text)}>
                        {entry.overall}
                      </span>
                      <ArrowRight className="size-3 text-ink-faint" />
                    </span>
                  </Link>
                )
              })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------- Skeleton */

function CandidateSkeleton() {
  return (
    <Container className="py-10">
      <Skeleton className="mb-6 h-4 w-20" />
      <Card className="p-8">
        <div className="flex items-start gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-3.5 w-72" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>
      </Card>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="space-y-3 p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-1 w-full" />
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="h-96 p-6">
          <Skeleton className="h-full w-full" />
        </Card>
        <Card className="h-96 p-6">
          <Skeleton className="h-full w-full" />
        </Card>
      </div>
    </Container>
  )
}
