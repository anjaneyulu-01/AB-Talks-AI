import { motion } from 'framer-motion'
import { Info, ShieldAlert } from 'lucide-react'
import { useState } from 'react'

import { Markdown } from '@/components/ui/Markdown'
import { Logo } from '@/components/ui/Logo'
import { Badge } from '@/components/ui/primitives'
import type { TranscriptMessage } from '@/lib/types'
import { ACTION_META, cn } from '@/lib/utils'

/**
 * One turn in the conversation.
 *
 * Asymmetric on purpose. The interviewer's turn is the wide, full-attention
 * element with the mark beside it; the candidate's is a quieter right-aligned
 * bubble. This is a room where one party is asking and the other is thinking,
 * and the layout should say that before anyone reads a word.
 */
export function TranscriptTurn({
  message,
  isLatest,
}: {
  message: TranscriptMessage
  isLatest: boolean
}) {
  if (message.role === 'interviewer') {
    return <InterviewerTurn message={message} isLatest={isLatest} />
  }
  return <CandidateTurn message={message} />
}

function InterviewerTurn({
  message,
  isLatest,
}: {
  message: Extract<TranscriptMessage, { role: 'interviewer' }>
  isLatest: boolean
}) {
  const [showReason, setShowReason] = useState(false)
  const action = message.action ? ACTION_META[message.action] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8"
    >
      <div className="flex items-start gap-3">
        <Logo className="mt-0.5 size-7 shrink-0" />

        <div className="min-w-0 flex-1">
          {/* Turn metadata: what this question is, and why it exists. */}
          {(message.day || action) && (
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              {action && (
                <span className={cn('text-xs font-medium', action.tone)}>{action.label}</span>
              )}
              {message.day && (
                <span className="text-xs text-ink-faint">
                  Day {message.day} · {message.day_title}
                </span>
              )}
              {message.difficulty_label && (
                <Badge tone="outline" className="ml-auto">
                  {message.difficulty_label}
                </Badge>
              )}
            </div>
          )}

          <Markdown content={message.content} />

          {/* The reasoning disclosure.
              Collapsed by default so it never competes with the question
              itself, but always one click away. Making the adaptation
              inspectable is what turns "the AI adapted" into something the
              candidate can verify rather than take on faith. */}
          {message.reason && (
            <div className="mt-3">
              <button
                onClick={() => setShowReason((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2',
                  'text-xs font-medium text-ink-faint transition-colors',
                  'hover:bg-tint/[0.04] hover:text-ink-subtle',
                )}
                aria-expanded={showReason}
              >
                <Info className="size-3" />
                {showReason ? 'Hide reasoning' : 'Why this question?'}
              </button>

              {showReason && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    'mt-2 overflow-hidden rounded-xl border border-brand-500/20',
                    'bg-brand-500/[0.05] p-3 text-xs leading-relaxed text-brand-300',
                  )}
                >
                  {message.reason}
                </motion.p>
              )}
            </div>
          )}

          {isLatest && message.provider && (
            <p className="mt-2 text-[0.625rem] text-ink-faint/60">
              {message.provider}
              {message.latency_ms ? ` · ${message.latency_ms}ms` : ''}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function CandidateTurn({
  message,
}: {
  message: Extract<TranscriptMessage, { role: 'candidate' }>
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8 flex justify-end"
    >
      <div className="max-w-[85%] min-w-0">
        <div
          className={cn(
            'rounded-2xl rounded-tr-md border border-line-strong bg-surface-raised',
            'px-4 py-3 shadow-soft',
          )}
        >
          <Markdown content={message.content} className="text-ink/90" />
        </div>

        {message.flagged && (
          <p className="mt-1.5 flex items-center justify-end gap-1.5 text-[0.6875rem] text-warn/80">
            <ShieldAlert className="size-3" />
            Some text was filtered — your technical content was assessed normally
          </p>
        )}
      </div>
    </motion.div>
  )
}
