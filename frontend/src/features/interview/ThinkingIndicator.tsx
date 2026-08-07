import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

/**
 * The AI thinking state.
 *
 * Two deliberate decisions:
 *
 * 1. **It narrates what's actually happening.** "Assessing your answer" then
 *    "Choosing what to ask next" are real backend stages — evaluate, then
 *    decide, then generate. Honest progress copy is both more reassuring and
 *    more interesting than a spinner.
 *
 * 2. **It breathes slowly.** A fast pulse signals urgency. The candidate has
 *    just finished thinking hard; the interface should feel like it's
 *    considering their answer, not racing them.
 */

const STAGES = [
  'Reading your answer',
  'Assessing depth and reasoning',
  'Choosing what to ask next',
  'Writing the question',
]

export function ThinkingIndicator() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    // Advances on a timer and holds on the last stage. It reflects the real
    // pipeline order, but makes no claim to be a true progress bar — so it
    // never lands on "done" while the request is still in flight.
    const id = setInterval(() => {
      setStage((current) => Math.min(current + 1, STAGES.length - 1))
    }, 1400)
    return () => clearInterval(id)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-8 flex items-start gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="relative mt-0.5 flex size-7 shrink-0 items-center justify-center">
        <span className="absolute size-7 animate-breathe rounded-full bg-brand-500/20" />
        <span className="relative size-2 rounded-full bg-brand-400" />
      </div>

      <div className="min-w-0 flex-1 pt-1">
        <motion.p
          key={stage}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-ink-muted"
        >
          {STAGES[stage]}
          <span className="ml-0.5 inline-flex">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
              >
                .
              </motion.span>
            ))}
          </span>
        </motion.p>
      </div>
    </motion.div>
  )
}
