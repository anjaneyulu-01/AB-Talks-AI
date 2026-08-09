import { motion } from 'framer-motion'
import {
  ArrowRight,
  Gauge,
  Layers,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { GradientTile } from '@/components/ui/GradientTile'
import { Spotlight } from '@/components/ui/effects'
import { EASE_OUT, staggerDelay } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Bento grid.
 *
 * Three equal cards give every idea equal weight, which is a claim that is
 * almost never true. A bento lets the layout carry the hierarchy: the two
 * ideas that actually sell this product get double-width cells and room for a
 * live visual, the supporting ones get compact cells.
 *
 * Every cell carries a real artefact — an evidence row, a difficulty ladder, a
 * provider chain — rather than an icon and a paragraph. Showing the thing beats
 * describing it, and it is the difference between a feature grid that informs
 * and one that people scroll past.
 */

function Cell({
  children,
  className,
  index = 0,
  spotlight = true,
}: {
  children: React.ReactNode
  className?: string
  index?: number
  spotlight?: boolean
}) {
  const inner = (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-soft transition-colors duration-400 hover:border-line-strong">
      {children}
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: staggerDelay(index, 0.07), ease: EASE_OUT }}
      className={cn('min-w-0', className)}
    >
      {spotlight ? (
        <Spotlight className="h-full rounded-2xl" size={300}>
          {inner}
        </Spotlight>
      ) : (
        inner
      )}
    </motion.div>
  )
}

function CellTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-h3 text-ink">{children}</h3>
}

function CellBody({ children }: { children: React.ReactNode }) {
  return <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{children}</p>
}

export function Bento() {
  return (
    <div className="grid gap-3 sm:gap-4 lg:grid-cols-6">
      {/* ---------------------------------------------- Evidence (wide, hero) */}
      <Cell className="lg:col-span-4" index={0}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <GradientTile icon={Layers} gradient="from-brand-500 to-accent-violet" size="md" className="mb-4" />
            <CellTitle>Attempt count is the signal</CellTitle>
            <CellBody>
              A mission cleared on the fifth try is the highest-value question in your
              interview — the one place nobody knows whether the understanding landed or
              the procedure was memorised.
            </CellBody>
          </div>
        </div>

        {/* The evidence ladder, as a real artefact rather than a description. */}
        <div className="mt-6 space-y-1.5">
          {[
            { label: '1 attempt', read: 'Probe deep — skip definitions', w: '100%', tone: 'bg-band-exceptional', text: 'text-band-exceptional' },
            { label: '2–3', read: 'Solid ground — compare options', w: '72%', tone: 'bg-band-strong', text: 'text-band-strong' },
            { label: '4–5', read: 'Verify the model actually landed', w: '48%', tone: 'bg-band-developing', text: 'text-band-developing' },
            { label: 'skipped', read: 'Never asked. Roadmap only.', w: '0%', tone: 'bg-ink-faint', text: 'text-ink-subtle' },
          ].map((row, i) => (
            <motion.div
              key={row.label}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.08, ease: EASE_OUT }}
              className="flex items-center gap-3 rounded-lg border border-line bg-tint/[0.02] px-3 py-2"
            >
              <span className={cn('w-16 shrink-0 text-[0.6875rem] font-medium', row.text)}>
                {row.label}
              </span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-tint/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: row.w }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.3 + i * 0.08, ease: EASE_OUT }}
                  className={cn('h-full rounded-full', row.tone)}
                />
              </div>
              <span className="hidden shrink-0 text-[0.6875rem] text-ink-faint sm:block">
                {row.read}
              </span>
            </motion.div>
          ))}
        </div>
      </Cell>

      {/* -------------------------------------------------- Adaptation (wide) */}
      <Cell className="lg:col-span-2" index={1}>
        <GradientTile icon={Gauge} gradient="from-accent-cyan to-accent-sky" size="md" className="mb-4" />
        <CellTitle>Difficulty that moves</CellTitle>
        <CellBody>
          Strong answer, harder question. Incomplete one, a targeted follow-up.
        </CellBody>

        <div className="mt-5 flex items-end gap-1.5">
          {[2, 3, 4, 3, 4, 5].map((level, i) => (
            <motion.div
              key={i}
              initial={{ height: 6 }}
              whileInView={{ height: level * 11 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.07, ease: EASE_OUT }}
              className={cn(
                'flex-1 rounded-t-md',
                i === 5
                  ? 'bg-gradient-to-t from-brand-500 to-accent-lime'
                  : 'bg-brand-500/30',
              )}
            />
          ))}
        </div>
        <p className="mt-2 text-[0.625rem] text-ink-faint">Turn 1 → 6 · adapts live</p>
      </Cell>

      {/* ---------------------------------------------------- Reliability */}
      <Cell className="lg:col-span-2" index={2}>
        <GradientTile icon={ShieldCheck} gradient="from-band-exceptional to-accent-teal" size="md" className="mb-4" />
        <CellTitle>It cannot break</CellTitle>
        <CellBody>
          Groq fails over to Gemini mid-sentence. If both are down, a deterministic
          strategist keeps your session alive.
        </CellBody>

        <div className="mt-5 flex items-center gap-2">
          {['Groq', 'Gemini', 'Local'].map((name, i) => (
            <div key={name} className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-[0.6875rem] font-medium',
                  i === 0
                    ? 'border-band-exceptional/30 bg-band-exceptional/10 text-band-exceptional'
                    : 'border-line bg-tint/[0.03] text-ink-subtle',
                )}
              >
                {name}
              </span>
              {i < 2 && <ArrowRight className="size-3 text-ink-faint" />}
            </div>
          ))}
        </div>
      </Cell>

      {/* ------------------------------------------------------ Auditability */}
      <Cell className="lg:col-span-4" index={3}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <GradientTile icon={Sparkles} gradient="from-accent-amber to-warn" size="md" className="mb-4" />
            <CellTitle>Every score shows its working</CellTitle>
            <CellBody>
              Scores are a weighted average over the turns that actually measured each
              competency — computed in code, not guessed by a model at the end. The report
              links every number back to the answer behind it.
            </CellBody>
          </div>

          <div className="w-full shrink-0 space-y-2 sm:w-52">
            {([
              ['Technical', 84],
              ['Reasoning', 71],
              ['Architecture', 66],
            ] as [string, number][]).map(([label, value], i) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-[0.6875rem]">
                  <span className="text-ink-subtle">{label}</span>
                  <span className="nums text-ink-muted">{value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-tint/[0.06]">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${value}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.25 + i * 0.1, ease: EASE_OUT }}
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 via-accent-lime to-accent-cyan"
                  />
                </div>
              </div>
            ))}
            <p className="pt-1 text-[0.625rem] text-ink-faint">
              from turns 2, 5, 7 · auditable
            </p>
          </div>
        </div>
      </Cell>
    </div>
  )
}
