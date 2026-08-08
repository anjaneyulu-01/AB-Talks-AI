/**
 * Visual effect primitives.
 *
 * These are the details that separate a page that looks *designed* from one
 * that looks templated. Each is deliberately cheap: transform/opacity only,
 * GPU-composited, and every one of them degrades to nothing under
 * `prefers-reduced-motion` rather than being merely slowed down.
 *
 * The rule applied throughout: decoration is `pointer-events-none` and
 * `aria-hidden`. None of it may ever intercept a click or reach a screen
 * reader.
 */

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ Grain */

/**
 * Film grain.
 *
 * The single highest-leverage detail on this list. Flat digital gradients read
 * as *cheap* because nothing in the physical world is that smooth; a few
 * percent of noise on top makes large colour fields feel like a material.
 *
 * Generated as an inline SVG turbulence filter — no image request, a couple of
 * hundred bytes, and it tiles perfectly.
 */
export function Grain({ opacity = 0.035 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] mix-blend-overlay"
      style={{
        opacity,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat',
        backgroundSize: '180px 180px',
      }}
    />
  )
}

/* ----------------------------------------------------------------- Aurora */

/**
 * Slow drifting gradient mesh — the page's signature visual.
 *
 * Three blurred orbs on independent, prime-ish durations so the loop never
 * visibly repeats. Movement is slow enough (18–26s) to register as atmosphere
 * rather than animation; anything faster competes with the copy for attention.
 */
export function Aurora({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()

  // Opacities are set per theme, not shared. A 16% violet orb blurred over a
  // near-black ground reads as depth; the same orb over warm white reads as a
  // faint smudge — light backgrounds need roughly twice the saturation to
  // register at all, which is why the first pass looked washed out.
  const orbs = [
    {
      className:
        'left-[8%] top-[-12%] size-[40rem] bg-brand-500/[0.30] dark:bg-brand-500/[0.16]',
      animate: { x: [0, 60, -30, 0], y: [0, 40, 20, 0] },
      duration: 22,
    },
    {
      className:
        'right-[4%] top-[8%] size-[34rem] bg-accent-fuchsia/[0.22] dark:bg-accent-fuchsia/[0.12]',
      animate: { x: [0, -50, 30, 0], y: [0, 50, -20, 0] },
      duration: 26,
    },
    {
      className:
        'left-[32%] top-[38%] size-[36rem] bg-accent-cyan/[0.20] dark:bg-accent-cyan/[0.10]',
      animate: { x: [0, 40, -50, 0], y: [0, -30, 40, 0] },
      duration: 19,
    },
  ]

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className={cn('absolute rounded-full blur-[110px]', orb.className)}
          animate={reduceMotion ? undefined : orb.animate}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

/* --------------------------------------------------------------- Spotlight */

/**
 * A soft light that follows the cursor across a surface.
 *
 * Tracked with motion values rather than React state — a `setState` on every
 * `mousemove` would re-render the subtree ~60 times a second. Motion values
 * write straight to the compositor and skip React entirely.
 *
 * Disabled on coarse pointers: there is no cursor to follow on a phone, and
 * the listener would be pure cost.
 */
export function Spotlight({
  children,
  className,
  size = 380,
  color = 'hsl(var(--brand-500) / 0.13)',
}: {
  children: ReactNode
  className?: string
  size?: number
  color?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)
  const mouseX = useMotionValue(-9999)
  const mouseY = useMotionValue(-9999)

  useEffect(() => {
    setEnabled(window.matchMedia('(pointer: fine)').matches)
  }, [])

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      mouseX.set(e.clientX - rect.left)
      mouseY.set(e.clientY - rect.top)
    },
    [mouseX, mouseY],
  )

  const background = useMotionTemplate`radial-gradient(${size}px circle at ${mouseX}px ${mouseY}px, ${color}, transparent 70%)`

  return (
    <div
      ref={ref}
      onMouseMove={enabled ? onMove : undefined}
      onMouseLeave={() => {
        mouseX.set(-9999)
        mouseY.set(-9999)
      }}
      className={cn('relative', className)}
    >
      {enabled && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500"
          style={{ background }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

/* ----------------------------------------------------- Gradient-border card */

/**
 * A card whose border is a gradient, with the fill masked out of it.
 *
 * Done with a padded gradient wrapper rather than `border-image` — that
 * property does not respect `border-radius`, which is the one thing this
 * effect needs. One pixel of padding *is* the border.
 */
export function GradientBorder({
  children,
  className,
  innerClassName,
  glow = false,
}: {
  children: ReactNode
  className?: string
  innerClassName?: string
  glow?: boolean
}) {
  return (
    <div
      className={cn(
        'relative rounded-[1.2rem] p-px',
        'bg-gradient-to-br from-brand-500/40 via-accent-fuchsia/20 to-accent-cyan/30',
        glow && 'shadow-[0_0_40px_-12px_hsl(var(--brand-500)/0.5)]',
        className,
      )}
    >
      <div className={cn('h-full rounded-[1.15rem] bg-surface', innerClassName)}>
        {children}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- Tilt card */

/**
 * Subtle 3D tilt toward the cursor.
 *
 * Capped at ±5 degrees. Beyond roughly 8 the effect stops reading as depth and
 * starts reading as a gimmick — and text inside begins to visibly distort.
 * Springs on the rotation so it settles rather than snapping.
 */
export function TiltCard({
  children,
  className,
  max = 5,
}: {
  children: ReactNode
  className?: string
  max?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const [enabled, setEnabled] = useState(false)

  const rotateX = useSpring(0, { stiffness: 260, damping: 26 })
  const rotateY = useSpring(0, { stiffness: 260, damping: 26 })

  useEffect(() => {
    setEnabled(window.matchMedia('(pointer: fine)').matches && !reduceMotion)
  }, [reduceMotion])

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    rotateY.set(px * max * 2)
    rotateX.set(-py * max * 2)
  }

  if (!enabled) return <div className={className}>{children}</div>

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => {
        rotateX.set(0)
        rotateY.set(0)
      }}
      style={{ rotateX, rotateY, transformPerspective: 1200 }}
      className={cn('[transform-style:preserve-3d]', className)}
    >
      {children}
    </motion.div>
  )
}

/* ---------------------------------------------------------------- Marquee */

/**
 * Infinite horizontal scroll.
 *
 * The track is duplicated and translated by exactly -50%, so the seam lands on
 * an identical frame and the loop is invisible. Pauses on hover, because a
 * moving target you cannot read is an accessibility problem as much as a
 * usability one.
 */
export function Marquee({
  children,
  speed = 40,
  className,
}: {
  children: ReactNode
  speed?: number
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return (
      <div className={cn('flex flex-wrap justify-center gap-3', className)}>{children}</div>
    )
  }

  return (
    <div
      className={cn(
        'group relative flex overflow-hidden',
        // Fades both ends into the page so items enter and leave rather than
        // being abruptly clipped by the viewport edge.
        '[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]',
        className,
      )}
    >
      {[0, 1].map((copy) => (
        <motion.div
          key={copy}
          aria-hidden={copy === 1}
          animate={{ x: ['0%', '-100%'] }}
          transition={{ duration: speed, repeat: Infinity, ease: 'linear' }}
          className="flex shrink-0 items-center gap-3 pr-3 group-hover:[animation-play-state:paused]"
        >
          {children}
        </motion.div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ Scroll cue */

export function ScrollCue({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()
  return (
    <div
      aria-hidden
      className={cn('flex h-9 w-5 justify-center rounded-full border border-line-strong p-1', className)}
    >
      <motion.span
        animate={reduceMotion ? undefined : { y: [0, 12, 0], opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className="block h-1.5 w-1 rounded-full bg-ink-faint"
      />
    </div>
  )
}
