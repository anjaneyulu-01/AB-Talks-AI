import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import type { Competency, EvidenceStrength, Recommendation, ScoreBand } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ---------------------------------------------------------------------------
 * Score semantics
 *
 * A colour must mean the same thing everywhere in the product. These helpers
 * are the only place that maps a number to a visual treatment, so the live
 * rail, the report and the dashboard can never drift apart.
 * ------------------------------------------------------------------------ */

export function scoreBand(score: number): ScoreBand {
  if (score >= 85) return 'exceptional'
  if (score >= 70) return 'strong'
  if (score >= 50) return 'developing'
  return 'emerging'
}

/**
 * `css` resolves through the theme token rather than a fixed hex.
 *
 * Inline styles and SVG attributes accept `hsl(var(--x))` directly, so a bar
 * or chart stroke that reads from here re-colours on theme switch for free.
 * Hardcoded hexes would have kept the dark-mode palette in light mode — where
 * the dark emerald sits at roughly 1.9:1 against white and is unreadable.
 */
export const BAND_STYLES: Record<
  ScoreBand,
  {
    text: string
    bg: string
    border: string
    ring: string
    css: string
    glow: string
    label: string
  }
> = {
  exceptional: {
    text: 'text-band-exceptional',
    bg: 'bg-band-exceptional/10',
    border: 'border-band-exceptional/25',
    ring: 'stroke-band-exceptional',
    css: 'hsl(var(--band-exceptional))',
    glow: 'hsl(var(--band-exceptional) / 0.35)',
    label: 'Exceptional',
  },
  strong: {
    text: 'text-band-strong',
    bg: 'bg-band-strong/10',
    border: 'border-band-strong/25',
    ring: 'stroke-band-strong',
    css: 'hsl(var(--band-strong))',
    glow: 'hsl(var(--band-strong) / 0.35)',
    label: 'Strong',
  },
  developing: {
    text: 'text-band-developing',
    bg: 'bg-band-developing/10',
    border: 'border-band-developing/25',
    ring: 'stroke-band-developing',
    css: 'hsl(var(--band-developing))',
    glow: 'hsl(var(--band-developing) / 0.35)',
    label: 'Developing',
  },
  emerging: {
    text: 'text-band-emerging',
    bg: 'bg-band-emerging/10',
    border: 'border-band-emerging/25',
    ring: 'stroke-band-emerging',
    css: 'hsl(var(--band-emerging))',
    glow: 'hsl(var(--band-emerging) / 0.35)',
    label: 'Emerging',
  },
}

export function bandStyle(score: number) {
  return BAND_STYLES[scoreBand(score)]
}

/* ---------------------------------------------------------------------------
 * Domain labels
 * ------------------------------------------------------------------------ */

export const COMPETENCY_LABELS: Record<Competency, string> = {
  technical_knowledge: 'Technical Knowledge',
  architecture: 'Architecture',
  problem_solving: 'Problem Solving',
  communication: 'Communication',
  reasoning: 'Reasoning',
  confidence: 'Confidence',
}

export const COMPETENCY_SHORT: Record<Competency, string> = {
  technical_knowledge: 'Technical',
  architecture: 'Architecture',
  problem_solving: 'Problem Solving',
  communication: 'Communication',
  reasoning: 'Reasoning',
  confidence: 'Confidence',
}

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Foundational',
  2: 'Applied',
  3: 'Analytical',
  4: 'Design',
  5: 'Adversarial',
}

/**
 * How each evidence strength is presented to the candidate.
 *
 * The copy here is doing real emotional work. "Didn't pass" is stated plainly
 * but never styled as a failure state, and `skipped` is framed as *off limits*
 * rather than as a deficiency — because in this product it genuinely is.
 */
export const EVIDENCE_META: Record<
  EvidenceStrength,
  { label: string; text: string; bg: string; dot: string; blurb: string }
> = {
  mastered: {
    label: 'First try',
    text: 'text-band-exceptional',
    bg: 'bg-band-exceptional/10',
    dot: 'bg-band-exceptional',
    blurb: 'Cleared on the first attempt — questions here go deep',
  },
  solid: {
    label: 'Solid',
    text: 'text-band-strong',
    bg: 'bg-band-strong/10',
    dot: 'bg-band-strong',
    blurb: 'Cleared in a couple of attempts — probed normally',
  },
  struggled: {
    label: 'Took effort',
    text: 'text-band-developing',
    bg: 'bg-band-developing/10',
    dot: 'bg-band-developing',
    blurb: 'Took four or five attempts — the highest-value probe in the interview',
  },
  failed: {
    label: "Didn't pass",
    text: 'text-band-emerging',
    bg: 'bg-band-emerging/10',
    dot: 'bg-band-emerging',
    blurb: 'Approached as a diagnostic, never as a gotcha',
  },
  skipped: {
    label: 'Skipped',
    text: 'text-ink-subtle',
    bg: 'bg-white/[0.04]',
    dot: 'bg-ink-faint',
    blurb: "Never covered — so you'll never be asked about it",
  },
  not_attempted: {
    label: 'Not attempted',
    text: 'text-ink-subtle',
    bg: 'bg-white/[0.04]',
    dot: 'bg-ink-faint',
    blurb: 'No record — excluded from the interview',
  },
}

export const RECOMMENDATION_META: Record<
  Recommendation,
  { label: string; text: string; bg: string; border: string }
> = {
  strong_hire: {
    label: 'Strong Hire',
    text: 'text-band-exceptional',
    bg: 'bg-band-exceptional/10',
    border: 'border-band-exceptional/30',
  },
  hire: {
    label: 'Hire',
    text: 'text-band-strong',
    bg: 'bg-band-strong/10',
    border: 'border-band-strong/30',
  },
  lean_hire: {
    label: 'Lean Hire',
    text: 'text-band-developing',
    bg: 'bg-band-developing/10',
    border: 'border-band-developing/30',
  },
  not_yet: {
    label: 'Not Yet',
    text: 'text-brand-300',
    bg: 'bg-brand-500/10',
    border: 'border-brand-500/30',
  },
}

/**
 * The action the controller took, in candidate-facing language.
 *
 * Note what's absent: no action is ever labelled as a judgement. "Ease off"
 * becomes "Reframing", not "You struggled". The candidate sees the mechanism
 * without being handed a verdict mid-interview.
 */
export const ACTION_META: Record<string, { label: string; tone: string }> = {
  open: { label: 'Opening', tone: 'text-brand-300' },
  advance: { label: 'New topic', tone: 'text-ink-muted' },
  follow_up: { label: 'Following up', tone: 'text-accent-cyan' },
  drill_down: { label: 'Going deeper', tone: 'text-band-exceptional' },
  ease_off: { label: 'Reframing', tone: 'text-band-developing' },
  pivot: { label: 'Moving on', tone: 'text-ink-muted' },
  close: { label: 'Wrapping up', tone: 'text-brand-300' },
}

/* ---------------------------------------------------------------------------
 * Formatting
 * ------------------------------------------------------------------------ */

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Deterministic avatar tint, so a person keeps the same colour everywhere. */
export function avatarTint(seed: string): string {
  const tints = [
    'from-brand-500/25 to-accent-cyan/20',
    'from-accent-teal/25 to-brand-400/20',
    'from-band-developing/20 to-brand-500/20',
    'from-brand-400/25 to-band-emerging/15',
    'from-accent-cyan/25 to-brand-600/20',
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return tints[hash % tints.length]
}
