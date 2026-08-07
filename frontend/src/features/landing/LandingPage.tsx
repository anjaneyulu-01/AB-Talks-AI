import { motion } from 'framer-motion'
import {
  ArrowRight,
  Ban,
  BrainCircuit,
  FileCheck2,
  Gauge,
  GitBranch,
  Layers,
  Quote,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Logo } from '@/components/ui/Logo'
import { Badge, Button, Card, Container } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-base">
      <Nav />
      <Hero />
      <ProblemStatement />
      <HowItWorks />
      <Differentiators />
      <Testimonials />
      <FinalCta />
      <Footer />
    </div>
  )
}

/* -------------------------------------------------------------------- Nav */

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/60 bg-base/70 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 rounded-lg">
          <Logo className="size-7" />
          <span className="text-[0.9375rem] font-semibold tracking-tight text-ink">
            ABTalks <span className="font-normal text-ink-subtle">Interview</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <a href="#how-it-works">
            <Button variant="ghost" size="sm">
              How it works
            </Button>
          </a>
          <Link to="/dashboard">
            <Button variant="primary" size="sm">
              Start an interview
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </Container>
    </header>
  )
}

/* ------------------------------------------------------------------- Hero */

function Hero() {
  return (
    <section className="relative overflow-hidden pt-16">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="mask-fade-radial absolute inset-0 bg-grid-fade bg-grid opacity-50" />
        <div className="absolute -top-32 left-1/2 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-brand-600/[0.10] blur-[130px]" />
        <div className="absolute right-[8%] top-40 size-72 rounded-full bg-accent-cyan/[0.06] blur-[100px]" />
      </div>

      <Container className="relative py-24 sm:py-32">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <Badge tone="brand" size="md" className="mb-6">
            <Sparkles className="size-3" />
            Built for the ABTalks AI Cohort
          </Badge>

          <h1 className="text-display text-gradient">
            Find out if you're ready
            <br />
            <span className="text-gradient-brand">before it counts.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lead text-ink-muted">
            An AI interviewer that has actually read your cohort record. It knows which
            missions you aced, which took you five attempts, and which you skipped — and it
            builds every question from that.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
          </div>

          <p className="mt-5 text-xs text-ink-faint">
            No setup · Adapts in real time · Full report in under 20 minutes
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-16 max-w-4xl"
        >
          <HeroPreview />
        </motion.div>
      </Container>
    </section>
  )
}

/**
 * Product preview.
 *
 * A real interview turn rather than a stock dashboard screenshot. The point it
 * has to land in five seconds is the "why this question" line — that is the
 * entire differentiator, so it gets the visual emphasis.
 */
function HeroPreview() {
  return (
    <Card className="overflow-hidden p-0 shadow-float">
      <div className="flex items-center gap-2 border-b border-line bg-surface-raised px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-white/10" />
        </div>
        <div className="ml-3 flex items-center gap-2 text-xs text-ink-faint">
          <span className="font-medium text-ink-subtle">Interview in progress</span>
          <span>·</span>
          <span>Turn 6 of 11</span>
        </div>
        <Badge tone="cyan" className="ml-auto">
          Analytical
        </Badge>
      </div>

      <div className="grid gap-0 sm:grid-cols-[1fr_15rem]">
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 rounded-md bg-band-exceptional/10 px-2 py-1 font-medium text-band-exceptional">
              <GitBranch className="size-3" />
              Going deeper
            </span>
            <span className="text-ink-faint">Day 10 · Retrieval &amp; Matching Engine</span>
          </div>

          <p className="rounded-xl border border-brand-500/20 bg-brand-500/[0.06] p-3 text-xs leading-relaxed text-brand-300">
            <span className="font-semibold">Why this question: </span>
            That was a strong answer, so I'm raising this to design level on the same topic
            rather than moving on — I want to find your ceiling, not confirm your floor.
          </p>

          <p className="prose-interview">
            Your router picks between SQL and vector search. Now imagine 60% of queries are
            hybrid and latency budget is 300ms end to end. Where does that design break
            first, and what would you change?
          </p>

          <div className="rounded-xl border border-line bg-base-200 p-3">
            <p className="text-xs text-ink-faint">Your answer…</p>
          </div>
        </div>

        <div className="space-y-4 border-t border-line p-5 sm:border-l sm:border-t-0">
          <div>
            <p className="eyebrow mb-2">Readiness</p>
            <div className="flex items-baseline gap-1.5">
              <span className="nums text-2xl font-bold text-band-strong">78</span>
              <span className="flex items-center gap-0.5 text-xs font-medium text-band-exceptional">
                <TrendingUp className="size-3" />
                +6
              </span>
            </div>
          </div>
          <div className="space-y-2.5">
            {[
              ['Technical', 84],
              ['Reasoning', 76],
              ['Communication', 71],
            ].map(([label, value]) => (
              <div key={label as string} className="space-y-1">
                <div className="flex justify-between text-[0.6875rem]">
                  <span className="text-ink-subtle">{label}</span>
                  <span className="nums text-ink-muted">{value}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-cyan"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

/* -------------------------------------------------------- Problem section */

function ProblemStatement() {
  return (
    <section className="relative border-y border-line bg-surface/30 py-20">
      <Container>
        <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
          <p className="eyebrow mb-4">The gap</p>
          <h2 className="text-h1 text-gradient">
            You finished the cohort. You still don't know if you're ready.
          </h2>
          <p className="mt-5 text-lead text-ink-muted">
            Completion certificates measure attendance. Interviews measure thinking. Nothing
            in between tells you whether you can explain <em>why</em> you chose cosine
            similarity when a senior engineer pushes back.
          </p>
        </motion.div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            {
              icon: Target,
              stat: 'Generic',
              label: 'Practice question banks',
              body: 'The same 50 questions for everyone, regardless of what you actually studied or how well it went.',
            },
            {
              icon: Gauge,
              stat: 'Static',
              label: 'Mock interview tools',
              body: "Difficulty never moves. You either get bored or you drown, and neither tells you where you stand.",
            },
            {
              icon: FileCheck2,
              stat: 'Hollow',
              label: 'Automated scoring',
              body: '"Communication: 7/10." No evidence, no examples, nothing you can act on tomorrow morning.',
            },
          ].map((item, i) => (
            <motion.div key={item.label} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }}>
              <Card className="h-full p-6">
                <item.icon className="size-5 text-ink-faint" />
                <p className="mt-4 text-lg font-semibold text-ink">{item.stat}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  {item.label}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{item.body}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  )
}

/* --------------------------------------------------------- How it works */

const STEPS = [
  {
    n: '01',
    icon: Layers,
    title: 'It reads your record first',
    body: 'Before a single question, the system reads all 31 days of your cohort history and builds an evidence profile: what you mastered first try, what took five attempts, what you never touched.',
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

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24">
      <Container>
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-4">How it works</p>
          <h2 className="text-h1 text-gradient">Four steps. No black box.</h2>
        </motion.div>

        <div className="mx-auto mt-14 max-w-4xl space-y-3">
          {STEPS.map((step, i) => (
            <motion.div key={step.n} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.07 }}>
              <Card hover className="group grid gap-5 p-6 sm:grid-cols-[auto_1fr] sm:p-7">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-xl',
                      'border border-line-strong bg-surface-raised text-brand-400',
                      'transition-colors duration-300 group-hover:border-brand-500/40 group-hover:text-brand-300',
                    )}
                  >
                    <step.icon className="size-5" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="nums text-xs font-semibold text-ink-faint">{step.n}</span>
                    <h3 className="text-h3 text-ink">{step.title}</h3>
                  </div>
                  <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">{step.body}</p>
                  <p className="pt-1 text-xs font-medium text-brand-400">{step.detail}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------- Differentiators */

function Differentiators() {
  return (
    <section className="relative border-y border-line bg-surface/30 py-24">
      <Container>
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-4">What makes it different</p>
          <h2 className="text-h1 text-gradient">Three decisions you can feel</h2>
        </motion.div>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          <motion.div {...fadeUp}>
            <Card className="h-full overflow-hidden">
              <div className="border-b border-line bg-band-emerging/[0.04] p-6">
                <Ban className="size-5 text-band-emerging" />
                <h3 className="mt-4 text-h3 text-ink">It never asks about what you skipped</h3>
              </div>
              <div className="space-y-4 p-6">
                <p className="text-sm leading-relaxed text-ink-muted">
                  Skipped a mission? It's excluded from the question pool entirely — enforced
                  in code, not requested in a prompt.
                </p>
                <p className="text-sm leading-relaxed text-ink-muted">
                  Asking about material you never saw isn't rigour. It manufactures a failure
                  and destroys the trust the whole thing depends on.
                </p>
                <div className="rounded-lg border border-line bg-base-200 p-3">
                  <p className="text-xs text-ink-subtle">
                    It still lands in your <span className="text-ink">learning roadmap</span> —
                    just never as an interview question.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.08 }}>
            <Card className="h-full overflow-hidden">
              <div className="border-b border-line bg-brand-500/[0.05] p-6">
                <BrainCircuit className="size-5 text-brand-400" />
                <h3 className="mt-4 text-h3 text-ink">Five attempts is the most useful signal</h3>
              </div>
              <div className="space-y-4 p-6">
                <p className="text-sm leading-relaxed text-ink-muted">
                  A mission you cleared on the fifth try is the highest-value question in your
                  interview. It's the one place nobody knows whether the understanding landed
                  or the procedure was memorised.
                </p>
                <p className="text-sm leading-relaxed text-ink-muted">
                  So that's where it probes hardest — warmly, and at the level underneath the
                  surface.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ['1 attempt', 'text-band-exceptional bg-band-exceptional/10'],
                    ['2–3', 'text-band-strong bg-band-strong/10'],
                    ['4–5', 'text-band-developing bg-band-developing/10'],
                  ].map(([label, cls]) => (
                    <span key={label} className={cn('rounded-md px-2 py-1 text-[0.6875rem] font-medium', cls)}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.16 }}>
            <Card className="h-full overflow-hidden">
              <div className="border-b border-line bg-accent-cyan/[0.05] p-6">
                <ShieldCheck className="size-5 text-accent-cyan" />
                <h3 className="mt-4 text-h3 text-ink">The interview can't break</h3>
              </div>
              <div className="space-y-4 p-6">
                <p className="text-sm leading-relaxed text-ink-muted">
                  Grok is primary. If it times out or rate-limits, Gemini takes over
                  mid-sentence and you never notice. If both are down, a deterministic
                  strategist keeps your session alive.
                </p>
                <p className="text-sm leading-relaxed text-ink-muted">
                  The interview policy is plain Python — so it stays coherent no matter which
                  model is answering.
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-line bg-base-200 p-3 text-xs">
                  <span className="text-ink">Grok</span>
                  <ArrowRight className="size-3 text-ink-faint" />
                  <span className="text-ink-muted">Gemini</span>
                  <ArrowRight className="size-3 text-ink-faint" />
                  <span className="text-ink-subtle">Local</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </Container>
    </section>
  )
}

/* ----------------------------------------------------------- Testimonials */

const TESTIMONIALS = [
  {
    quote:
      "It asked me why I picked 500-token chunks. I'd never actually thought about it — I'd copied it from the notebook. That one question was worth more than a week of revision.",
    name: 'Priyanka Sharma',
    role: 'Software Engineer · 5 years',
    score: 74,
  },
  {
    quote:
      "Twenty-eight years in and I was nervous it'd make me feel old. Instead it noticed I was fluent on systems and new to agents, and built the whole interview around that. Genuinely impressive.",
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
      "Every mission took me four or five tries. I assumed the report would say I was hopeless. It said I had the highest persistence in the cohort and told me exactly what to tighten.",
    name: 'Tyler Brooks',
    role: 'Junior Developer · Bootcamp',
    score: 68,
  },
]

function Testimonials() {
  return (
    <section className="relative py-24">
      <Container>
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-4">From the cohort</p>
          <h2 className="text-h1 text-gradient">What it feels like on the other side</h2>
        </motion.div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {TESTIMONIALS.map((t, i) => (
            <motion.div key={t.name} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}>
              <Card hover className="flex h-full flex-col gap-5 p-6">
                <Quote className="size-5 shrink-0 text-brand-500/40" />
                <p className="flex-1 text-[0.9375rem] leading-relaxed text-ink/90">"{t.quote}"</p>
                <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
                  <div>
                    <p className="text-sm font-medium text-ink">{t.name}</p>
                    <p className="text-xs text-ink-subtle">{t.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="nums text-lg font-semibold text-band-strong">{t.score}</p>
                    <p className="text-[0.6875rem] text-ink-faint">readiness</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-ink-faint">
          Illustrative scenarios based on the ABTalks cohort dataset.
        </p>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------- Final CTA */

function FinalCta() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-1/2 h-96 w-[48rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/[0.10] blur-[110px]" />
      </div>
      <Container className="relative">
        <motion.div {...fadeUp}>
          <Card className="overflow-hidden bg-brand-sheen p-10 text-center sm:p-16">
            <Logo className="mx-auto size-11" />
            <h2 className="mt-6 text-h1 text-gradient">One interview. A real answer.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lead text-ink-muted">
              Twenty minutes, and you'll know exactly where you stand and exactly what to do
              next. Nothing to install, nothing to configure.
            </p>
            <Link to="/dashboard" className="mt-8 inline-block">
              <Button variant="primary" size="lg">
                Choose your profile
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </Card>
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
        <p className="text-xs text-ink-faint">
          Built for the ABTalks AI Hackathon · Grounded in the 31-day AI Cohort
        </p>
      </Container>
    </footer>
  )
}
