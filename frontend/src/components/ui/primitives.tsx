/**
 * Core design-system primitives.
 *
 * Everything visual in the product is built from these. They're colocated in
 * one file deliberately: at this size, ten one-component files cost more in
 * navigation than they save in isolation, and keeping them together makes the
 * shared vocabulary (sizes, tones, radii) obvious at a glance.
 */

import { cva, type VariantProps } from 'class-variance-authority'
import { motion } from 'framer-motion'
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'

import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ Button */

const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium',
    'transition-all duration-200 ease-premium',
    'disabled:pointer-events-none disabled:opacity-40',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-base',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ),
  {
    variants: {
      variant: {
        // The one primary action per screen. It is the only element that
        // gets a glow *and* the only one with a sheen — scarcity is what
        // makes it read as "the" action rather than decoration.
        //
        // `bg-cta`/`text-cta-fg` rather than a brand step: the fill/text
        // relationship INVERTS between themes (dark green + white in light,
        // bright green + dark ink in dark), and one colour cannot serve both
        // and stay accessible.
        primary: cn(
          'group/btn relative overflow-hidden bg-cta text-cta-fg shadow-glow',
          'hover:bg-cta-hover hover:shadow-glow-lg',
          'active:scale-[0.985]',
        ),
        secondary: cn(
          'border border-line-strong bg-surface-raised text-ink shadow-soft',
          'hover:border-line-strong hover:bg-surface-hover hover:shadow-raised',
          'active:scale-[0.985]',
        ),
        ghost: 'text-ink-muted hover:bg-tint/[0.06] hover:text-ink',
        outline: cn(
          'border border-line-strong text-ink',
          'hover:border-brand-500/50 hover:bg-brand-500/[0.07] hover:text-brand-300',
        ),
        danger: 'bg-danger/15 text-danger hover:bg-danger/25',
      },
      size: {
        sm: 'h-8 px-3 text-[0.8125rem] [&_svg]:size-3.5',
        md: 'h-10 px-4 text-sm [&_svg]:size-4',
        lg: 'h-12 px-6 text-[0.9375rem] [&_svg]:size-[1.125rem]',
        icon: 'size-9 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {/* A single highlight sweeping across on hover. Pointer-events-none and
          motion-safe only — it is pure decoration and must never intercept a
          click or fire for someone who asked for reduced motion. */}
      {variant === 'primary' && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 opacity-0',
            'bg-gradient-to-r from-transparent via-white/25 to-transparent',
            'motion-safe:group-hover/btn:animate-sheen motion-safe:group-hover/btn:opacity-100',
          )}
        />
      )}
      {loading && (
        <span
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  ),
)
Button.displayName = 'Button'

/* -------------------------------------------------------------------- Card */

export function Card({
  className,
  hover,
  ...props
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return <div className={cn('card', hover && 'card-hover', className)} {...props} />
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-6 pb-4', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-h3 text-ink', className)} {...props} />
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm leading-relaxed text-ink-muted', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-3 border-t border-line p-6', className)} {...props} />
  )
}

/* ------------------------------------------------------------------- Badge */

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors',
  {
    variants: {
      tone: {
        neutral: 'border-line-strong bg-tint/[0.05] text-ink-muted',
        brand: 'border-brand-500/30 bg-brand-500/10 text-brand-300',
        cyan: 'border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan',
        success: 'border-success/30 bg-success/10 text-success',
        warn: 'border-warn/30 bg-warn/10 text-warn',
        danger: 'border-danger/30 bg-danger/10 text-danger',
        outline: 'border-line-strong bg-transparent text-ink-subtle',
      },
      size: {
        sm: 'px-2 py-0.5 text-[0.6875rem]',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'sm' },
  },
)

export function Badge({
  className,
  tone,
  size,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />
}

/* ---------------------------------------------------------------- Progress */

export function Progress({
  value,
  className,
  tone = 'brand',
  showTrack = true,
}: {
  value: number
  className?: string
  tone?: 'brand' | 'success' | 'warn' | 'danger'
  showTrack?: boolean
}) {
  const tones = {
    brand: 'from-brand-500 to-accent-cyan',
    success: 'from-success to-accent-teal',
    warn: 'from-warn to-band-developing',
    danger: 'from-danger to-band-emerging',
  }
  return (
    <div
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full',
        showTrack && 'bg-tint/[0.07]',
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={cn('h-full rounded-full bg-gradient-to-r', tones[tone])}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} {...props} />
}

/* ------------------------------------------------------------------ Avatar */

export function Avatar({
  name,
  tint,
  size = 'md',
  className,
}: {
  name: string
  tint: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    sm: 'size-8 text-xs',
    md: 'size-11 text-sm',
    lg: 'size-14 text-base',
  }
  const letters = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-line-strong',
        'bg-gradient-to-br font-semibold text-ink',
        tint,
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {letters}
    </div>
  )
}

/* ------------------------------------------------------------- Empty state */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed',
        'border-line-strong bg-tint/[0.015] px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-2xl border border-line bg-surface-raised text-ink-subtle">
          {icon}
        </div>
      )}
      <div className="max-w-sm space-y-1.5">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm leading-relaxed text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  )
}

/* ---------------------------------------------------------------- Textarea */

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full resize-none rounded-xl border border-line-strong bg-base-200 px-4 py-3',
      'text-[0.9375rem] leading-relaxed text-ink placeholder:text-ink-faint',
      'transition-colors duration-200',
      'focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
      'disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

/* ----------------------------------------------------------------- Tooltip */

/**
 * CSS-only tooltip.
 *
 * A full popover library is ~15kb for something that never needs collision
 * detection here — every tooltip in this product sits in open space. Uses
 * `group-focus-within` so it's reachable by keyboard, not just hover.
 */
export function Tooltip({
  label,
  children,
  side = 'top',
  className,
}: {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom'
  className?: string
}) {
  return (
    <span className={cn('group relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 w-max max-w-[16rem] -translate-x-1/2',
          'rounded-lg border border-line-strong bg-surface-overlay px-2.5 py-1.5',
          'text-xs leading-snug text-ink shadow-float',
          'opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 group-focus-within:opacity-100',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        )}
      >
        {label}
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------ Stat */

export function Stat({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: string
  className?: string
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <p className="eyebrow">{label}</p>
      <p className={cn('nums text-2xl font-semibold tracking-tight text-ink', tone)}>{value}</p>
      {hint && <p className="text-xs leading-snug text-ink-subtle">{hint}</p>}
    </div>
  )
}

/* --------------------------------------------------------------- Separator */

export function Separator({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line', className)} />
}

/* ------------------------------------------------------------------ Shell */

/** Consistent page width and gutters across every route. */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-[76rem] px-5 sm:px-8', className)} {...props} />
}
