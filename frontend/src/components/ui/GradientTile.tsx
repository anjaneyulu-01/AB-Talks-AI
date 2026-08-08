import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The gradient icon tile — the single most recognisable element of the
 * campuscode / LeetCode-style look the design is now targeting.
 *
 * A rounded square with a vivid gradient fill, a white icon, and — crucially —
 * a soft COLOURED glow beneath it, so the tile reads as a small object lit from
 * within and floating just off the surface. The glow is a blurred copy of the
 * tile itself, which guarantees the glow always matches the gradient without
 * having to pass a second colour.
 *
 * `gradient` is a Tailwind `from-… to-…` pair (see lib/categoryColors.ts).
 */

const SIZES = {
  sm: 'size-9 rounded-lg [&>svg]:size-4',
  md: 'size-11 rounded-xl [&>svg]:size-5',
  lg: 'size-14 rounded-2xl [&>svg]:size-7',
  xl: 'size-16 rounded-2xl [&>svg]:size-8',
} as const

export function GradientTile({
  icon: Icon,
  gradient,
  size = 'md',
  className,
  glow = true,
}: {
  icon: LucideIcon
  gradient: string
  size?: keyof typeof SIZES
  className?: string
  glow?: boolean
}) {
  return (
    // `w-fit` is load-bearing: without it this block-level wrapper stretches to
    // the card's full width, and the `inset-0` glow below blurs into a wide
    // horizontal smudge instead of a tight square halo behind the tile.
    <div className={cn('relative w-fit shrink-0', className)}>
      {glow && (
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 bg-gradient-to-br opacity-45 blur-lg',
            SIZES[size].split(' ')[1], // reuse the rounding
            gradient,
          )}
        />
      )}
      <div
        className={cn(
          'relative flex items-center justify-center bg-gradient-to-br text-white',
          'shadow-[inset_0_1px_0_hsl(0_0%_100%/0.25)]',
          SIZES[size],
          gradient,
        )}
      >
        <Icon strokeWidth={2.25} />
      </div>
    </div>
  )
}

/**
 * The same treatment as an avatar — a gradient tile showing initials rather
 * than an icon. Used for candidate cards so people read as vivid, distinct
 * tiles the way category cards do in the reference.
 */
export function GradientAvatar({
  name,
  gradient,
  size = 'md',
  className,
}: {
  name: string
  gradient: string
  size?: keyof typeof SIZES
  className?: string
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  const text = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg', xl: 'text-xl' }[size]

  return (
    <div className={cn('relative w-fit shrink-0', className)}>
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-40 blur-lg',
          SIZES[size].split(' ')[1],
          gradient,
        )}
      />
      <div
        className={cn(
          'relative flex items-center justify-center bg-gradient-to-br font-bold text-white',
          'shadow-[inset_0_1px_0_hsl(0_0%_100%/0.25)]',
          SIZES[size].replace(/\[&>svg\]:size-\S+/, ''),
          text,
          gradient,
        )}
        aria-hidden
      >
        {initials}
      </div>
    </div>
  )
}
