import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'

import type { ScoreBreakdown } from '@/lib/types'
import { COMPETENCY_SHORT } from '@/lib/utils'

/**
 * Competency radar.
 *
 * A radar is genuinely hard to read exact values from — which is why the
 * report also carries a bar breakdown right beside it. The radar's job here is
 * different and narrower: it shows the *shape* of a candidate at a glance.
 * Balanced, spiky, or lopsided reads instantly, and that shape is the thing a
 * hiring conversation actually turns on.
 *
 * Axis starts at 0 and is fixed to 0–100. A radar with an auto-scaled or
 * truncated axis exaggerates small differences into dramatic spikes, which
 * would misrepresent someone's results — the one thing this report must not do.
 */
export function CompetencyRadar({ breakdown }: { breakdown: ScoreBreakdown[] }) {
  if (breakdown.length < 3) {
    return (
      <p className="py-8 text-center text-sm text-ink-subtle">
        Not enough competencies were measured to plot a shape.
      </p>
    )
  }

  const data = breakdown.map((item) => ({
    axis: COMPETENCY_SHORT[item.competency] ?? item.competency,
    score: item.score,
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          {/* Theme tokens, not literals. `rgba(255,255,255,0.08)` was a white
              grid that vanished on a white background in light mode. */}
          <PolarGrid stroke="hsl(var(--line-strong))" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: 'hsl(var(--ink-subtle))', fontSize: 10 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tickCount={5}
            tick={false}
            axisLine={false}
          />
          <Radar
            dataKey="score"
            stroke="hsl(var(--brand-500))"
            strokeWidth={2}
            fill="hsl(var(--brand-500))"
            fillOpacity={0.18}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
