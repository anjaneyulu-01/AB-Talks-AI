import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Gauge, Radar } from 'lucide-react'

import { Tooltip } from '@/components/ui/primitives'
import type { Competency, InterviewState } from '@/lib/types'
import { bandStyle, cn, COMPETENCY_SHORT } from '@/lib/utils'

/**
 * Live telemetry rail.
 *
 * The hardest design call on this screen was what *not* to show. Per-answer
 * scores are deliberately absent: telling someone "that answer scored 41"
 * mid-interview would spike anxiety and change how they answer the next
 * question — measuring the interface instead of the candidate.
 *
 * So the rail shows a single smoothed readiness figure (floored at 25, rises
 * quickly, falls slowly), directional competency signal, and honest structural
 * progress. Enough to feel oriented and improving. Not enough to spiral.
 */
export function InterviewRail({ state }: { state: InterviewState }) {
  const { live, plan } = state
  const band = bandStyle(live.readiness)

  const signals = Object.entries(live.competency_signal) as [Competency, number][]
  const covered = new Set(live.topics_covered)

  return (
    <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-line bg-surface/30 lg:block">
      <div className="space-y-6 p-5">
        {/* ---------------------------------------------------- Readiness */}
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

        {/* ------------------------------------------------ Skill signals */}
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

        {/* ----------------------------------------------- Adaptive path */}
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
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
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
                        'min-w-0 flex-1 truncate text-[0.6875rem]',
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
    </aside>
  )
}
