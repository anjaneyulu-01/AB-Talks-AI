import { Flame } from 'lucide-react'

import { Tooltip } from '@/components/ui/primitives'
import type { EvidenceTopic } from '@/lib/types'
import { cn, EVIDENCE_META } from '@/lib/utils'

/**
 * The 31-day cohort journey.
 *
 * Borrowed from the ABTalks challenge platform's core idea — daily proof of
 * work made visible — and applied to data we already hold. Every mission on
 * record becomes one cell, coloured by how it actually went. The whole cohort
 * fits in a single glanceable strip.
 *
 * Why it earns its place on this screen: the interview plan is derived from
 * exactly this record, and until you can *see* the record, the claim
 * "questions come from your own history" is something you have to take on
 * faith. This makes it checkable in one look — including the grey cells the
 * interview will never touch.
 *
 * **An honesty constraint.** `commitDays` is a *count* of active days, not a
 * sequence, so we cannot know which days were contiguous. It would be trivial
 * — and wrong — to render a fake "longest streak: 12". So this shows the days
 * we genuinely have evidence for, states the active-day count as a count, and
 * never implies contiguity it cannot prove.
 */

const COHORT_DAYS = 31

export function CohortJourney({
  evidence,
  commitDays,
  className,
}: {
  evidence: EvidenceTopic[]
  commitDays: number
  className?: string
}) {
  const byDay = new Map(evidence.map((t) => [t.day, t]))

  const attempted = evidence.filter((t) => t.strength !== 'skipped').length
  const skipped = evidence.filter((t) => t.strength === 'skipped').length
  const firstTry = evidence.filter((t) => t.strength === 'mastered').length

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <Flame className="size-4 text-band-developing" />
          <p className="text-sm font-semibold text-ink">Cohort journey</p>
        </div>
        <p className="nums text-xs text-ink-subtle">
          Active <span className="text-ink">{commitDays}</span> of {COHORT_DAYS} days
        </p>
      </div>

      {/* One cell per curriculum day. `flex-1` with a floor keeps the strip
          edge-to-edge at 390px without ever forcing a horizontal scroll. */}
      <div className="flex items-end gap-[3px]" role="img" aria-label={`Cohort record: ${attempted} missions attempted, ${skipped} skipped, across ${COHORT_DAYS} days`}>
        {Array.from({ length: COHORT_DAYS }, (_, i) => i + 1).map((day) => {
          const topic = byDay.get(day)

          if (!topic) {
            return (
              <span
                key={day}
                className="h-6 min-w-[5px] flex-1 rounded-[3px] bg-tint/[0.045]"
              />
            )
          }

          const meta = EVIDENCE_META[topic.strength]
          const label =
            topic.strength === 'skipped'
              ? `Day ${day} · ${topic.title} — skipped, so never asked about`
              : `Day ${day} · ${topic.title} — ${meta.label.toLowerCase()}${
                  topic.attempts ? ` (${topic.attempts} attempts)` : ''
                }`

          return (
            <Tooltip key={day} label={label} className="min-w-[5px] flex-1">
              <span
                className={cn(
                  'block h-9 w-full rounded-[3px] transition-transform duration-200',
                  'hover:scale-y-110 hover:brightness-125',
                  meta.dot,
                  topic.strength === 'skipped' && 'opacity-40',
                )}
              />
            </Tooltip>
          )
        })}
      </div>

      <div className="flex items-center justify-between text-[0.625rem] text-ink-faint">
        <span>Day 1</span>
        <span>Day 31 · Capstone</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <JourneyStat value={attempted} label="attempted" />
        <JourneyStat value={firstTry} label="first try" tone="text-band-exceptional" />
        <JourneyStat
          value={skipped}
          label="never asked"
          tone={skipped > 0 ? 'text-ink-subtle' : undefined}
        />
      </div>
    </div>
  )
}

function JourneyStat({
  value,
  label,
  tone,
}: {
  value: number
  label: string
  tone?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-base-200/50 px-3 py-2.5 text-center">
      <p className={cn('nums text-lg font-semibold leading-none', tone ?? 'text-ink')}>
        {value}
      </p>
      <p className="mt-1 text-[0.625rem] leading-tight text-ink-faint">{label}</p>
    </div>
  )
}
