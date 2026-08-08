import { useQuery } from '@tanstack/react-query'
import { Activity, LayoutDashboard, Sparkles } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { Logo } from '@/components/ui/Logo'
import { Container, Tooltip } from '@/components/ui/primitives'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/', label: 'Overview', icon: Sparkles },
]

export function AppShell() {
  const location = useLocation()

  return (
    <div className="relative min-h-dvh bg-base">
      {/* Ambient background. Fixed and masked so it never scrolls into a hard
          edge or competes with content for attention. */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="mask-fade-b absolute inset-0 bg-grid-fade bg-grid opacity-40" />
        <div className="absolute -top-40 left-1/2 h-[32rem] w-[52rem] -translate-x-1/2 rounded-full bg-brand-600/[0.07] blur-[120px]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-line bg-base/80 backdrop-blur-xl">
        <Container className="flex h-16 items-center justify-between gap-3">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-lg">
            <Logo className="size-7 shrink-0" />
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="text-[0.9375rem] font-semibold tracking-tight text-ink">
                ABTalks
              </span>
              {/* Dropped below `sm` so the nav and status pill always fit. */}
              <span className="hidden text-[0.9375rem] font-normal tracking-tight text-ink-subtle sm:inline">
                Interview
              </span>
            </div>
          </Link>

          <nav className="flex shrink-0 items-center gap-1">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active =
                to === '/dashboard'
                  ? location.pathname.startsWith('/dashboard') ||
                    location.pathname.startsWith('/candidates')
                  : location.pathname === to
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium',
                    'transition-colors duration-200',
                    active
                      ? 'bg-white/[0.06] text-ink'
                      : 'text-ink-subtle hover:bg-white/[0.04] hover:text-ink-muted',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              )
            })}
            <ServiceStatus />
          </nav>
        </Container>
      </header>

      <main className="relative">
        <Outlet />
      </main>

      <footer className="relative mt-24 border-t border-line py-8">
        <Container className="flex flex-col items-center justify-between gap-3 text-xs text-ink-faint sm:flex-row">
          <p>ABTalks Interview Intelligence · Built for the ABTalks AI Hackathon</p>
          <p>Evidence-grounded adaptive interviewing</p>
        </Container>
      </footer>
    </div>
  )
}

/**
 * Live service indicator.
 *
 * Shows which model is actually serving and whether a circuit breaker has
 * tripped. Most products hide this; surfacing it is a trust signal — it says
 * the failover is real infrastructure, not a claim in a README.
 */
function ServiceStatus() {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 30_000,
    retry: false,
  })

  const providers = data?.providers ?? []
  const primary = providers[0] ?? 'offline'
  const degraded = Object.values(data?.breakers ?? {}).some((s) => s === 'open')
  const online = Boolean(data)

  const tone = !online
    ? 'bg-ink-faint'
    : degraded
      ? 'bg-warn'
      : 'bg-success'

  const label = !online
    ? 'Interview service unreachable'
    : degraded
      ? `Primary provider degraded — running on fallback (${providers.join(' → ')})`
      : `${primary} primary · fallback chain: ${providers.join(' → ')}`

  return (
    <Tooltip label={label} side="bottom" className="ml-2">
      <span className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
        <span className="relative flex size-1.5">
          <span className={cn('absolute inline-flex size-full rounded-full opacity-60', tone, online && !degraded && 'animate-ping')} />
          <span className={cn('relative inline-flex size-1.5 rounded-full', tone)} />
        </span>
        <Activity className="size-3.5 text-ink-faint" />
        <span className="hidden text-xs font-medium capitalize text-ink-subtle sm:inline">
          {online ? primary : 'offline'}
        </span>
      </span>
    </Tooltip>
  )
}
