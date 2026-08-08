import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Ban, Check, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * The live demo — the most important element on the landing page.
 *
 * The previous hero showed a static screenshot of an interview turn. It looked
 * fine and communicated almost nothing, because the product's entire thesis is
 * a *relationship*: this mission record produces that question. A still frame
 * can only assert that; it cannot demonstrate it.
 *
 * So this animates the derivation. Three scenarios cycle, each showing a real
 * row from the cohort dataset, the reading the profiler takes from it, and the
 * question that results:
 *
 *   cleared first try   -> skip the definition, go to trade-offs
 *   took five attempts  -> check whether the model actually landed
 *   skipped entirely    -> excluded, permanently
 *
 * That third case is the one that sells the product, so it gets a full slot of
 * its own rather than a footnote.
 *
 * Honesty: these are real days and real attempt counts from `candidates.json`,
 * and the questions are representative of what the system produces. It is a
 * demonstration of the mechanism, not a live API call.
 */

type Verdict = 'mastered' | 'struggled' | 'skipped'

interface Scenario {
  day: number
  title: string
  attempts: number | null
  verdict: Verdict
  reading: string
  question: string
  why: string
}

const SCENARIOS: Scenario[] = [
  {
    day: 7,
    title: 'Embeddings Explained',
    attempts: 1,
    verdict: 'mastered',
    reading: 'Cleared first try — fluent',
    question:
      'You picked cosine similarity over Euclidean. At ten million vectors, where does that choice start to cost you, and what would you change first?',
    why: "You cleared this first try, so asking you to define embeddings would waste your time. Going straight to scale.",
  },
  {
    day: 12,
    title: 'Prompt Engineering Fundamentals',
    attempts: 5,
    verdict: 'struggled',
    reading: 'Five attempts — something was hard here',
    question:
      'When your prompt kept failing the compliance check, what was the actual mechanism causing it — not the fix you landed on, but why the fix worked?',
    why: 'This took you five attempts. Checking whether the underlying model landed, or the procedure was memorised.',
  },
  {
    day: 28,
    title: 'Docker & Kubernetes Deployment',
    attempts: null,
    verdict: 'skipped',
    reading: 'Skipped — never covered',
    question: null as unknown as string,
    why: "You skipped this during the cohort, so you'll never be asked about it. It goes in your learning roadmap instead.",
  },
]

const VERDICT_STYLE: Record<Verdict, { dot: string; text: string; bg: string }> = {
  mastered: {
    dot: 'bg-band-exceptional',
    text: 'text-band-exceptional',
    bg: 'bg-band-exceptional/10',
  },
  struggled: {
    dot: 'bg-band-developing',
    text: 'text-band-developing',
    bg: 'bg-band-developing/10',
  },
  skipped: { dot: 'bg-ink-faint', text: 'text-ink-subtle', bg: 'bg-tint/[0.05]' },
}

const CYCLE_MS = 5200

export function LiveDemo() {
  const [index, setIndex] = useState(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    // Someone who asked for reduced motion gets the first scenario, static.
    // Auto-advancing carousels are the exact thing that setting exists for.
    if (reduceMotion) return
    const id = setInterval(() => setIndex((i) => (i + 1) % SCENARIOS.length), CYCLE_MS)
    return () => clearInterval(id)
  }, [reduceMotion])

  const scenario = SCENARIOS[index]
  const style = VERDICT_STYLE[scenario.verdict]

  return (
    // A plain container, not a `Card`. The hero wraps this in `GradientBorder`,
    // which already supplies the surface and the border — nesting a Card
    // inside would double both.
    <div className="overflow-hidden rounded-[1.15rem]">
      {/* Chrome */}
      <div className="flex items-center gap-2 border-b border-line bg-surface-raised px-4 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-tint/10" />
          <span className="size-2.5 rounded-full bg-tint/10" />
          <span className="size-2.5 rounded-full bg-tint/10" />
        </div>
        <p className="ml-2 text-xs font-medium text-ink-subtle">
          How a question gets chosen
        </p>

        {/* Progress pips double as the cycle indicator and a manual control. */}
        <div className="ml-auto flex items-center gap-1.5">
          {SCENARIOS.map((s, i) => (
            <button
              key={s.day}
              onClick={() => setIndex(i)}
              aria-label={`Show day ${s.day} example`}
              className={cn(
                'h-1 rounded-full transition-all duration-400',
                i === index ? 'w-5 bg-brand-400' : 'w-1.5 bg-tint/15 hover:bg-tint/25',
              )}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[minmax(0,15rem)_1fr]">
        {/* ---------------------------------------------- The record (input) */}
        <div className="border-b border-line p-5 md:border-b-0 md:border-r">
          <p className="eyebrow mb-3">Your cohort record</p>

          <div className="space-y-1.5">
            {SCENARIOS.map((s, i) => {
              const active = i === index
              const rowStyle = VERDICT_STYLE[s.verdict]
              return (
                <motion.div
                  key={s.day}
                  animate={{
                    opacity: active ? 1 : 0.35,
                    scale: active ? 1 : 0.985,
                  }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border px-2.5 py-2',
                    active ? 'border-line-strong bg-tint/[0.03]' : 'border-transparent',
                  )}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', rowStyle.dot)} />
                  <div className="min-w-0 flex-1">
                    <p className="nums text-[0.6875rem] font-medium text-ink">
                      Day {s.day}
                    </p>
                    <p className="truncate text-[0.625rem] leading-tight text-ink-faint">
                      {s.title}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'nums shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-medium',
                      rowStyle.bg,
                      rowStyle.text,
                    )}
                  >
                    {s.attempts ? `×${s.attempts}` : 'skip'}
                  </span>
                </motion.div>
              )
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={scenario.day}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className={cn('mt-4 text-[0.6875rem] font-medium', style.text)}
            >
              {scenario.reading}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* --------------------------------------------- The question (output) */}
        <div className="relative min-h-[15rem] p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={scenario.day}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.42, ease: EASE_OUT }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2">
                {scenario.verdict === 'skipped' ? (
                  <>
                    <Ban className="size-3.5 text-ink-subtle" />
                    <span className="text-xs font-medium text-ink-subtle">
                      Excluded from your interview
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5 text-brand-400" />
                    <span className="text-xs font-medium text-brand-300">
                      Question generated
                    </span>
                  </>
                )}
              </div>

              {/* The "why" line is the differentiator, so it gets the emphasis
                  treatment rather than sitting as small print under the fold. */}
              <p
                className={cn(
                  'rounded-xl border p-3 text-xs leading-relaxed',
                  scenario.verdict === 'skipped'
                    ? 'border-line bg-tint/[0.03] text-ink-muted'
                    : 'border-brand-500/20 bg-brand-500/[0.06] text-brand-300',
                )}
              >
                <span className="font-semibold">Why: </span>
                {scenario.why}
              </p>

              {scenario.question ? (
                <p className="prose-interview text-[0.9375rem]">{scenario.question}</p>
              ) : (
                <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-line-strong p-4">
                  <Check className="mt-0.5 size-4 shrink-0 text-band-exceptional" />
                  <p className="text-sm leading-relaxed text-ink-muted">
                    No question is asked. Enforced in code, not requested in a prompt —
                    so it cannot happen by accident.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Cycle timer. A quiet, honest affordance: it shows the demo is
              advancing on its own rather than reacting to the user. */}
          {!reduceMotion && (
            <motion.div
              key={`bar-${index}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: CYCLE_MS / 1000, ease: 'linear' }}
              className="absolute inset-x-5 bottom-3 h-px origin-left bg-brand-400/25"
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Compact three-step derivation, used further down the page.
 *
 * Restates the same mechanism in a different visual register. Repetition of
 * an idea across formats is how a landing page teaches; repetition in the same
 * format is just filler.
 */
export function DerivationStrip() {
  const steps = [
    { label: 'Your record', value: 'Day 12 · 5 attempts', tone: 'text-band-developing' },
    { label: 'The reading', value: 'Verify it actually landed', tone: 'text-ink-muted' },
    { label: 'The question', value: 'Asked at applied level', tone: 'text-brand-300' },
  ]

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      {steps.map((step, i) => (
        <div key={step.label} className="flex flex-1 items-center gap-2">
          <div className="flex-1 rounded-xl border border-line bg-surface p-3.5">
            <p className="eyebrow mb-1">{step.label}</p>
            <p className={cn('text-sm font-medium', step.tone)}>{step.value}</p>
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="hidden size-4 shrink-0 text-ink-faint sm:block" />
          )}
        </div>
      ))}
    </div>
  )
}
