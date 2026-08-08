import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Link2,
  MessageSquare,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ScoreBar, ScoreRing } from '@/components/ui/ScoreRing'
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
} from '@/components/ui/primitives'
import { CompetencyRadar } from '@/features/report/CompetencyRadar'
import { api, ApiError } from '@/lib/api'
import type { FeedbackReport } from '@/lib/types'
import {
  bandStyle,
  cn,
  COMPETENCY_LABELS,
  formatDuration,
  RECOMMENDATION_META,
} from '@/lib/utils'

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
}

export function ReportPage() {
  const { sessionId = '' } = useParams()

  const { data: report, isLoading, isError, error } = useQuery({
    queryKey: ['report', sessionId],
    queryFn: () => api.getReport(sessionId),
    enabled: Boolean(sessionId),
  })

  if (isLoading) return <ReportSkeleton />

  if (isError || !report) {
    return (
      <Container className="py-16">
        <EmptyState
          icon={<FileText className="size-5" />}
          title="Report not available"
          description={
            error instanceof ApiError
              ? error.message
              : "This interview may still be in progress, or the session has expired."
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

  return (
    <Container className="py-10">
      <ReportHeader report={report} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          <SummaryCard report={report} />
          <BreakdownCard report={report} />
          <FeedbackLists report={report} />
          <TopicsTable report={report} />
        </div>

        <div className="space-y-4">
          <RadarCard report={report} />
          <RoadmapCard report={report} />
          <NextStepsCard report={report} />
        </div>
      </div>

      <ClosingNote report={report} />
    </Container>
  )
}

/* ---------------------------------------------------------------- Header */

function ReportHeader({ report }: { report: FeedbackReport }) {
  const [copied, setCopied] = useState(false)
  const rec = RECOMMENDATION_META[report.recommendation]

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (insecure context or denied permission). Silent —
      // the URL is visible in the address bar regardless.
    }
  }

  return (
    <motion.div {...fadeUp}>
      <Link
        to={`/candidates/${report.candidate_id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-subtle transition-colors hover:text-ink-muted no-print"
      >
        <ArrowLeft className="size-3.5" />
        {report.candidate_name}
      </Link>

      <Card className="overflow-hidden">
        <div className="grid gap-6 p-5 sm:gap-8 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          {/* Centred on mobile so the score reads as the headline it is;
              left-anchored on desktop where it sits beside the summary. */}
          <div className="flex justify-center lg:block">
            <ScoreRing score={report.overall_score} size={132} label="Readiness" className="sm:hidden" />
            <ScoreRing score={report.overall_score} size={148} label="Readiness" className="hidden sm:inline-flex" />
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Interview report</p>
              <span className="text-xs text-ink-faint">
                {report.turns_taken} questions · {formatDuration(report.duration_seconds)}
              </span>
            </div>

            <h1 className="text-h2 text-ink">{report.candidate_name}</h1>

            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2',
                rec.bg,
                rec.border,
              )}
            >
              <CheckCircle2 className={cn('size-4', rec.text)} />
              <span className={cn('text-sm font-semibold', rec.text)}>{rec.label}</span>
            </div>

            <p className="max-w-xl text-sm leading-relaxed text-ink-muted">
              {report.recommendation_reason}
            </p>
          </div>

          {/* Equal-width row on mobile so all three are comfortably tappable;
              a stacked column on desktop where vertical space is free. */}
          <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-col no-print">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Download </span>PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={share}>
              {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
              {copied ? 'Copied' : 'Share'}
            </Button>
            <Link to={`/candidates/${report.candidate_id}`}>
              <Button variant="ghost" size="sm" className="w-full">
                <TrendingUp className="size-3.5" />
                Retry
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

/* --------------------------------------------------------------- Summary */

function SummaryCard({ report }: { report: FeedbackReport }) {
  return (
    <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-400" />
            <CardTitle className="text-base">The short version</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-[0.9375rem] leading-relaxed text-ink/90">{report.summary}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ------------------------------------------------------------- Breakdown */

function BreakdownCard({ report }: { report: FeedbackReport }) {
  return (
    <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score breakdown</CardTitle>
          <p className="text-xs leading-relaxed text-ink-muted">
            Each score is a weighted average across the turns that actually measured it —
            computed from your answers, not estimated at the end.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {report.breakdown.map((item, i) => (
            <ScoreBar
              key={item.competency}
              label={COMPETENCY_LABELS[item.competency]}
              score={item.score}
              hint={
                item.evidence_turns.length
                  ? `From ${item.evidence_turns.length} answer${item.evidence_turns.length > 1 ? 's' : ''} · turn${item.evidence_turns.length > 1 ? 's' : ''} ${item.evidence_turns.join(', ')}`
                  : undefined
              }
              delay={0.15 + i * 0.06}
            />
          ))}
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* -------------------------------------------------------- Strengths/gaps */

function FeedbackLists({ report }: { report: FeedbackReport }) {
  return (
    <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-band-exceptional">What held up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {report.strengths.map((item, i) => (
              <div key={i} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-band-exceptional/70" />
                <p className="text-sm leading-relaxed text-ink/85">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-band-developing">Where to grow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {report.gaps.map((item, i) => (
              <div key={i} className="flex gap-2.5">
                <Target className="mt-0.5 size-3.5 shrink-0 text-band-developing/70" />
                <p className="text-sm leading-relaxed text-ink/85">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}

/* ---------------------------------------------------------------- Topics */

/**
 * The audit trail.
 *
 * Every topic covered, the difficulty it was asked at, and what it scored.
 * This is what makes the report defensible rather than assertive — a candidate
 * who disagrees with a number can see exactly which turn produced it.
 */
function TopicsTable({ report }: { report: FeedbackReport }) {
  if (report.topics_covered.length === 0) return null

  return (
    <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-ink-subtle" />
            <CardTitle className="text-base">Question by question</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile: cards. A five-column table at 390px either scrolls
              sideways or crushes every column to unreadable width — and this
              is the audit trail, the part a candidate most needs to actually
              read. */}
          <div className="space-y-2 sm:hidden">
            {report.topics_covered.map((topic) => {
              const band = bandStyle(topic.score)
              return (
                <div
                  key={topic.turn}
                  className="rounded-xl border border-line bg-base-200/60 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-ink">
                        {topic.title}
                      </p>
                      <p className="nums mt-0.5 text-[0.6875rem] text-ink-faint">
                        Turn {topic.turn} · Day {topic.day}
                      </p>
                    </div>
                    <span className={cn('nums shrink-0 text-lg font-bold', band.text)}>
                      {topic.score}
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="outline">{topic.difficulty}</Badge>
                    <span className="text-[0.6875rem] text-ink-subtle">
                      {topic.competency}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: the table, where the density is an asset. */}
          <div className="-mx-2 hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line text-left">
                  {['Turn', 'Topic', 'Level', 'Measured', 'Score'].map((h) => (
                    <th key={h} className="px-2 pb-2.5 text-[0.6875rem] font-medium uppercase tracking-wide text-ink-faint">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.topics_covered.map((topic) => {
                  const band = bandStyle(topic.score)
                  return (
                    <tr key={topic.turn} className="border-b border-line/60 last:border-0">
                      <td className="nums px-2 py-3 text-xs text-ink-faint">{topic.turn}</td>
                      <td className="px-2 py-3">
                        <p className="text-sm text-ink">{topic.title}</p>
                        <p className="text-[0.6875rem] text-ink-faint">Day {topic.day}</p>
                      </td>
                      <td className="px-2 py-3">
                        <Badge tone="outline">{topic.difficulty}</Badge>
                      </td>
                      <td className="px-2 py-3 text-xs text-ink-subtle">{topic.competency}</td>
                      <td className={cn('nums px-2 py-3 text-sm font-semibold', band.text)}>
                        {topic.score}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ----------------------------------------------------------------- Radar */

function RadarCard({ report }: { report: FeedbackReport }) {
  return (
    <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Competency shape</CardTitle>
        </CardHeader>
        <CardContent>
          <CompetencyRadar breakdown={report.breakdown} />
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* --------------------------------------------------------------- Roadmap */

function RoadmapCard({ report }: { report: FeedbackReport }) {
  if (report.roadmap.length === 0) return null

  return (
    <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-brand-400" />
            <CardTitle className="text-base">Your learning roadmap</CardTitle>
          </div>
          <p className="text-xs leading-relaxed text-ink-muted">
            Real days from your cohort curriculum, ordered by how much they'd move your score.
          </p>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {report.roadmap.map((step) => (
            <div key={step.order} className="rounded-xl border border-line bg-base-200/60 p-3.5">
              <div className="flex items-start gap-2.5">
                <span className="nums mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-500/15 text-[0.625rem] font-semibold text-brand-300">
                  {step.order}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{step.why}</p>
                  {step.resources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {step.resources.map((resource) => (
                        <span
                          key={resource}
                          className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[0.625rem] text-ink-subtle"
                        >
                          {resource}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 flex items-center gap-1 text-[0.625rem] text-ink-faint">
                    <Clock className="size-2.5" />
                    {step.est_effort}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ------------------------------------------------------------ Next steps */

function NextStepsCard({ report }: { report: FeedbackReport }) {
  return (
    <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Do these next</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {report.next.map((item, i) => (
            <div key={i} className="flex gap-2.5">
              <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-brand-400" />
              <p className="text-sm leading-relaxed text-ink/85">{item}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ----------------------------------------------------------- Closing note */

function ClosingNote({ report }: { report: FeedbackReport }) {
  if (!report.interviewer_note) return null

  return (
    <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.25 }} className="mt-4">
      <Card className="bg-brand-sheen p-6 sm:p-8">
        <p className="eyebrow mb-3">From your interviewer</p>
        <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-ink/90">
          {report.interviewer_note}
        </p>
      </Card>
    </motion.div>
  )
}

/* -------------------------------------------------------------- Skeleton */

function ReportSkeleton() {
  return (
    <Container className="py-10">
      <Skeleton className="mb-6 h-4 w-28" />
      <Card className="p-8">
        <div className="flex items-center gap-8">
          <Skeleton className="size-36 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-9 w-36 rounded-xl" />
          </div>
        </div>
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          {[24, 64, 40].map((h, i) => (
            <Card key={i} className="p-6">
              <Skeleton className={`h-${h} w-full`} style={{ height: h * 4 }} />
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          {[56, 72].map((h, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="w-full" style={{ height: h * 4 }} />
            </Card>
          ))}
        </div>
      </div>
    </Container>
  )
}
