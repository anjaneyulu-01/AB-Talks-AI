import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, FileText, Loader2, X } from 'lucide-react'
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
import { api, ApiError } from '@/lib/api'
import type { TranscriptMessage } from '@/lib/types'

export function InterviewPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [railOpen, setRailOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

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

  return (
    // `h-dvh` not `h-screen`: on mobile, 100vh excludes browser chrome and the
    // on-screen keyboard, so the composer ends up below the fold exactly when
    // someone is trying to type into it.
    <div className="flex h-dvh flex-col overflow-hidden bg-base">
      <InterviewTopBar state={state} elapsed={elapsed} />
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
                  />
                ))}
              </AnimatePresence>

              {submit.isPending && <ThinkingIndicator />}

              {state.done && <CompletionCard sessionId={sessionId} />}

              <div ref={bottomRef} className="h-2" />
            </div>
          </div>

          {!state.done && (
            <AnswerComposer
              value={draft}
              onChange={setDraft}
              onSubmit={handleSubmit}
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
            />
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
