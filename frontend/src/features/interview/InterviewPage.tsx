import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { BottomSheet } from '@/components/ui/BottomSheet'
import { Logo } from '@/components/ui/Logo'
import { Button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { AnswerComposer } from '@/features/interview/AnswerComposer'
import {
  InterviewRail,
  MobileStatStrip,
  RailContent,
} from '@/features/interview/InterviewRail'
import { InterviewTopBar } from '@/features/interview/InterviewTopBar'
import { ThinkingIndicator } from '@/features/interview/ThinkingIndicator'
import { TranscriptTurn } from '@/features/interview/TranscriptTurn'
import { useSpeechSynthesis } from '@/hooks/useSpeech'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { InterviewerMessage, TranscriptMessage } from '@/lib/types'

const VOICE_PREF_KEY = 'abtalks-voice-mode'

// Skip submits an honest non-answer rather than a fabricated one. The evaluator
// scores it as a weak turn and the controller eases off or pivots — the correct
// response to "I don't know", and far better data than a bluffed guess.
const SKIP_MESSAGE = "I'm not sure about this one — I'd like to skip it and move on."

export function InterviewPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [railOpen, setRailOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Voice mode: the interviewer speaks questions aloud and the candidate can
  // answer by voice. Preference persists so it survives a page refresh
  // mid-interview.
  const tts = useSpeechSynthesis()
  const [voiceMode, setVoiceMode] = useState(() => {
    try {
      return localStorage.getItem(VOICE_PREF_KEY) === 'on'
    } catch {
      return false
    }
  })
  const lastSpokenIdRef = useRef<string | null>(null)

  const { data: state, isLoading, isError, error } = useQuery({
    queryKey: ['interview', sessionId],
    queryFn: () => api.getInterview(sessionId),
    enabled: Boolean(sessionId),
    // The interview only changes when *we* change it. Polling would be pure
    // waste and would fight the optimistic transcript update below.
    refetchOnMount: true,
    staleTime: Infinity,
  })

  const submit = useMutation({
    mutationFn: (message: string) => api.submitTurn(sessionId, message),
    onSuccess: (response) => {
      // Refetch the canonical state rather than reconciling by hand — the
      // server owns turn indices, evaluations and live telemetry, and a
      // hand-merged version would drift.
      queryClient.invalidateQueries({ queryKey: ['interview', sessionId] })
      if (response.done) {
        // Small beat so the closing message lands before the route changes.
        setTimeout(() => navigate(`/report/${sessionId}`), 1600)
      }
    },
  })

  /* Session timer. Counts up rather than down — a countdown manufactures
     time pressure, and this product is explicitly trying to lower anxiety. */
  useEffect(() => {
    if (state?.done) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [state?.done])

  /* Keep the newest turn in view, but only when the user is already near the
     bottom — yanking the viewport while someone re-reads an earlier answer is
     hostile. */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    if (distanceFromBottom < 220 || submit.isPending) scrollToBottom()
  }, [state?.messages.length, submit.isPending, scrollToBottom])

  const handleSubmit = useCallback(() => {
    const trimmed = draft.trim()
    if (!trimmed || submit.isPending || state?.done) return
    submit.mutate(trimmed)
    setDraft('')
  }, [draft, submit, state?.done])

  const handleSkip = useCallback(() => {
    if (submit.isPending || state?.done) return
    tts.cancel() // stop the question being read aloud if voice mode is on
    submit.mutate(SKIP_MESSAGE)
    setDraft('')
  }, [submit, state?.done, tts])

  /* Speak each new interviewer message when voice mode is on. Keyed on message
     id so a re-render never re-speaks the same question, and so a brand-new
     question (new id) is spoken exactly once. */
  const latestInterviewer = state?.messages
    ? ([...state.messages].reverse().find((m) => m.role === 'interviewer') as
        | InterviewerMessage
        | undefined)
    : undefined

  useEffect(() => {
    if (!voiceMode || !tts.supported || !latestInterviewer) return
    if (latestInterviewer.id === lastSpokenIdRef.current) return
    lastSpokenIdRef.current = latestInterviewer.id
    tts.speak(latestInterviewer.content)
  }, [voiceMode, tts, latestInterviewer])

  const toggleVoice = useCallback(() => {
    setVoiceMode((on) => {
      const next = !on
      try {
        localStorage.setItem(VOICE_PREF_KEY, next ? 'on' : 'off')
      } catch {
        /* storage blocked — preference just won't persist */
      }
      if (!next) {
        tts.cancel()
      } else if (latestInterviewer) {
        // Turning it on mid-interview should read the current question, not
        // wait for the next one.
        lastSpokenIdRef.current = latestInterviewer.id
        tts.speak(latestInterviewer.content)
      }
      return next
    })
  }, [tts, latestInterviewer])

  if (isLoading) return <InterviewSkeleton />

  if (isError || !state) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base p-6">
        <EmptyState
          className="max-w-md"
          icon={<X className="size-5" />}
          title="This interview session isn't available"
          description={
            error instanceof ApiError
              ? error.message
              : 'The session may have expired, or the service is unreachable.'
          }
          action={
            <Link to="/dashboard">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="size-3.5" />
                Back to cohort
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  const messages = state.messages as TranscriptMessage[]

  // 0-based index of each interviewer question, aligned to the message list, so
  // every question carries a stable scroll anchor for the review nav.
  let qCounter = -1
  const questionNumbers = messages.map((m) =>
    m.role === 'interviewer' ? ++qCounter : undefined,
  )
  const questionCount = qCounter + 1

  return (
    // `h-dvh` not `h-screen`: on mobile, 100vh excludes browser chrome and the
    // on-screen keyboard, so the composer ends up below the fold exactly when
    // someone is trying to type into it.
    <div className="flex h-dvh flex-col overflow-hidden bg-base">
      <InterviewTopBar
        state={state}
        elapsed={elapsed}
        voiceMode={voiceMode}
        voiceSupported={tts.supported}
        speaking={tts.speaking}
        onToggleVoice={toggleVoice}
        onStopSpeaking={tts.cancel}
      />
      <MobileStatStrip state={state} onOpen={() => setRailOpen(true)} />

      <div className="flex min-h-0 flex-1">
        {/* -------------------------------------------------- Conversation */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
            <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
              <AnimatePresence initial={false}>
                {messages.map((message, i) => (
                  <TranscriptTurn
                    key={message.id}
                    message={message}
                    isLatest={i === messages.length - 1}
                    questionNumber={questionNumbers[i]}
                  />
                ))}
              </AnimatePresence>

              {submit.isPending && <ThinkingIndicator />}

              {state.done && <CompletionCard sessionId={sessionId} />}

              <div ref={bottomRef} className="h-2" />
            </div>
          </div>

          {!state.done && (
            <>
              <QuestionNav
                count={questionCount}
                plannedTurns={state.live.planned_turns}
              />
              <AnswerComposer
                value={draft}
                onChange={setDraft}
                onSubmit={handleSubmit}
                onSkip={handleSkip}
                disabled={submit.isPending}
                pending={submit.isPending}
                error={
                  submit.isError
                    ? submit.error instanceof ApiError
                      ? submit.error.message
                      : 'That answer could not be submitted. Please try again.'
                    : null
                }
                turn={state.live.turn}
                plannedTurns={state.live.planned_turns}
                voiceMode={voiceMode}
                onMicActivity={tts.cancel}
              />
            </>
          )}
        </div>

        {/* ---------------------------------------------------------- Rail */}
        <InterviewRail state={state} />
      </div>

      {/* Same content as the desktop rail, relocated rather than deleted. */}
      <BottomSheet
        open={railOpen}
        onClose={() => setRailOpen(false)}
        title="Your progress"
      >
        <RailContent state={state} />
      </BottomSheet>
    </div>
  )
}

/* ----------------------------------------------------------- Question nav */

/**
 * The question navigator — a slim strip above the composer.
 *
 * It does two jobs the conversational model otherwise leaves implicit:
 *
 * 1. **Progress made legible.** "Question 3 of 8" answers "how far in am I?"
 *    without a countdown — the number simply climbs each time you answer, which
 *    is what advances the interview (there is no separate "next" button because
 *    answering *is* next).
 *
 * 2. **Review without rewind.** The chevrons scroll back and forth through the
 *    questions already asked so you can re-read an earlier one. They never let
 *    you re-answer — the plan has already adapted to what you said — so this is
 *    read-only navigation, not quiz paging.
 *
 * `reviewIndex` snaps back to the latest question whenever a new one arrives, so
 * the strip always returns to "you are here" the moment the interview moves on.
 */
function QuestionNav({ count, plannedTurns }: { count: number; plannedTurns: number }) {
  const [reviewIndex, setReviewIndex] = useState(Math.max(0, count - 1))

  useEffect(() => {
    setReviewIndex(Math.max(0, count - 1))
  }, [count])

  if (count < 1) return null

  const total = Math.max(plannedTurns, count)
  const latest = count - 1
  const atLatest = reviewIndex >= latest

  const jumpTo = (next: number) => {
    const clamped = Math.max(0, Math.min(latest, next))
    setReviewIndex(clamped)
    document
      .getElementById(`interview-q-${clamped}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="shrink-0 border-t border-line bg-base/95 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-2 sm:px-8">
        <button
          type="button"
          onClick={() => jumpTo(reviewIndex - 1)}
          disabled={reviewIndex <= 0}
          aria-label="Review previous question"
          className={cn(
            'flex items-center gap-1 rounded-lg py-1.5 pl-1.5 pr-2.5 text-xs font-medium transition-colors',
            'text-ink-subtle hover:bg-tint/[0.06] hover:text-ink',
            'disabled:pointer-events-none disabled:opacity-30',
          )}
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink">
            {atLatest ? 'Question' : 'Reviewing Q'}{' '}
            <span className="nums">{reviewIndex + 1}</span>
            <span className="text-ink-faint"> of {total}</span>
          </span>
          {/* A row of ticks — filled up to the current question — so progress
              reads at a glance even before the words are parsed. */}
          <div className="hidden items-center gap-1 sm:flex" aria-hidden>
            {Array.from({ length: Math.min(total, 12) }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1 w-1.5 rounded-full transition-colors',
                  i <= reviewIndex ? 'bg-brand-400' : 'bg-tint/[0.12]',
                )}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => jumpTo(reviewIndex + 1)}
          disabled={atLatest}
          aria-label="Back to current question"
          className={cn(
            'flex items-center gap-1 rounded-lg py-1.5 pl-2.5 pr-1.5 text-xs font-medium transition-colors',
            'text-ink-subtle hover:bg-tint/[0.06] hover:text-ink',
            'disabled:pointer-events-none disabled:opacity-30',
          )}
        >
          <span className="hidden sm:inline">{reviewIndex === latest - 1 ? 'Current' : 'Next'}</span>
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- Completion */

function CompletionCard({ sessionId }: { sessionId: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="my-8 rounded-2xl border border-brand-500/25 bg-brand-sheen p-8 text-center"
    >
      <Logo className="mx-auto size-10" />
      <h2 className="mt-4 text-h3 text-ink">Interview complete</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        Every score in your report traces back to a specific answer you gave. Taking you
        there now.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <Loader2 className="size-3.5 animate-spin text-brand-400" />
        <Link to={`/report/${sessionId}`}>
          <Button variant="primary" size="sm">
            <FileText className="size-3.5" />
            View your report
          </Button>
        </Link>
      </div>
    </motion.div>
  )
}

/* --------------------------------------------------------------- Skeleton */

function InterviewSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-base">
      <div className="flex h-14 items-center gap-4 border-b border-line px-6">
        <Skeleton className="size-7 rounded-lg" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="ml-auto h-3 w-24" />
      </div>
      <div className="flex flex-1">
        <div className="flex-1 space-y-6 p-8">
          <div className="mx-auto max-w-3xl space-y-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-16 w-2/3 rounded-2xl" />
          </div>
        </div>
        <div className="hidden w-72 space-y-4 border-l border-line p-5 lg:block">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
