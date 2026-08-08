/**
 * Mobile bottom sheet.
 *
 * Exists because the interview's live telemetry — readiness, competency
 * signal, the adaptive path — was previously `hidden lg:block`. On a 390px
 * phone that silently deleted the product's most distinctive feature for the
 * majority of users. Hiding content is not responsive design; relocating it is.
 *
 * A sheet rather than a modal because it preserves context: the conversation
 * stays visible behind it, so checking your progress never feels like leaving
 * the interview.
 *
 * Accessibility is handled properly rather than approximately: focus moves in
 * on open and returns to the trigger on close, Escape dismisses, background
 * scroll locks, and the panel is a labelled `dialog`. A sheet you cannot
 * escape with a keyboard is a trap.
 */

import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    restoreFocusTo.current = document.activeElement as HTMLElement | null
    // Defer so the panel exists before we move focus into it.
    const raf = requestAnimationFrame(() => panelRef.current?.focus())

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    // Lock background scroll so dragging the sheet doesn't scroll the
    // transcript underneath it.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      restoreFocusTo.current?.focus()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-base-900/70 backdrop-blur-sm lg:hidden"
            aria-hidden
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            // Drag-to-dismiss: the gesture people already expect from a sheet.
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 520) onClose()
            }}
            className={cn(
              'fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col lg:hidden',
              'rounded-t-3xl border-t border-line-strong bg-surface shadow-float',
              'focus:outline-none',
              className,
            )}
          >
            <div className="shrink-0 px-5 pb-2 pt-3">
              <div className="mx-auto h-1 w-10 rounded-full bg-white/15" aria-hidden />
              <div className="mt-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">{title}</h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="flex size-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pb-safe">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
