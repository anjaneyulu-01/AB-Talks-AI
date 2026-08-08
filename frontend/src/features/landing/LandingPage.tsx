import { motion } from 'framer-motion'
import { ArrowRight, Ban, Quote } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Aurora, Grain, Marquee } from '@/components/ui/effects'
import { Badge, Button, Card, Container } from '@/components/ui/primitives'
import { Bento } from '@/features/landing/Bento'
import { Hero, ProofStrip } from '@/features/landing/Hero'
import { DerivationStrip } from '@/features/landing/LiveDemo'
import { StepFlow } from '@/features/landing/StepFlow'
import { EASE_OUT, revealOnScroll, staggerContainer, staggerDelay } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Landing page.
 *
 * Rewritten because the previous version presented every section identically —
 * eight cards across four grids. Uniform presentation reads as a template no
 * matter how good the copy is, and gives the eye no reason to keep scrolling.
 *
 * The rhythm now alternates deliberately, and the ground colour changes with
 * it so scrolling has a pulse:
 *
 *   hero          live demo, aurora mesh, tilt + gradient border
 *   marquee       infinite ticker of the real stack
 *   proof         thin bordered strip, dense real numbers
 *   the gap       purely editorial — no cards at all
 *   capabilities  bento grid; layout carries the hierarchy
 *   how it works  connected vertical flow, scroll-linked spine
 *   fairness      asymmetric split; the one idea that earns a full stop
 *   voices        offset quotes rather than a flat grid
 *   cta           full-bleed close
 *
 * The other change that matters: the page now *shows* the mechanism in the
 * hero instead of describing it. A still screenshot can assert that a mission
 * record produces a question; only an animation can demonstrate it.
 */

export function LandingPage() {
  return (
    <div className="relative min-h-dvh bg-base">
      {/* Film grain over the whole page. Flat digital gradients read as cheap
          because nothing physical is that smooth — a few percent of noise is
          what makes large colour fields feel like a material. */}
      <Grain />
      <Nav />
      <Hero />
      <TechMarquee />
      <ProofStrip />
      <TheGap />
      <Capabilities />
      <HowItWorks />
      <FairnessMoment />
      <Voices />
      <FinalCta />
      <Footer />
    </div>
  )
}

/* --------------------------------------------------------------- Marquee */

/**
 * The stack, as an infinite ticker.
 *
 * Every one of these is genuinely in the build — this is a statement of what
 * runs, not a logo wall of companies we have no relationship with.
 */
const STACK = [
  'Groq', 'Gemini 2.5 Flash', 'FastAPI', 'React 19', 'MongoDB Atlas',
  'Pydantic', 'Breeth MCP', 'TypeScript', 'Tailwind', 'Framer Motion',
]

function TechMarquee() {
  return (
    <section className="relative border-y border-line bg-surface/30 py-5">
      <p className="mb-4 text-center text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-faint">
        Running on
      </p>
      <Marquee speed={38}>
        {STACK.map((name) => (
          <span
            key={name}
            className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-muted"
          >
            <span className="size-1.5 rounded-full bg-brand-400/60" />
            {name}
          </span>
        ))}
      </Marquee>
    </section>
  )
}

/* ----------------------------------------------------------- Capabilities */

/**
 * Bento grid.
 *
 * Replaces the three-equal-cards section. Equal cards give every idea equal
 * weight, which is almost never true — a bento lets layout carry hierarchy,
 * and every cell holds a real artefact rather than an icon and a paragraph.
 */
function Capabilities() {
  return (
    <section className="relative overflow-hidden border-y border-line bg-surface/40 py-20 sm:py-28">
      <Aurora className="opacity-50" />
      <Container className="relative">
        <SectionHead
          eyebrow="What makes it different"
          title="Built on evidence, not vibes"
          lead="Four decisions you can verify in the repository — each one visible in the interview itself."
        />
        <div className="mt-14">
          <Bento />
        </div>
      </Container>
    </section>
  )
}

/* -------------------------------------------------------------------- Nav */

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/60 bg-base/70 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between gap-3">
        <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-lg">
          <Logo className="size-7 shrink-0" />
          <span className="truncate text-[0.9375rem] font-semibold tracking-tight text-ink">
            ABTalks <span className="font-normal text-ink-subtle">Interview</span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Link to="/dashboard">
            <Button variant="primary" size="sm">
              <span className="hidden sm:inline">Start an interview</span>
              <span className="sm:hidden">Start</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </Container>
    </header>
  )
}

/* -------------------------------------------------------------- Section head */

function SectionHead({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string
  title: ReactNode
  lead?: string
}) {
  return (
    <motion.div {...revealOnScroll} className="mx-auto max-w-2xl text-center">
      <p className="eyebrow mb-4">{eyebrow}</p>
      <h2 className="text-h1 text-gradient">{title}</h2>
      {lead && <p className="mt-5 text-lead text-ink-muted">{lead}</p>}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ The gap */

/**
 * Deliberately card-free. A purely editorial moment lets the eye rest between
 * the dense demo above and the flow below, and lets the strongest sentence on
 * the page carry itself without a box drawn around it.
 */
function TheGap() {
  const points: [string, string][] = [
    [
      'Question banks are generic.',
      'The same fifty questions for everyone, regardless of what you actually studied or how it went.',
    ],
    [
      'Mock tools are static.',
      'Difficulty never moves. You either get bored or you drown, and neither tells you where you stand.',
    ],
    [
      'Automated scores are hollow.',
      '"Communication: 7/10." No evidence, no examples, nothing you can act on tomorrow morning.',
    ],
  ]

  return (
    <section className="relative py-20 sm:py-28">
      <Container>
        <motion.div {...revealOnScroll} className="mx-auto max-w-3xl text-center">
          <p className="eyebrow mb-5">The gap</p>
          <h2 className="text-h1 text-gradient">
            You finished the cohort.{' '}
            <span className="text-ink-muted">
              You still don't know if you're ready.
            </span>
          </h2>
        </motion.div>

        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="mx-auto mt-12 max-w-2xl space-y-5"
        >
          {points.map(([title, body], i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: staggerDelay(i, 0.08), ease: EASE_OUT }}
              className="border-l-2 border-line pl-5 sm:pl-6"
            >
              <p className="text-[0.9375rem] font-semibold text-ink">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{body}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          {...revealOnScroll}
          className="mx-auto mt-12 max-w-2xl text-center text-lead text-ink"
        >
          Nothing in between tells you whether you can explain <em>why</em> you chose
          cosine similarity when a senior engineer pushes back.
        </motion.p>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------ How it works */

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative border-y border-line bg-surface/40 py-20 sm:py-28"
    >
      <Container>
        <SectionHead eyebrow="How it works" title="Four steps. No black box." />

        <div className="mt-14">
          <StepFlow />
        </div>

        <motion.div {...revealOnScroll} className="mx-auto mt-12 max-w-3xl">
          <DerivationStrip />
        </motion.div>
      </Container>
    </section>
  )
}

/* -------------------------------------------------------- Fairness moment */

/**
 * The most human idea in the product gets a section to itself, as an
 * asymmetric split rather than one card among three. Giving it equal visual
 * weight to the other differentiators would bury the thing that actually
 * earns trust.
 */
function FairnessMoment() {
  const record = [
    { day: 7, title: 'Embeddings Explained', attempts: 5 },
    { day: 12, title: 'Prompt Engineering', attempts: 4 },
    { day: 22, title: 'Multi-Agent Orchestration', attempts: 5 },
    { day: 27, title: 'Security & Guardrails', attempts: null },
    { day: 28, title: 'Docker & Kubernetes', attempts: null },
  ]

  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-1/2 h-[24rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/[var(--glow-alpha)] blur-[120px]" />
      </div>

      <Container className="relative">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <motion.div {...revealOnScroll} className="text-left">
            <Badge tone="neutral" size="md" className="mb-5">
              <Ban className="size-3" />
              The rule we won't break
            </Badge>
            <h2 className="text-h1 text-gradient">
              It never asks about what you skipped.
            </h2>
            <div className="mt-6 space-y-4 text-[0.9375rem] leading-relaxed text-ink-muted">
              <p>
                Skipped a mission during the cohort? It's excluded from the question pool
                entirely — enforced in code, not requested in a prompt. There's a test that
                sweeps every candidate in the dataset to prove it can't happen.
              </p>
              <p className="text-ink">
                Asking someone about material they never saw isn't rigour. It manufactures
                a failure, and it destroys the trust the whole assessment depends on.
              </p>
              <p>
                It still lands in your learning roadmap afterwards — that's the right place
                for it. Same fact, opposite treatment, because the two contexts have
                opposite ethics.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            <Card className="overflow-hidden">
              <div className="border-b border-line px-5 py-3.5">
                <p className="text-xs font-medium text-ink-subtle">
                  Wendy Foster · Marketing Manager · 12 years
                </p>
              </div>

              <div className="space-y-2 p-5">
                {record.map((row, i) => {
                  const skipped = row.attempts === null
                  return (
                    <motion.div
                      key={row.day}
                      initial={{ opacity: 0, x: 12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.4,
                        delay: 0.15 + i * 0.07,
                        ease: EASE_OUT,
                      }}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                        skipped
                          ? 'border-dashed border-line-strong bg-tint/[0.02]'
                          : 'border-line bg-tint/[0.02]',
                      )}
                    >
                      <span className="nums w-8 shrink-0 text-xs text-ink-faint">
                        D{row.day}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-sm',
                          skipped ? 'text-ink-faint line-through' : 'text-ink',
                        )}
                      >
                        {row.title}
                      </span>
                      {skipped ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-md bg-tint/[0.05] px-2 py-0.5 text-[0.625rem] font-medium text-ink-subtle">
                          <Ban className="size-2.5" />
                          never asked
                        </span>
                      ) : (
                        <span className="nums shrink-0 rounded-md bg-band-developing/10 px-2 py-0.5 text-[0.625rem] font-medium text-band-developing">
                          ×{row.attempts}
                        </span>
                      )}
                    </motion.div>
                  )
                })}
              </div>

              <div className="border-t border-line bg-tint/[0.02] px-5 py-3.5">
                <p className="text-xs leading-relaxed text-ink-muted">
                  Her interview covers the three she attempted — hard. The two she skipped
                  appear only in her roadmap.
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      </Container>
    </section>
  )
}

/* ---------------------------------------------------------------- Voices */

const VOICES = [
  {
    quote:
      "It asked me why I picked 500-token chunks. I'd never actually thought about it — I'd copied it from the notebook. That one question was worth more than a week of revision.",
    name: 'Priyanka Sharma',
    role: 'Software Engineer · 5 years',
    score: 74,
  },
  {
    quote:
      'Twenty-eight years in and I was braced for it to make me feel old. Instead it noticed I was fluent on systems and new to agents, and built the whole interview around that.',
    name: 'Harold Whitfield',
    role: 'Distinguished Engineer · 28 years',
    score: 81,
  },
  {
    quote:
      "I skipped the Kubernetes missions and spent the whole time bracing for a question about them. It never came. It showed up in my roadmap instead. That's exactly right.",
    name: 'Wendy Foster',
    role: 'Marketing Manager · 12 years',
    score: 63,
  },
  {
    quote:
      'Every mission took me four or five tries. I assumed the report would say I was hopeless. It said I had the highest persistence in the cohort and told me exactly what to tighten.',
    name: 'Tyler Brooks',
    role: 'Junior Developer · Bootcamp',
    score: 68,
  },
]

/** Offset columns rather than a flat grid — reads as editorial, not tabular. */
function Voices() {
  return (
    <section className="relative py-20 sm:py-28">
      <Container>
        <SectionHead
          eyebrow="From the cohort"
          title="What it feels like on the other side"
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:gap-5">
          {VOICES.map((v, i) => (
            <motion.figure
              key={v.name}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.55, delay: staggerDelay(i, 0.07), ease: EASE_OUT }}
              className={cn(
                'flex h-full flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-soft',
                'transition-all duration-400 ease-premium hover:-translate-y-0.5 hover:shadow-raised',
                // A half-step offset on the second column breaks the grid's
                // regularity without losing alignment.
                i % 2 === 1 && 'sm:mt-8',
              )}
            >
              <Quote className="size-5 shrink-0 text-brand-500/40" />
              <blockquote className="flex-1 text-[0.9375rem] leading-relaxed text-ink/90">
                {v.quote}
              </blockquote>
              <figcaption className="flex items-center justify-between gap-4 border-t border-line pt-4">
                <div>
                  <p className="text-sm font-medium text-ink">{v.name}</p>
                  <p className="text-xs text-ink-subtle">{v.role}</p>
                </div>
                <div className="text-right">
                  <p className="nums text-lg font-semibold text-band-strong">{v.score}</p>
                  <p className="text-[0.6875rem] text-ink-faint">readiness</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-ink-faint">
          Illustrative scenarios built from the ABTalks cohort dataset.
        </p>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------- Final CTA */

function FinalCta() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <Aurora />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="mask-fade-radial absolute inset-0 bg-grid-fade bg-grid opacity-60" />
      </div>

      <Container className="relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            className="motion-reduce:animate-none"
          >
            <Logo className="mx-auto size-14" />
          </motion.div>

          <h2 className="mt-7 text-h1 text-gradient">
            One interview.{' '}
            <span className="text-gradient-brand">A real answer.</span>
          </h2>
          <p className="mx-auto mt-5 text-lead text-ink-muted">
            Twenty minutes, and you'll know exactly where you stand and exactly what to do
            next. Nothing to install, nothing to configure.
          </p>
          <Link to="/dashboard" className="mt-9 inline-block">
            <Button variant="primary" size="lg">
              Choose your profile
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <p className="mt-4 text-xs text-ink-faint">
            20 cohort profiles · no sign-up · runs without API keys
          </p>
        </motion.div>
      </Container>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line py-10">
      <Container className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <Logo className="size-6" />
          <span className="text-sm text-ink-subtle">ABTalks Interview Intelligence</span>
        </div>
        <p className="text-center text-xs text-ink-faint sm:text-right">
          Built for the ABTalks AI Hackathon · Grounded in the 31-day AI Cohort
        </p>
      </Container>
    </footer>
  )
}
