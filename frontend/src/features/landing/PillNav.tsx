import { motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Button } from '@/components/ui/primitives'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Floating pill navigation.
 *
 * Detached from the viewport edge rather than welded to it. The gap is what
 * makes it read as an object sitting *above* the page instead of a browser
 * chrome bar, and it lets the aurora show through underneath — which ties the
 * nav into the hero rather than cutting it off.
 *
 * It reacts to scroll: at rest it is barely there, and once the page moves it
 * tightens and gains a shadow so it stays legible over whatever passes beneath.
 * Tracked with `useMotionValueEvent` against a threshold rather than mapping
 * scroll continuously — this is a two-state change, and re-rendering on every
 * scroll frame to drive it would be waste.
 */

const LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#capabilities', label: 'Why it works' },
  { href: '#voices', label: 'Voices' },
]

export function PillNav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const next = latest > 24
    if (next !== scrolled) setScrolled(next)
  })

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE_OUT }}
      className="fixed inset-x-0 top-3 z-50 px-3 sm:top-4 sm:px-5"
    >
      <nav
        className={cn(
          'mx-auto flex max-w-5xl items-center gap-2 rounded-full border px-2 py-2 sm:px-3',
          'backdrop-blur-xl transition-all duration-400 ease-premium',
          scrolled
            ? 'border-line-strong bg-surface/85 shadow-raised'
            : 'border-line bg-surface/55 shadow-soft',
        )}
      >
        <Link
          to="/"
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-full pl-1 pr-2"
        >
          <Logo className="size-7 shrink-0" />
          <span className="truncate text-[0.9375rem] font-semibold tracking-tight text-ink">
            ABTalks
          </span>
        </Link>

        {/* Centre links. Hidden below `lg` where the pill has no room — the
            mobile sheet below carries them instead. */}
        <div className="mx-auto hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-full px-3.5 py-2 text-sm font-medium text-ink-muted',
                'transition-colors duration-200 hover:bg-tint/[0.06] hover:text-ink',
              )}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 lg:ml-0">
          <ThemeToggle className="hidden sm:flex" />

          <Link to="/dashboard">
            <Button variant="primary" size="sm" className="rounded-full">
              <span className="hidden sm:inline">Start an interview</span>
              <span className="sm:hidden">Start</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-tint/[0.06] lg:hidden"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu, as a second floating pill so it reads as part of the
          same object rather than a full-screen takeover. */}
      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
          className="mx-auto mt-2 max-w-5xl overflow-hidden rounded-2xl border border-line-strong bg-surface/95 p-2 shadow-float backdrop-blur-xl lg:hidden"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-medium text-ink-muted transition-colors hover:bg-tint/[0.05] hover:text-ink"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-line px-4 py-3 sm:hidden">
            <span className="text-sm text-ink-muted">Theme</span>
            <ThemeToggle />
          </div>
        </motion.div>
      )}
    </motion.header>
  )
}
