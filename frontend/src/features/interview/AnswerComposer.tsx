import { AlertCircle, Send } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

const MIN_HEIGHT = 88
const MAX_HEIGHT = 280

/**
 * The answer editor.
 *
 * Design notes worth defending:
 *
 * - **Auto-growing, capped.** It starts at three lines so the empty state
 *   doesn't feel like a demand for an essay, and grows to a ceiling so the
 *   conversation above never gets squeezed off screen.
 *
 * - **⌘/Ctrl+Enter to send, not bare Enter.** These are multi-paragraph
 *   technical answers with code in them. Bare-Enter-to-send would fire
 *   mid-thought constantly, and losing an answer that way is exactly the kind
 *   of small betrayal that makes a tool feel cheap.
 *
 * - **No character counter.** A counter implies a target length and turns an
 *   open question into a form field. Word count appears only once the answer
 *   is substantial, as reassurance rather than instruction.
 */
export function AnswerComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  pending,
  error,
  turn,
  plannedTurns,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
  pending: boolean
  error: string | null
  turn: number
  plannedTurns: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, el.scrollHeight))}px`
  }, [value])

  // Refocus once a turn completes so the candidate can keep typing without
  // reaching for the mouse.
  useEffect(() => {
    if (!pending) ref.current?.focus()
  }, [pending])

  const words = value.trim() ? value.trim().split(/\s+/).length : 0
  const canSubmit = value.trim().length > 0 && !disabled

  return (
    // `pb-safe` keeps the send button clear of the iPhone home indicator,
    // which otherwise overlaps it and makes the primary action hard to hit.
    <div className="shrink-0 border-t border-line bg-base/95 pb-safe backdrop-blur-xl">
      <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-8 sm:py-4">
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.07] px-3 py-2.5">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />
            <p className="text-xs leading-relaxed text-danger">{error}</p>
          </div>
        )}

        <div
          className={cn(
            'relative rounded-2xl border bg-surface transition-colors duration-200',
            'focus-within:border-brand-500/50 focus-within:ring-2 focus-within:ring-brand-500/20',
            disabled ? 'border-line opacity-60' : 'border-line-strong',
          )}
        >
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                onSubmit()
              }
            }}
            disabled={disabled}
            rows={3}
            aria-label="Your answer"
            placeholder="Think out loud. Partial reasoning is worth more than a polished guess…"
            className={cn(
              'w-full resize-none bg-transparent px-4 pb-12 pt-3.5',
              'text-[0.9375rem] leading-relaxed text-ink placeholder:text-ink-faint',
              'focus:outline-none disabled:cursor-not-allowed',
            )}
            style={{ minHeight: MIN_HEIGHT }}
          />

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-3 pb-3">
            <div className="flex items-center gap-3 text-[0.6875rem] text-ink-faint">
              <span className="hidden items-center gap-1 sm:flex">
                <kbd className="rounded border border-line-strong bg-white/[0.04] px-1 py-0.5 font-sans">
                  ⌘
                </kbd>
                <kbd className="rounded border border-line-strong bg-white/[0.04] px-1 py-0.5 font-sans">
                  ↵
                </kbd>
                to send
              </span>
              {words > 25 && <span className="nums">{words} words</span>}
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={onSubmit}
              disabled={!canSubmit}
              loading={pending}
            >
              {pending ? 'Sending' : 'Send answer'}
              {!pending && <Send className="size-3.5" />}
            </Button>
          </div>
        </div>

        {/* Two versions of the same reassurance. The long one is the message
            we actually want to send; the short one is what survives 390px
            without wrapping to three lines and pushing the composer up. */}
        <p className="mt-2.5 hidden text-center text-[0.6875rem] text-ink-faint sm:block">
          Question {Math.min(turn, plannedTurns)} of about {plannedTurns} · There's no time
          limit, and "I don't know, but here's how I'd find out" is a good answer
        </p>
        <p className="mt-2 text-center text-[0.6875rem] text-ink-faint sm:hidden">
          Q{Math.min(turn, plannedTurns)} of ~{plannedTurns} · No time limit ·
          "I don't know" is a fine answer
        </p>
      </div>
    </div>
  )
}
