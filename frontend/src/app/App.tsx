import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/app/AppShell'
import { RouteFallback } from '@/app/RouteFallback'
import { ThemeProvider } from '@/app/theme'

/**
 * Route-level code splitting.
 *
 * The landing page is eager because it's the first paint and must be instant.
 * Everything else loads on navigation — the report route in particular pulls
 * in Recharts, which has no business being in the bundle someone downloads
 * just to read the marketing page.
 */
const LandingPage = lazy(() =>
  import('@/features/landing/LandingPage').then((m) => ({ default: m.LandingPage })),
)
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const CandidatePage = lazy(() =>
  import('@/features/dashboard/CandidatePage').then((m) => ({ default: m.CandidatePage })),
)
const InterviewPage = lazy(() =>
  import('@/features/interview/InterviewPage').then((m) => ({ default: m.InterviewPage })),
)
const ReportPage = lazy(() =>
  import('@/features/report/ReportPage').then((m) => ({ default: m.ReportPage })),
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Curriculum and candidate profiles are effectively static within a
      // session, so refetching them on every window focus is pure waste.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/candidates/:candidateId" element={<CandidatePage />} />
              <Route path="/report/:sessionId" element={<ReportPage />} />
            </Route>
            {/* The interview runs outside the shell: no nav, no distractions.
                An immersive room, not a page inside an app. */}
            <Route path="/interview/:sessionId" element={<InterviewPage />} />
              <Route path="*" element={<LandingPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
