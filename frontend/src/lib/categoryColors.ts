/**
 * Category colour system.
 *
 * The reference designs (campuscode / LeetCode-style) get their vivid,
 * "rainbow" feeling from a DISCIPLINE, not from chaos: every category owns one
 * consistent colour, applied to its top-border, icon tile, button and progress
 * ring. A grid of those categories then reads as a bright spectrum while each
 * individual card stays coherent.
 *
 * That maps cleanly onto our real taxonomy — candidates, curriculum modules and
 * difficulty levels — so the colour is meaningful, never decorative noise.
 *
 * Every string here is a literal Tailwind gradient pair so the scanner
 * generates the classes. All hues come from the existing token palette, so
 * they stay theme-aware and accessible.
 */

/** Eight well-separated gradient pairs — the spectrum a card grid cycles through. */
export const CARD_SPECTRUM: string[] = [
  'from-brand-500 to-accent-violet',
  'from-accent-cyan to-accent-sky',
  'from-band-exceptional to-accent-teal',
  'from-accent-amber to-warn',
  'from-band-emerging to-accent-violet',
  'from-accent-sky to-accent-cyan',
  'from-accent-violet to-brand-500',
  'from-accent-teal to-band-exceptional',
]

/** Deterministic pick, so a given candidate always gets the same colour. */
export function cardGradient(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return CARD_SPECTRUM[hash % CARD_SPECTRUM.length]
}

/** Soft translucent version of the same, for icon-tile fills and washes. */
export function cardGradientSoft(seed: string): string {
  const g = cardGradient(seed)
  return g
    .replace(/from-(\S+)/, 'from-$1/15')
    .replace(/to-(\S+)/, 'to-$1/10')
}

/**
 * Difficulty as a heat ramp: easy = calm green, hard = hot red — exactly the
 * green→amber→red language the reference difficulty cards use, extended to our
 * five levels.
 */
export const DIFFICULTY_GRADIENT: Record<number, string> = {
  1: 'from-band-exceptional to-accent-teal', // Foundational — green
  2: 'from-accent-teal to-accent-cyan', // Applied — teal
  3: 'from-accent-sky to-brand-500', // Analytical — blue/indigo
  4: 'from-accent-amber to-warn', // Design — amber
  5: 'from-band-emerging to-danger', // Adversarial — red
}

export const DIFFICULTY_SOLID: Record<number, string> = {
  1: 'text-band-exceptional',
  2: 'text-accent-teal',
  3: 'text-accent-sky',
  4: 'text-accent-amber',
  5: 'text-band-emerging',
}

/** One distinct hue per curriculum module (8), for module chips and rings. */
export const MODULE_GRADIENT: Record<number, string> = {
  1: 'from-brand-500 to-accent-violet',
  2: 'from-accent-sky to-accent-cyan',
  3: 'from-accent-cyan to-accent-teal',
  4: 'from-band-exceptional to-accent-teal',
  5: 'from-accent-amber to-warn',
  6: 'from-accent-violet to-brand-500',
  7: 'from-band-emerging to-accent-amber',
  8: 'from-brand-400 to-accent-sky',
}
