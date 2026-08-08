import { motion, useReducedMotion } from 'framer-motion'
import { Ban, Flame } from 'lucide-react'

import { Tooltip } from '@/components/ui/primitives'
import type { EvidenceStrength, EvidenceTopic } from '@/lib/types'
import { cn, EVIDENCE_META } from '@/lib/utils'

/**
 * The 31-day cohort journey.
 *
 * Borrowed from the ABTalks challenge platform's core idea — daily proof of
 * work made visible — and applied to data we already hold. Every mission on
 * record becomes one cell, coloured by how it actually went. The whole cohort
 * fits in a single glanceable strip.
 *
 * Why it earns its place: the interview plan is derived from exactly this
 * record, and until you can *see* the record, "questions come from your own
 * history" is something you take on faith. This makes it checkable in one look
 * — including the hollow cells the interview will never touch.
 *
 * **An honesty constraint.** `commitDays` is a *count* of active days, not a
 * sequence, so we cannot know which days were contiguous. It would be trivial —
 * and wrong — to render a fake "longest streak: 12". So this shows the days we
 * genuinely have evidence for, states the active-day count as a count, and
 * never implies contiguity it cannot prove.
 */

const COHORT_DAYS = 31

/** Each evidence strength as a vivid gradient fill + the token that tints its
 *  glow, so an active cell reads as a small lit object floating off the strip. */
const CELL: Record<EvidenceStrength, { gradient: string; glow: string }> = {
  mastered: { gradient: 'from-band-exceptional to-accent-teal', glow: 'band-exceptional' },
  solid: { gradient: 'from-accent-sky to-accent-cyan', glow: 'band-strong' },
  struggled: { gradient: 'from-accent-amber to-warn', glow: 'band-developing' },
  failed: { gradient: 'from-band-emerging to-danger', glow: 'band-emerging' },
  skipped: { gradient: '', glow: '' },
  not_attempted: { gradient: '', glow: '' },
}

const LEGEND: { strength: EvidenceStrength; label: string }[] = [
  { strength: 'mastered', label: 'First try' },
  { strength: 'solid', label: 'Solid' },
  { strength: 'struggled', label: 'Took effort' },
  { strength: 'failed', label: "Didn't pass" },
]

export function CohortJourney({
  evidence,
  commitDays,
  className,
}: {
  evidence: EvidenceTopic[]
  commitDays: number
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const byDay = new Map(evidence.map((t) => [t.day, t]))

  const attempted = evidence.filter((t) => t.strength !== 'skipped').length
  const skipped = evidence.filter((t) => t.strength === 'skipped').length
  const firstTry = evidence.filter((t) => t.strength === 'mastered').length

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-amber to-warn text-white shadow-[0_2px_10px_-2px_hsl(var(--accent-amber)/0.6)]">
            <Flame className="size-3.5" strokeWidth={2.5} />
          </span>
          <p className="text-sm font-semibold text-ink">Cohort journey</p>
        </div>
        <p className="nums text-xs text-ink-subtle">
          Active <span className="font-semibold text-ink">{commitDays}</span> of {COHORT_DAYS} days
        </p>
      </div>

      {/* One cell per curriculum day. `flex-1` with a floor keeps the strip
          edge-to-edge at 390px without ever forcing a horizontal scroll. */}
      <div
        className="flex items-end gap-[3px]"
        role="img"
        aria-label={`Cohort record: ${attempted} missions attempted, ${skipped} skipped, across ${COHORT_DAYS} days`}
      >
        {Array.from({ length: COHORT_DAYS }, (_, i) => i + 1).map((day, idx) => {
          const topic = byDay.get(day)
          const cellMotion = {
            initial: reduceMotion ? { opacity: 1 } : { opacity: 0, scaleY: 0.3 },
            animate: { opacity: 1, scaleY: 1 },
            transition: {
              duration: 0.4,
              delay: Math.min(idx * 0.015, 0.5),
              ease: [0.22, 1, 0.36, 1] as const,
            },
          }

          // Empty day — no mission on record.
          if (!topic) {
            return (
              <motion.span
                key={day}
                {...cellMotion}
                className="h-7 min-w-[5px] flex-1 origin-bottom rounded-[4px] bg-tint/[0.05]"
              />
            )
          }

          const meta = EVIDENCE_META[topic.strength]
          const cell = CELL[topic.strength]
          const isSkipped = topic.strength === 'skipped'
          const label = isSkipped
            ? `Day ${day} · ${topic.title} — skipped, so never asked about`
            : `Day ${day} · ${topic.title} — ${meta.label.toLowerCase()}${
                topic.attempts ? ` (${topic.attempts} attempts)` : ''
              }`

          return (
            <Tooltip key={day} label={label} className="min-w-[5px] flex-1">
              <motion.span
                {...cellMotion}
                className={cn(
                  'block h-10 w-full origin-bottom rounded-[4px] transition-transform duration-200 hover:-translate-y-0.5',
                  isSkipped
                    ? 'border border-dashed border-line-strong bg-tint/[0.03]'
                    : cn('bg-gradient-to-b', cell.gradient),
                )}
                style={
                  isSkipped
                    ? undefined
                    : { boxShadow: `0 3px 12px -4px hsl(var(--${cell.glow}) / 0.55)` }
                }
              />
            </Tooltip>
          )
        })}
      </div>

      <div className="flex items-center justify-between text-[0.625rem] text-ink-faint">
        <span>Day 1</span>
        <span>Day 31 · Capstone</span>
      </div>

      {/* Legend — the strip's colours are meaningful, so name them. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {LEGEND.map(({ strength, label }) => (
          <span key={strength} className="flex items-center gap-1.5 text-[0.625rem] text-ink-subtle">
            <span className={cn('size-2 rounded-sm bg-gradient-to-br', CELL[strength].gradient)} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[0.625rem] text-ink-subtle">
          <span className="size-2 rounded-sm border border-dashed border-line-strong" />
          Skipped
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <JourneyStat value={attempted} label="attempted" gradient="from-brand-500 to-accent-violet" />
        <JourneyStat
          value={firstTry}
          label="first try"
          gradient="from-band-exceptional to-accent-teal"
        />
        <JourneyStat
          value={skipped}
          label="never asked"
          gradient="from-ink-faint to-ink-subtle"
          muted={skipped === 0}
          icon={skipped > 0}
        />
      </div>
    </div>
  )
}

function JourneyStat({
  value,
  label,
  gradient,
  muted = false,
  icon = false,
}: {
  value: number
  label: string
  gradient: string
  muted?: boolean
  icon?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface px-3 py-3 text-center shadow-soft">
      {/* A slim gradient accent across the top ties the stat to its meaning. */}
      <div className={cn('absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r', gradient)} />
      <p
        className={cn(
          'nums bg-gradient-to-br bg-clip-text text-2xl font-bold leading-none tracking-tight text-transparent',
          muted ? 'from-ink-subtle to-ink-faint' : gradient,
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 flex items-center justify-center gap-1 text-[0.625rem] leading-tight text-ink-faint">
        {icon && <Ban className="size-2.5" />}
        {label}
      </p>
    </div>
  )
}
