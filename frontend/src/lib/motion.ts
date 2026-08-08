/**
 * Shared motion language.
 *
 * Previously every component inlined its own `{ duration: 0.5, ease: [...] }`,
 * with the numbers drifting apart screen by screen. Motion that varies without
 * reason is what makes an interface feel assembled rather than designed, so
 * every transition in the product now comes from here.
 *
 * ## The rules this encodes
 *
 * **One curve does most of the work.** `EASE_OUT` (a strong ease-out) suits
 * anything entering or settling — the overwhelming majority of motion here.
 *
 * **Springs for anything the user directly moved.** A drag, a toggle, a sheet.
 * Springs carry a sense of physical response that a duration curve cannot.
 *
 * **Nothing exceeds ~600ms.** Beyond that, motion stops reading as polish and
 * starts reading as latency.
 *
 * **Distances stay small.** 8–16px. Large travel draws attention to the
 * animation itself; small travel just makes the arrival feel intentional.
 */

import type { Transition, Variants } from 'framer-motion'

/** Strong ease-out. The default for entrances and settling. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const

/** Gentle overshoot. For things that *appear* rather than move. */
export const EASE_BACK = [0.34, 1.4, 0.64, 1] as const

/** Symmetric. For reversible state — expand/collapse, toggles. */
export const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const

export const DURATION = {
  fast: 0.2,
  base: 0.35,
  slow: 0.55,
} as const

/* -------------------------------------------------------------- Springs */

/** Responsive without wobble. Sheets, drawers, layout shifts. */
export const SPRING: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 32,
}

/** Snappier, for small elements like a toggle indicator. */
export const SPRING_SNAPPY: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
}

/* ------------------------------------------------------------- Variants */

/** The workhorse entrance. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE_BACK } },
}

/**
 * Parent variant that cascades children.
 *
 * `staggerChildren` is deliberately small (~45ms). A long stagger looks
 * impressive on a three-item list and becomes an unbearable wait on a
 * twenty-item one — and this product renders lists of both sizes.
 */
export function staggerContainer(stagger = 0.045, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  }
}

/** Scroll-triggered entrance props, applied consistently across sections. */
export const revealOnScroll = {
  initial: 'hidden',
  whileInView: 'visible',
  viewport: { once: true, margin: '-80px' },
  variants: fadeUp,
} as const

/**
 * Caps the index used for stagger delays.
 *
 * Without a cap, item 40 in a list waits 1.8 seconds to appear — which reads
 * as a broken page, not a considered one.
 */
export function staggerDelay(index: number, step = 0.04, max = 0.3): number {
  return Math.min(index * step, max)
}
