import { motion } from 'framer-motion'
import { AlertCircle, Mic, Send, Square } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/primitives'
import { useSpeechRecognition } from '@/hooks/useSpeech'
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
 *   mid-thought constantly.
 *
 * - **Voice answers are review-then-send, never auto-send.** Speech recognition
 *   is imperfect; dictated text lands in the editor where the candidate can
 *   read it, fix a misheard word, and only then submit. Auto-submitting a
 *   misrecognition would be exactly the kind of small betrayal that erodes
 *   trust in a high-stakes moment.
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
  voiceMode = false,
  onMicActivity,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
  pending: boolean
  error: string | null
  turn: number
  plannedTurns: number
  voiceMode?: boolean
  onMicActivity?: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const rec = useSpeechRecognition()
  // The editor content that existed when dictation began; finalised speech is
  // appended after it, so voice adds to a typed draft rather than replacing it.
  const baseRef = useRef('')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, el.scrollHeight))}px`
  }, [value])

  useEffect(() => {
    if (!pending && !rec.listening) ref.current?.focus()
  }, [pending, rec.listening])

  // Fold finalised speech into the draft as it arrives.
  useEffect(() => {
    if (!rec.transcript) return
    const sep = baseRef.current ? ' ' : ''
    onChange(`${baseRef.current}${sep}${rec.transcript}`)
    // onChange is a stable setState; intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.transcript])

  // Stop the mic the moment an answer is submitted.
  useEffect(() => {
    if (pending && rec.listening) rec.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  const startMic = () => {
    onMicActivity?.() // barge-in: silence the interviewer's voice
    baseRef.current = value ? value.trimEnd() : ''
    rec.reset()
    rec.start()
  }

  const words = value.trim() ? value.trim().split(/\s+/).length : 0
  const canSubmit = value.trim().length > 0 && !disabled

  return (
    // `pb-safe` keeps the send button clear of the iPhone home indicator.
    <div className="shrink-0 border-t border-line bg-base/95 pb-safe backdrop-blur-xl">
      <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-8 sm:py-4">
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.07] px-3 py-2.5">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />
            <p className="text-xs leading-relaxed text-danger">{error}</p>
          </div>
        )}

        {rec.error && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-warn/25 bg-warn/[0.07] px-3 py-2.5">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-warn" />
            <p className="text-xs leading-relaxed text-warn">{rec.error}</p>
          </div>
        )}

        {/* Live listening banner — shows the in-progress phrase so the candidate
            sees the mic is hearing them before the words settle into the draft. */}
        {rec.listening && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/[0.06] px-3.5 py-2.5"
          >
            <span className="relative flex size-2.5 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger/60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-danger" />
            </span>
            <p className="min-w-0 flex-1 truncate text-xs text-ink-muted">
              {rec.interim ? (
                <span className="text-ink">{rec.interim}</span>
              ) : (
                'Listening — speak your answer…'
              )}
            </p>
            <button
              onClick={() => rec.stop()}
              className="shrink-0 rounded-md px-2 py-1 text-[0.6875rem] font-medium text-danger hover:bg-danger/10"
            >
              Stop
            </button>
          </motion.div>
        )}

        <div
          className={cn(
            'relative rounded-2xl border bg-surface transition-colors duration-200',
            'focus-within:border-brand-500/50 focus-within:ring-2 focus-within:ring-brand-500/20',
            rec.listening
              ? 'border-danger/40'
              : disabled
                ? 'border-line opacity-60'
                : 'border-line-strong',
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
            placeholder={
              voiceMode
                ? 'Tap the mic and speak — or type. You can edit either way before sending.'
                : 'Think out loud. Partial reasoning is worth more than a polished guess…'
            }
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
                <kbd className="rounded border border-line-strong bg-tint/[0.04] px-1 py-0.5 font-sans">
                  ⌘
                </kbd>
                <kbd className="rounded border border-line-strong bg-tint/[0.04] px-1 py-0.5 font-sans">
                  ↵
                </kbd>
                to send
              </span>
              {words > 25 && <span className="nums">{words} words</span>}
            </div>

            <div className="flex items-center gap-2">
              {/* Mic. Hidden where speech recognition is unavailable so the
                  affordance never lies about a capability the browser lacks. */}
              {rec.supported && (
                <button
                  onClick={rec.listening ? () => rec.stop() : startMic}
                  disabled={disabled}
                  aria-label={rec.listening ? 'Stop recording' : 'Answer by voice'}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-xl border transition-all duration-200',
                    'disabled:pointer-events-none disabled:opacity-40',
                    rec.listening
                      ? 'border-danger/40 bg-danger/15 text-danger'
                      : voiceMode
                        ? 'border-brand-500/40 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20'
                        : 'border-line-strong text-ink-muted hover:border-brand-500/40 hover:text-brand-400',
                  )}
                >
                  {rec.listening ? (
                    <Square className="size-3.5 fill-current" />
                  ) : (
                    <Mic className="size-4" />
                  )}
                </button>
              )}

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
        </div>

        <p className="mt-2.5 hidden text-center text-[0.6875rem] text-ink-faint sm:block">
          Question {Math.min(turn, plannedTurns)} of about {plannedTurns} · There's no time
          limit, and "I don't know, but here's how I'd find out" is a good answer
        </p>
        <p className="mt-2 text-center text-[0.6875rem] text-ink-faint sm:hidden">
          Q{Math.min(turn, plannedTurns)} of ~{plannedTurns} · No time limit ·
          "I don't know" is fine
        </p>
      </div>
    </div>
  )
}
