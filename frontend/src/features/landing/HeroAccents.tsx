import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Hand-drawn underline beneath a key phrase.
 *
 * A slightly irregular SVG path rather than a straight rule — the wobble is
 * what makes it read as *drawn* rather than as a CSS border, and that single
 * detail does more for the "crafted" impression than another gradient would.
 *
 * Draws itself via `pathLength`, which normalises the path to 0–1 so the
 * dash animation works without measuring the real geometry.
 */
export function Underline({
  children,
  className,
  delay = 0.8,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduceMotion = useReducedMotion()

  return (
    <span className={cn('relative inline-block', className)}>
      {children}
      <svg
        aria-hidden
        viewBox="0 0 200 12"
        preserveAspectRatio="none"
        // Sits just below the baseline and is allowed to overhang slightly on
        // both sides, the way a real pen stroke would.
        className="absolute -bottom-1 left-[-2%] h-[0.38em] w-[104%] overflow-visible"
      >
        <motion.path
          d="M2 8.5C28 5.2 62 3.4 100 3.9c34 .5 66 2.4 98 5.1"
          fill="none"
          stroke="url(#underline-gradient)"
          strokeWidth={5}
          strokeLinecap="round"
          initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.75, delay, ease: EASE_OUT }}
        />
        <defs>
          <linearGradient id="underline-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--brand-500))" />
            <stop offset="55%" stopColor="hsl(var(--accent-fuchsia))" />
            <stop offset="100%" stopColor="hsl(var(--accent-cyan))" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  )
}

/**
 * Evidence chips floating around the hero demo.
 *
 * Every chip carries a real row from `candidates.json` — Day 7 cleared first
 * try, Day 12 at five attempts, Day 28 skipped. So the decoration is also the
 * argument: the thing orbiting the demo is precisely the data the demo is
 * deriving its question from.
 *
 * Hidden below `xl`. Absolutely-positioned satellites need room to breathe;
 * crammed against a narrow column they overlap the content and look like a
 * mistake rather than a flourish.
 */

interface Chip {
  day: number
  label: string
  value: string
  tone: string
  position: string
  drift: { y: number[]; x?: number[] }
  duration: number
  delay: number
}

const CHIPS: Chip[] = [
  {
    day: 7,
    label: 'Embeddings',
    value: '1 attempt',
    tone: 'text-band-exceptional border-band-exceptional/30 bg-band-exceptional/[0.08]',
    position: '-left-14 top-[14%]',
    drift: { y: [0, -10, 0], x: [0, 4, 0] },
    duration: 6.5,
    delay: 1.0,
  },
  {
    day: 12,
    label: 'Prompt Eng.',
    value: '5 attempts',
    tone: 'text-band-developing border-band-developing/30 bg-band-developing/[0.08]',
    position: '-right-12 top-[38%]',
    drift: { y: [0, 12, 0], x: [0, -5, 0] },
    duration: 7.8,
    delay: 1.15,
  },
  {
    day: 28,
    label: 'Docker & K8s',
    value: 'skipped',
    tone: 'text-ink-subtle border-line-strong bg-tint/[0.04]',
    position: '-left-10 bottom-[16%]',
    drift: { y: [0, 9, 0], x: [0, 6, 0] },
    duration: 7.1,
    delay: 1.3,
  },
]

export function FloatingEvidence() {
  const reduceMotion = useReducedMotion()

  return (
    <div className="pointer-events-none absolute inset-0 hidden xl:block" aria-hidden>
      {CHIPS.map((chip) => (
        <motion.div
          key={chip.day}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: chip.delay, ease: EASE_OUT }}
          className={cn('absolute', chip.position)}
        >
          <motion.div
            animate={reduceMotion ? undefined : chip.drift}
            transition={{
              duration: chip.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 shadow-raised backdrop-blur-md',
              'bg-surface/90',
            )}
          >
            <span
              className={cn(
                'nums rounded-md border px-1.5 py-0.5 text-[0.625rem] font-semibold',
                chip.tone,
              )}
            >
              D{chip.day}
            </span>
            <div className="leading-tight">
              <p className="text-[0.6875rem] font-medium text-ink">{chip.label}</p>
              <p className="text-[0.625rem] text-ink-faint">{chip.value}</p>
            </div>
          </motion.div>
        </motion.div>
      ))}
    </div>
  )
}
