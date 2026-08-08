import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { CountUp } from '@/components/ui/ScoreRing'
import { Badge, Button, Container } from '@/components/ui/primitives'
import { LiveDemo } from '@/features/landing/LiveDemo'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Hero.
 *
 * The headline animates in word by word rather than as a block. It costs
 * nothing and buys a beat of attention on the one sentence that has to land —
 * but the words are laid out in normal flow with `inline-block` wrappers, so
 * they wrap naturally at 390px and the sentence is still selectable text
 * rather than a pile of positioned spans.
 */

const HEADLINE_A = ['Find', 'out', 'if', "you're", 'ready']
const HEADLINE_B = ['before', 'it', 'counts.']

export function Hero() {
  const reduceMotion = useReducedMotion()

  const word = (delay: number) => ({
    initial: reduceMotion ? { opacity: 1 } : { opacity: 0, y: '0.4em' },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: EASE_OUT },
  })

  return (
    <section className="relative overflow-hidden pt-16">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="mask-fade-radial absolute inset-0 bg-grid-fade bg-grid opacity-60" />
        <div className="absolute -top-32 left-1/2 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-brand-600/[var(--glow-alpha)] blur-[130px]" />
        <div className="absolute right-[8%] top-40 size-72 rounded-full bg-accent-cyan/[0.06] blur-[100px]" />
      </div>

      <Container className="relative py-14 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          >
            <Badge tone="brand" size="md" className="mb-6">
              <Sparkles className="size-3" />
              Built for the ABTalks AI Cohort
            </Badge>
          </motion.div>

          <h1 className="text-display text-gradient">
            {HEADLINE_A.map((w, i) => (
              <motion.span
                key={w}
                {...word(0.1 + i * 0.06)}
                className="inline-block [will-change:transform,opacity]"
              >
                {w}
                {i < HEADLINE_A.length - 1 && ' '}
              </motion.span>
            ))}
            <br />
            <span className="text-gradient-brand">
              {HEADLINE_B.map((w, i) => (
                <motion.span
                  key={w}
                  {...word(0.34 + i * 0.06)}
                  className="inline-block [will-change:transform,opacity]"
                >
                  {w}
                  {i < HEADLINE_B.length - 1 && ' '}
                </motion.span>
              ))}
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: EASE_OUT }}
            className="mx-auto mt-6 max-w-2xl text-lead text-ink-muted"
          >
            An AI interviewer that has actually read your cohort record. It knows which
            missions you aced, which took you five attempts, and which you skipped — and
            it builds every question from that.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: EASE_OUT }}
            className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
          >
            <Link to="/dashboard">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Start your interview
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                See how it works
              </Button>
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.75 }}
            className="mt-5 text-xs text-ink-faint"
          >
            No setup · Adapts in real time · Full report in under 20 minutes
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: EASE_OUT }}
          className="mx-auto mt-12 max-w-4xl sm:mt-16"
        >
          <LiveDemo />
        </motion.div>
      </Container>
    </section>
  )
}

/**
 * Proof strip.
 *
 * Four real numbers straight from the dataset, immediately under the demo.
 * Concrete figures do more for credibility in the first ten seconds than any
 * amount of adjective — and every one of these is verifiable in the repo.
 */
const PROOF = [
  { value: 31, suffix: '', label: 'curriculum days', hint: 'every question is bound to one' },
  { value: 8, suffix: '', label: 'cohort modules', hint: 'tooling through capstone' },
  { value: 6, suffix: '', label: 'competencies scored', hint: 'each traced to a turn' },
  { value: 3, suffix: '', label: 'model fallbacks', hint: 'the interview cannot die' },
]

export function ProofStrip() {
  return (
    <section className="relative border-y border-line bg-surface/40">
      <Container>
        <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          {PROOF.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: EASE_OUT }}
              className={cn(
                'px-2 py-6 text-center sm:px-4 sm:py-8',
                // Manual dividers on mobile, where the 2-col grid needs
                // horizontal rules that `divide-x` cannot provide.
                i < 2 && 'border-b border-line sm:border-b-0',
                i % 2 === 1 && 'border-l border-line sm:border-l-0',
              )}
            >
              <dd className="nums text-3xl font-bold tracking-tight text-gradient-brand sm:text-4xl">
                <CountUp value={item.value} />
                {item.suffix}
              </dd>
              <dt className="mt-1.5 text-xs font-medium text-ink">{item.label}</dt>
              <p className="mt-0.5 text-[0.625rem] leading-tight text-ink-faint">
                {item.hint}
              </p>
            </motion.div>
          ))}
        </dl>
      </Container>
    </section>
  )
}
