import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Gauge, Radar, TrendingUp } from 'lucide-react'

import { Tooltip } from '@/components/ui/primitives'
import type { Competency, InterviewState } from '@/lib/types'
import { bandStyle, cn, COMPETENCY_SHORT } from '@/lib/utils'

/**
 * Live telemetry.
 *
 * The hardest design call on this screen was what *not* to show. Per-answer
 * scores are deliberately absent: telling someone "that answer scored 41"
 * mid-interview spikes anxiety and changes how they answer the next question —
 * you end up measuring the interface instead of the candidate. So this shows a
 * single smoothed readiness figure (floored at 25, rises fast, falls slow),
 * directional competency signal, and honest structural progress.
 *
 * `RailContent` is presentation-free about *where* it sits. It renders into a
 * desktop sidebar and into a mobile bottom sheet unchanged, so the two can
 * never drift apart — and so mobile users never lose the feature.
 */

export function RailContent({ state }: { state: InterviewState }) {
  const { live, plan } = state
  const band = bandStyle(live.readiness)

  const signals = Object.entries(live.competency_signal) as [Competency, number][]
  const covered = new Set(live.topics_covered)

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------ Readiness */}
      <section>
        <div className="mb-3 flex items-center gap-1.5">
          <Gauge className="size-3.5 text-ink-faint" />
          <p className="eyebrow">Live readiness</p>
        </div>

        <div className="flex items-end gap-2">
          <motion.span
            key={live.readiness}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={cn('nums text-4xl font-bold leading-none tracking-tight', band.text)}
          >
            {live.readiness}
          </motion.span>
          <span className="pb-1 text-xs text-ink-faint">/ 100</span>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: band.hex }}
            animate={{ width: `${live.readiness}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-faint">
          A running estimate across everything you've answered — it isn't your final score.
        </p>
      </section>

      {/* -------------------------------------------------- Skill signals */}
      {signals.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-1.5">
            <Radar className="size-3.5 text-ink-faint" />
            <p className="eyebrow">Signal so far</p>
          </div>

          <div className="space-y-2.5">
            {signals.map(([competency, score]) => {
              const tone = bandStyle(score)
              return (
                <div key={competency} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[0.6875rem] text-ink-subtle">
                      {COMPETENCY_SHORT[competency] ?? competency}
                    </span>
                    <span className={cn('nums text-[0.6875rem] font-medium', tone.text)}>
                      {score}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: tone.hex }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* -------------------------------------------------- Adaptive path */}
      <section>
        <p className="eyebrow mb-3">Interview path</p>

        <div className="space-y-1">
          {plan.map((probe) => {
            const isCovered = covered.has(probe.day)
            const isCurrent = live.current_day === probe.day
            return (
              <Tooltip key={probe.index} label={probe.rationale} side="bottom">
                <div
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                    isCurrent && 'bg-brand-500/10',
                  )}
                >
                  {isCovered && !isCurrent ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-band-exceptional/70" />
                  ) : isCurrent ? (
                    <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                      <span className="absolute size-3.5 animate-breathe rounded-full bg-brand-500/30" />
                      <span className="relative size-1.5 rounded-full bg-brand-400" />
                    </span>
                  ) : (
                    <Circle className="size-3.5 shrink-0 text-ink-faint/40" />
                  )}

                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-xs',
                      isCurrent
                        ? 'font-medium text-ink'
                        : isCovered
                          ? 'text-ink-subtle'
                          : 'text-ink-faint',
                    )}
                  >
                    {probe.day_title}
                  </span>
                </div>
              </Tooltip>
            )
          })}
        </div>

        <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-faint">
          Topics were chosen from your cohort record. Difficulty moves with your answers.
        </p>
      </section>
    </div>
  )
}

/** Desktop sidebar. Hidden below `lg`, where the bottom sheet takes over. */
export function InterviewRail({ state }: { state: InterviewState }) {
  return (
    <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-line bg-surface/30 lg:block">
      <div className="p-5">
        <RailContent state={state} />
      </div>
    </aside>
  )
}

/**
 * Mobile summary strip — the always-visible part.
 *
 * A sheet the candidate has to remember to open is a feature they will forget.
 * This keeps the two numbers that matter (readiness, progress) permanently on
 * screen in 44px of height, and acts as the button that opens the full detail.
 */
export function MobileStatStrip({
  state,
  onOpen,
}: {
  state: InterviewState
  onOpen: () => void
}) {
  const { live } = state
  const band = bandStyle(live.readiness)
  const answered = live.answered
  const planned = Math.max(1, live.planned_turns)

  return (
    <button
      onClick={onOpen}
      aria-label="Open live progress details"
      className={cn(
        'flex w-full items-center gap-3 border-b border-line bg-surface/40 px-4 py-2.5',
        'text-left transition-colors active:bg-surface-hover lg:hidden',
      )}
    >
      <span className="flex items-baseline gap-1">
        <span className={cn('nums text-lg font-bold leading-none', band.text)}>
          {live.readiness}
        </span>
        <span className="text-[0.625rem] text-ink-faint">readiness</span>
      </span>

      <span className="h-4 w-px bg-line" aria-hidden />

      {/* Segmented progress: at a glance, how many questions are left. Reads
          faster than a percentage on a small screen. */}
      <span className="flex min-w-0 flex-1 items-center gap-1" aria-hidden>
        {Array.from({ length: Math.min(planned, 14) }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-500',
              i < answered ? 'bg-brand-400' : 'bg-white/[0.09]',
            )}
          />
        ))}
      </span>

      <span className="nums shrink-0 text-[0.6875rem] text-ink-subtle">
        {Math.min(answered + 1, planned)}/{planned}
      </span>

      <TrendingUp className="size-3.5 shrink-0 text-ink-faint" />
    </button>
  )
}
