import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { BrainCircuit, FileCheck2, Layers, Target } from 'lucide-react'
import { useRef } from 'react'

import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * The four-step flow, as a connected vertical sequence.
 *
 * Previously four identical stacked cards — the most inert possible way to
 * present a process. Four cards say "here are four things"; a connected line
 * says "this happens, then this happens", which is the actual claim.
 *
 * The spine fills as you scroll. It is scroll-*linked* rather than triggered:
 * the line tracks scroll position continuously, so the page feels responsive
 * to the reader rather than playing an animation at them. That difference is
 * most of what separates premium motion from decorative motion.
 */

const STEPS = [
  {
    n: '01',
    icon: Layers,
    title: 'It reads your record first',
    body: 'Before a single question, all 31 days of your cohort history become an evidence profile: what you mastered first try, what took five attempts, what you never touched.',
    detail: 'Deterministic — no model involved yet',
  },
  {
    n: '02',
    icon: Target,
    title: 'It plans your interview',
    body: 'Topics are allocated to question slots before you start, each bound to a real curriculum day and objective. That is why it never repeats itself and never drifts off-syllabus.',
    detail: 'Guaranteed coverage across six competencies',
  },
  {
    n: '03',
    icon: BrainCircuit,
    title: 'It adapts as you answer',
    body: 'A strong answer earns a harder question on the same topic. An incomplete one earns a targeted follow-up on exactly what you missed. Two weak turns and it moves on rather than grinding you down.',
    detail: 'And it tells you why, every time',
  },
  {
    n: '04',
    icon: FileCheck2,
    title: 'You get evidence, not a vibe',
    body: 'Every score traces back to the turn that produced it. Every gap comes with the curriculum day that closes it. The numbers are computed from your answers, not guessed at the end.',
    detail: 'Auditable, exportable, actionable',
  },
]

export function StepFlow() {
  const containerRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: containerRef,
    // Starts filling when the section reaches the lower third of the viewport
    // and completes as it leaves the upper third — so the line is in motion
    // exactly while the section is being read.
    offset: ['start 0.75', 'end 0.35'],
  })

  // Spring-smoothed so the line glides rather than jittering with the wheel.
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    restDelta: 0.001,
  })
  const scaleY = useTransform(progress, [0, 1], [0, 1])

  return (
    <div ref={containerRef} className="relative mx-auto max-w-3xl">
      {/* The spine. Sits behind the markers, inset to their centre. */}
      <div
        className="absolute bottom-6 left-[1.4375rem] top-6 w-px bg-line sm:left-[1.6875rem]"
        aria-hidden
      >
        <motion.div
          style={{ scaleY: reduceMotion ? 1 : scaleY }}
          className="h-full w-full origin-top bg-gradient-to-b from-brand-500 via-brand-400 to-accent-cyan"
        />
      </div>

      <ol className="relative space-y-2">
        {STEPS.map((step, i) => (
          <motion.li
            key={step.n}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: EASE_OUT }}
            className="group relative flex gap-4 sm:gap-6"
          >
            {/* Marker */}
            <div className="relative z-10 shrink-0 pt-1">
              <div
                className={cn(
                  'flex size-12 items-center justify-center rounded-2xl sm:size-14',
                  'border border-line-strong bg-surface text-brand-400 shadow-soft',
                  'transition-all duration-400 ease-premium',
                  'group-hover:border-brand-500/40 group-hover:text-brand-300',
                  'group-hover:shadow-raised',
                )}
              >
                <step.icon className="size-5" />
              </div>
            </div>

            <div className="min-w-0 flex-1 pb-8 pt-2">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="nums text-xs font-semibold text-ink-faint">{step.n}</span>
                <h3 className="text-h3 text-ink">{step.title}</h3>
              </div>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
                {step.body}
              </p>
              <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-brand-500/20 bg-brand-500/[0.06] px-2.5 py-1 text-[0.6875rem] font-medium text-brand-300">
                {step.detail}
              </p>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}
