import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Layers,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  Badge,
  Card,
  Container,
  EmptyState,
  Skeleton,
} from '@/components/ui/primitives'
import { GradientAvatar, GradientTile } from '@/components/ui/GradientTile'
import { api } from '@/lib/api'
import { cardGradient } from '@/lib/categoryColors'
import type { CandidateListItem } from '@/lib/types'
import { cn, pct } from '@/lib/utils'

type SortKey = 'name' | 'coverage' | 'fluency'

export function DashboardPage() {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('name')

  const { data: candidates, isLoading, isError } = useQuery({
    queryKey: ['candidates'],
    queryFn: api.candidates,
  })

  const { data: curriculum } = useQuery({
    queryKey: ['curriculum'],
    queryFn: api.curriculum,
  })

  const filtered = useMemo(() => {
    if (!candidates) return []
    const needle = query.trim().toLowerCase()
    const matches = needle
      ? candidates.filter(
          (c) =>
            c.name.toLowerCase().includes(needle) ||
            c.job_role.toLowerCase().includes(needle) ||
            c.seniority_band.toLowerCase().includes(needle),
        )
      : candidates

    return [...matches].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'coverage') return b.coverage - a.coverage
      return b.fluency - a.fluency
    })
  }, [candidates, query, sort])

  return (
    <Container className="py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Badge tone="brand" size="md" className="mb-4">
          <Sparkles className="size-3" />
          ABTalks AI Cohort · 31 days · 8 modules
        </Badge>
        <h1 className="text-h1 text-ink">
          Choose a profile to <span className="text-gradient-brand">interview</span>
        </h1>
        <p className="mt-3 max-w-2xl text-lead text-ink-muted">
          Every candidate below has a real cohort record. Open one to see the evidence
          profile and the interview strategy the system derived from it — before you start.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <SummaryTile
          icon={Users}
          gradient="from-brand-500 to-accent-violet"
          label="Candidates"
          value={candidates?.length ?? '—'}
          hint="From the cohort dataset"
        />
        <SummaryTile
          icon={BookOpen}
          gradient="from-accent-cyan to-accent-sky"
          label="Curriculum days"
          value={curriculum?.days.length ?? '—'}
          hint={curriculum?.cohort ?? 'Loading cohort'}
        />
        <SummaryTile
          icon={Layers}
          gradient="from-band-exceptional to-accent-teal"
          label="Modules"
          value={curriculum?.modules.length ?? '—'}
          hint="Tooling through capstone"
        />
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or role…"
            aria-label="Search candidates"
            className={cn(
              'h-10 w-full rounded-xl border border-line-strong bg-surface pl-9 pr-3',
              'text-sm text-ink placeholder:text-ink-faint',
              'transition-colors focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
            )}
          />
        </div>

        {/* Full-width segmented control on mobile so each option is a
            comfortable tap target rather than three cramped pills. */}
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
          <SlidersHorizontal className="ml-1.5 size-3.5 shrink-0 text-ink-faint sm:ml-2" />
          {(
            [
              ['name', 'Name'],
              ['coverage', 'Coverage'],
              ['fluency', 'Fluency'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              aria-pressed={sort === key}
              className={cn(
                'flex-1 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors sm:flex-none sm:py-1.5',
                sort === key
                  ? 'bg-tint/[0.08] text-ink'
                  : 'text-ink-subtle hover:text-ink-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="space-y-4 p-5 pt-6">
                <div className="flex items-center gap-3">
                  {/* rounded-xl to match the gradient avatar tiles, not a circle */}
                  <Skeleton className="size-11 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-1.5 w-full" />
                <Skeleton className="h-1.5 w-full" />
              </Card>
            ))}
          </div>
        )}

        {isError && (
          <EmptyState
            icon={<Users className="size-5" />}
            title="Couldn't load the cohort"
            description="The interview service isn't responding. Make sure the backend is running on port 8000, then refresh."
          />
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState
            icon={<Search className="size-5" />}
            title="No candidates match that search"
            description="Try a different name, role, or seniority band."
          />
        )}

        {filtered.length > 0 && (
          <p className="mb-4 text-xs text-ink-subtle">
            Showing{' '}
            <span className="nums font-semibold text-ink">{filtered.length}</span>
            {candidates && filtered.length !== candidates.length && (
              <> of <span className="nums">{candidates.length}</span></>
            )}{' '}
            {filtered.length === 1 ? 'profile' : 'profiles'}
          </p>
        )}

        {filtered.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((candidate, i) => (
              <CandidateCard key={candidate.id} candidate={candidate} index={i} />
            ))}
          </div>
        )}
      </div>
    </Container>
  )
}

function SummaryTile({
  icon,
  gradient,
  label,
  value,
  hint,
}: {
  icon: typeof Users
  gradient: string
  label: string
  value: number | string
  hint: string
}) {
  return (
    <Card hover className="flex items-center gap-4 p-5">
      <GradientTile icon={icon} gradient={gradient} size="md" />
      <div className="min-w-0">
        <p className="nums text-2xl font-bold tracking-tight text-ink">{value}</p>
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p className="truncate text-[0.6875rem] text-ink-faint">{hint}</p>
      </div>
    </Card>
  )
}

function CandidateCard({ candidate, index }: { candidate: CandidateListItem; index: number }) {
  const bandTone =
    candidate.seniority_band === 'principal' || candidate.seniority_band === 'senior'
      ? 'brand'
      : candidate.seniority_band === 'mid'
        ? 'cyan'
        : 'neutral'

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.035, 0.4), ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={`/candidates/${candidate.id}`} className="block h-full rounded-2xl">
        {/* A solid elevated card that lifts on hover, with a category-coloured
            gradient bar across the top — the signature "colourful card" look.
            Each candidate owns one deterministic colour, so the grid reads as a
            vivid spectrum while each card stays coherent. */}
        <div className="glass-card lift-glow group relative flex h-full flex-col p-5 pt-6">
          <div
            className={cn(
              'absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r',
              cardGradient(candidate.id),
            )}
          />
          <div className="flex items-start gap-3">
            <GradientAvatar name={candidate.name} gradient={cardGradient(candidate.id)} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{candidate.name}</p>
              <p className="truncate text-xs text-ink-muted">{candidate.job_role}</p>
              <p className="mt-0.5 text-[0.6875rem] text-ink-faint">
                {candidate.years_experience === 0
                  ? 'New to industry'
                  : `${candidate.years_experience} yrs`}{' '}
                · {candidate.education}
              </p>
            </div>
            <Badge tone={bandTone as 'brand'} className="shrink-0 capitalize">
              {candidate.seniority_band}
            </Badge>
          </div>

          <p className="mt-4 flex-1 text-[0.8125rem] leading-relaxed text-ink-muted">
            {candidate.headline}
          </p>

          <div className="mt-4 space-y-2.5">
            <MiniMetric
              label="Cohort coverage"
              value={candidate.coverage}
              gradient={cardGradient(candidate.id)}
            />
            <MiniMetric
              label="First-try fluency"
              value={candidate.fluency}
              gradient={cardGradient(candidate.id)}
            />
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
            <div className="flex items-center gap-3 text-[0.6875rem] text-ink-faint">
              <span>
                <span className="nums text-ink-muted">{candidate.eligible_topics}</span> topics
                eligible
              </span>
              {candidate.skipped_count > 0 && (
                <span>
                  <span className="nums text-ink-muted">{candidate.skipped_count}</span> excluded
                </span>
              )}
            </div>
            <ArrowRight className="size-3.5 text-ink-faint transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-brand-400" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function MiniMetric({
  label,
  value,
  gradient,
}: {
  label: string
  value: number
  gradient: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[0.6875rem] text-ink-subtle">{label}</span>
        <span className="nums text-[0.6875rem] font-semibold text-ink">{pct(value)}</span>
      </div>
      {/* The bar carries the card's own colour, so each candidate reads as one
          cohesive vivid unit rather than every bar being generic indigo. */}
      <div className="h-1.5 overflow-hidden rounded-full bg-tint/[0.07]">
        <motion.div
          className={cn('h-full rounded-full bg-gradient-to-r', gradient)}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.round(value * 100)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
}
