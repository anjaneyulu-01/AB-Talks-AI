import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { CountUp } from '@/components/ui/ScoreRing'
import { Aurora, GradientBorder, TiltCard } from '@/components/ui/effects'
import { Badge, Button, Container } from '@/components/ui/primitives'
import { FloatingEvidence, Underline } from '@/features/landing/HeroAccents'
import { LiveDemo } from '@/features/landing/LiveDemo'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Hero — split layout.
 *
 * Previously centred, with the demo stacked underneath and therefore below the
 * fold on most laptops. Splitting it puts the argument and the proof of the
 * argument on screen together, which is the whole point of having a live demo.
 *
 * Copy sits left and reads left-aligned, not centred: centred body text is
 * harder to scan because every line starts in a different place, and this
 * paragraph is doing real explanatory work.
 *
 * Note on the headline: per-word animation and gradient text cannot be
 * combined. `text-gradient` sets `bg-clip-text` + `text-transparent`, and an
 * `inline-block` child establishes its own box that the parent's clipped
 * background never paints through — the word inherits transparent colour with
 * no background and renders as nothing. That shipped once and cost the page
 * its entire headline. Line one animates per word in a solid colour; the
 * accent phrase gets a drawn underline instead of a gradient fill.
 */

const HEADLINE = ['Find', 'out', 'if', "you're"]

export function Hero() {
  const reduceMotion = useReducedMotion()

  const word = (delay: number) => ({
    initial: reduceMotion ? { opacity: 1 } : { opacity: 0, y: '0.4em' },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: EASE_OUT },
  })

  return (
    <section className="relative overflow-hidden pt-24 sm:pt-28">
      {/* Drifting aurora underneath, masked grid on top. The grid gives the
          soft colour something to register against — without it the gradient
          reads as a smudge rather than as depth. */}
      <Aurora />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="mask-fade-radial absolute inset-0 bg-grid-fade bg-grid opacity-70" />
      </div>

      <Container className="relative pb-16 pt-6 sm:pb-24 sm:pt-10">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.08fr] lg:gap-10 xl:gap-16">
          {/* --------------------------------------------------------- Copy */}
          <div className="text-center lg:text-left">
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

            <h1 className="text-display text-ink">
              {HEADLINE.map((w, i) => (
                <motion.span
                  key={w}
                  {...word(0.1 + i * 0.06)}
                  className="inline-block [will-change:transform,opacity]"
                >
                  {w}
                  {' '}
                </motion.span>
              ))}
              <motion.span
                {...word(0.34)}
                className="inline-block [will-change:transform,opacity]"
              >
                <Underline delay={0.85}>ready</Underline>
              </motion.span>
              <br />
              {/* The punchline carries the living green gradient rather than a
                  muted grey — it is the emphasis of the whole headline, so it
                  should hold the colour. */}
              <motion.span
                {...word(0.46)}
                className="inline-block text-gradient-brand [will-change:transform,opacity]"
              >
                before it counts.
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55, ease: EASE_OUT }}
              className="mx-auto mt-7 max-w-xl text-lead text-ink-muted lg:mx-0"
            >
              Practice real technical interviews with an AI that has actually read your
              ABTalks cohort record — it knows what you built, where you struggled, and what
              you skipped, and it questions you exactly there. Twenty focused minutes, and
              you'll know precisely where you stand and what to fix.{' '}
              <span className="font-semibold text-ink">Walk in ready. Land the offer.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.65, ease: EASE_OUT }}
              className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start"
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

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start"
            >
              {['No setup', 'Adapts in real time', 'Report in 20 minutes'].map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-1.5 text-xs text-ink-faint"
                >
                  <span className="size-1 rounded-full bg-band-exceptional" />
                  {item}
                </span>
              ))}
            </motion.div>
          </div>

          {/* --------------------------------------------------------- Demo */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: EASE_OUT }}
            className="relative"
          >
            {/* Real cohort rows orbiting the demo — the decoration is also the
                argument, since this is the data the demo derives from. */}
            <FloatingEvidence />

            <TiltCard max={3}>
              <GradientBorder glow>
                <LiveDemo />
              </GradientBorder>
            </TiltCard>
          </motion.div>
        </div>
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
