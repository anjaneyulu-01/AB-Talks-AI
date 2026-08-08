import { Clock, Headphones, Layers, Volume2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import { Logo } from '@/components/ui/Logo'
import { ThemeToggleCompact } from '@/components/ui/ThemeToggle'
import { Badge, Tooltip } from '@/components/ui/primitives'
import type { InterviewState } from '@/lib/types'
import { cn, formatClock } from '@/lib/utils'

/**
 * The interview's only chrome.
 *
 * Everything here answers a question the candidate would otherwise be
 * distracted by: how far through am I, what are we on, how long have I been
 * going. The timer counts *up*, never down — a countdown manufactures pressure,
 * and this screen is trying to remove it.
 */
export function InterviewTopBar({
  state,
  elapsed,
  voiceMode,
  voiceSupported,
  speaking,
  onToggleVoice,
  onStopSpeaking,
}: {
  state: InterviewState
  elapsed: number
  voiceMode: boolean
  voiceSupported: boolean
  speaking: boolean
  onToggleVoice: () => void
  onStopSpeaking: () => void
}) {
  const { live, profile } = state
  const progress = Math.round(live.progress * 100)

  return (
    <header className="relative z-20 shrink-0 border-b border-line bg-base/90 backdrop-blur-xl">
      {/* Progress lives on the very top edge — ambient, always visible, never
          competing with content for space. */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-tint/[0.05]">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-accent-cyan transition-all duration-700 ease-premium"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex h-14 items-center gap-4 px-5 sm:px-6">
        <Logo className="size-7 shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">
              {live.current_topic ?? 'Interview'}
            </span>
            {live.current_day && (
              <span className="nums hidden shrink-0 text-xs text-ink-faint sm:inline">
                Day {live.current_day}
              </span>
            )}
          </div>
          <p className="truncate text-[0.6875rem] text-ink-subtle">
            {profile.candidate_name} · {live.current_module ?? profile.job_role}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Tooltip
            label={`Difficulty adapts to your answers. Currently ${live.difficulty_label.toLowerCase()} (${live.difficulty} of 5).`}
            side="bottom"
          >
            <Badge tone="cyan" className="hidden sm:inline-flex">
              <Layers className="size-3" />
              {live.difficulty_label}
            </Badge>
          </Tooltip>

          <Tooltip label="Time elapsed. There is no time limit." side="bottom">
            <span className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-muted">
              <Clock className="size-3.5 text-ink-faint" />
              <span className="nums">{formatClock(elapsed)}</span>
            </span>
          </Tooltip>

          <span
            className={cn(
              'hidden items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5',
              'text-xs text-ink-muted sm:flex',
            )}
          >
            <span className="nums">
              {Math.min(live.answered + 1, live.planned_turns)} / {live.planned_turns}
            </span>
          </span>

          {/* Voice-mode toggle. When speaking, it pulses and a click stops the
              speech; otherwise it turns voice mode on/off. Hidden entirely on
              browsers without speech synthesis. */}
          {voiceSupported && (
            <Tooltip
              label={
                speaking
                  ? 'Speaking — click to stop'
                  : voiceMode
                    ? 'Voice mode on — questions are read aloud. Click to turn off.'
                    : 'Turn on voice mode — hear questions and answer by speaking'
              }
              side="bottom"
            >
              <button
                onClick={speaking ? onStopSpeaking : onToggleVoice}
                aria-pressed={voiceMode}
                aria-label="Voice mode"
                className={cn(
                  'relative flex size-9 items-center justify-center rounded-lg transition-colors',
                  voiceMode
                    ? 'bg-brand-500/15 text-brand-400'
                    : 'text-ink-faint hover:bg-tint/[0.06] hover:text-ink-muted',
                )}
              >
                {speaking ? (
                  <>
                    <motion.span
                      className="absolute inset-0 rounded-lg bg-brand-500/20"
                      animate={{ opacity: [0.5, 0.15, 0.5] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                    <Volume2 className="relative size-4" />
                  </>
                ) : (
                  <Headphones className="size-4" />
                )}
              </button>
            </Tooltip>
          )}

          <ThemeToggleCompact />

          <Tooltip label="Leave the interview" side="bottom">
            <Link
              to={`/candidates/${profile.candidate_id}`}
              className="flex size-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-tint/[0.06] hover:text-ink-muted"
              aria-label="Leave interview"
            >
              <X className="size-4" />
            </Link>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}
