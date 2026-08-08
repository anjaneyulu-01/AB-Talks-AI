import { motion } from 'framer-motion'
import { Monitor, Moon, Sun } from 'lucide-react'

import { useTheme, type Theme } from '@/app/theme'
import { cn } from '@/lib/utils'

/**
 * Theme control.
 *
 * A three-way segmented control rather than a two-state switch, because
 * `system` is a real preference and collapsing it loses information: a user on
 * "system" wants the app to follow their phone at sunset, which a light/dark
 * toggle can't express.
 *
 * The active pill is a shared `layoutId`, so switching animates the indicator
 * across rather than cross-fading two rectangles. It costs nothing and is the
 * difference between a control that feels mechanical and one that feels built.
 */

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
]

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        'flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = theme === value
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'relative flex size-7 items-center justify-center rounded-[0.625rem]',
              'transition-colors duration-200',
              active ? 'text-ink' : 'text-ink-faint hover:text-ink-muted',
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-active-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-[0.625rem] bg-tint/[0.08]"
              />
            )}
            <Icon className="relative size-3.5" />
          </button>
        )
      })}
    </div>
  )
}

/**
 * Single-button variant for tight spaces (the interview top bar, where every
 * pixel is competing with the current question).
 */
export function ThemeToggleCompact({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
      className={cn(
        'relative flex size-9 items-center justify-center overflow-hidden rounded-lg',
        'text-ink-faint transition-colors hover:bg-tint/[0.06] hover:text-ink-muted',
        className,
      )}
    >
      <motion.span
        key={resolved}
        initial={{ y: 14, opacity: 0, rotate: -35 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center justify-center"
      >
        {resolved === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </motion.span>
    </button>
  )
}
