/**
 * The score ring — the product's signature data element.
 *
 * Used for the overall report score and the live readiness indicator. Two
 * details make it feel considered rather than generic:
 *
 * 1. The arc draws from zero on mount rather than snapping to its value. On
 *    the report screen this gives the number a small moment of ceremony; the
 *    score is the thing the candidate came for.
 * 2. The number counts up alongside the arc. Tabular figures keep it from
 *    jittering as digits change width.
 */

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect, useState } from 'react'

import { bandStyle, cn } from '@/lib/utils'

interface ScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
  label?: string
  sublabel?: string
  animate?: boolean
  className?: string
}

export function ScoreRing({
  score,
  size = 160,
  strokeWidth = 10,
  label,
  sublabel,
  animate = true,
  className,
}: ScoreRingProps) {
  const band = bandStyle(score)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))

  const [display, setDisplay] = useState(animate ? 0 : clamped)

  useEffect(() => {
    if (!animate) {
      setDisplay(clamped)
      return
    }
    // Match the arc's spring so the number and the sweep land together.
    const duration = 1100
    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(eased * clamped))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [clamped, animate])

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? 'Score'}: ${clamped} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-tint/[0.07]"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          className={band.ring}
          initial={{ strokeDashoffset: animate ? circumference : circumference * (1 - clamped / 100) }}
          animate={{ strokeDashoffset: circumference * (1 - clamped / 100) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${band.glow})` }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn('nums font-bold leading-none tracking-tight', band.text)}
          style={{ fontSize: size * 0.28 }}
        >
          {display}
        </span>
        {label && (
          <span
            className="mt-1.5 font-medium uppercase tracking-[0.1em] text-ink-subtle"
            style={{ fontSize: Math.max(9, size * 0.062) }}
          >
            {label}
          </span>
        )}
        {sublabel && (
          <span
            className="mt-0.5 text-ink-faint"
            style={{ fontSize: Math.max(9, size * 0.058) }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Compact horizontal score bar for competency breakdowns.
 *
 * Chosen over a radar chart for the report body: radar looks impressive but is
 * genuinely hard to read precise values from, and this screen's job is to tell
 * someone exactly where they stand.
 */
export function ScoreBar({
  label,
  score,
  hint,
  delay = 0,
}: {
  label: string
  score: number
  hint?: string
  delay?: number
}) {
  const band = bandStyle(score)
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className={cn('nums text-sm font-semibold', band.text)}>{score}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-tint/[0.07]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: band.css }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {hint && <p className="text-xs leading-snug text-ink-subtle">{hint}</p>}
    </div>
  )
}

/** Animated counter for dashboard stat tiles. */
export function CountUp({
  value,
  duration = 900,
  suffix = '',
  className,
}: {
  value: number
  duration?: number
  suffix?: string
  className?: string
}) {
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { duration, bounce: 0 })
  const rounded = useTransform(spring, (latest) => Math.round(latest))
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    motionValue.set(value)
    return rounded.on('change', setDisplay)
  }, [value, motionValue, rounded])

  return (
    <span className={cn('nums', className)}>
      {display}
      {suffix}
    </span>
  )
}
