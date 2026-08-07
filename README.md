# ABTalks · Interview Intelligence

**Evidence-grounded adaptive technical interviewing for the ABTalks AI Cohort.**

An AI interviewer that has actually read the candidate's cohort record. It knows which
missions they cleared first try, which took five attempts, and which they skipped — and it
builds every question from that.

---

## The thesis

`candidates.json` is not a résumé. It's **evidence**, and reading it properly is the entire
product:

| Signal in the data | What it means | Interview consequence |
| --- | --- | --- |
| `passed: true, attempts: 1` | Genuine fluency | Probe **deep**. Definitions waste their time. |
| `passed: true, attempts: 2–3` | Solid ground | Probe normally. |
| `passed: true, attempts: 4–5` | Ground it out | **Highest-value probe.** Did the model land, or was the procedure memorised? |
| `passed: false` | Honest gap | Diagnose gently. Never a gotcha. |
| `skipped: true` | Never saw the material | **Never asked about. Ever.** |

That last row is the product in miniature. A ChatGPT wrapper hands the model the JSON and
hopes; it will ask Wendy Foster about Kubernetes, which she skipped, and she'll feel stupid.
Here it's excluded from the question pool **in code, before any prompt is built** — and then
surfaced in her learning roadmap afterwards, which is the right place for it.

### What the aggregate hides

Harold Whitfield is a Distinguished Engineer, 28 years, 56% first-try overall — unremarkable.
Split by domain:

- **Classic engineering** (tooling, data, security, deployment): **5 of 6 first try**
- **AI-native** (embeddings, LLM core, agentic/MCP): **0 of 3** — every one a 4–5 attempt grind

That's not a middling candidate. It's a strong systems engineer meeting genuinely new
vocabulary, and it should change how the interview opens. The profiler detects this split and
says so, in plain language, before the first question.

---

## The architecture decision

> **Interview *policy* is deterministic Python. Only *language* is the LLM.**

```
Profiler   (pure Python)      → evidence profile, domain-split fluency, eligible topic pool
Planner    (pure Python)      → ordered probes: day → objective → competency → difficulty
Controller (pure Python)      → FOLLOW_UP | DRILL_DOWN | EASE_OFF | PIVOT | ADVANCE | CLOSE
Evaluator  (LLM, structured)  → per-answer rubric scores, Pydantic-validated 0–100
Reporter   (Python + LLM)     → arithmetic aggregation, then prose that explains it
```

The tempting build is one mega-prompt: dump curriculum + candidate, say "be an interviewer,"
parse JSON at the end. It demos on turn 3 and falls apart on turn 9 — repeated questions,
drifting difficulty, scores that are vibes.

Splitting it buys concrete guarantees:

- **Cannot repeat a question** — the planner owns topic allocation. A data structure, not a
  prompt instruction the model may ignore.
- **Cannot ask about skipped content** — filtered before the LLM sees the pool.
- **Difficulty genuinely adapts** — the controller moves a real integer and returns a
  human-readable reason, which the UI shows the candidate.
- **Scores are auditable** — the final number is a weighted mean over per-turn evidence. No
  model is ever asked "so what's the overall score?"
- **Prompt injection can't reach the score** — bounded integer fields plus deterministic
  aggregation. Structural, not regex-based.

---

## Running it

**Zero configuration required.** With no API keys and no database it boots, serves the full
API, and runs complete interviews on a deterministic local strategist. Add keys for real
model quality.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # optional — add API keys here
uvicorn app.main:app --reload --port 8000
```

- API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/v1/health

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to port 8000, so there's no CORS setup and no
backend URL baked into the bundle.

### Tests

```bash
cd backend && .venv\Scripts\python -m pytest tests/ -q
```

30 tests, no network required. They cover the spec contract end to end and every fairness
guarantee — including a sweep asserting that **no candidate in the dataset can ever be asked
about material they skipped.**

---

## Configuration

Everything is optional. See `backend/.env.example`.

| Variable | Default | Notes |
| --- | --- | --- |
| `XAI_API_KEY` | — | Grok, the primary model |
| `GEMINI_API_KEY` | — | Gemini 2.5 Flash, the fallback |
| `MONGODB_URI` | — | Empty → in-memory store, identical behaviour |
| `INTERVIEW_MIN_TURNS` / `MAX_TURNS` | 8 / 14 | ~20 minute session |

### Provider chain

```
Grok  →  Gemini 2.5 Flash  →  Local strategist
```

Failover is invisible to the candidate. A circuit breaker (3 failures → open, 60s reset)
stops every turn from burning a full retry budget when a provider is down — across a 14-turn
interview that would be two minutes of dead air. Tenacity handles transient errors with
jittered backoff.

The local tier exists so that **an interview already in progress can never die.** Because the
policy engines are deterministic, the session still advances correctly, still avoids repeats,
and still produces a scored report — just in plainer language.

---

## API

### Specification contract (frozen)

```
POST /api/interview
```

```jsonc
// start
{ "sessionId": "abc-123", "candidate": { ...candidate.json } }
→ { "reply": "...", "done": false }

// turn
{ "sessionId": "abc-123", "message": "..." }
→ { "reply": "...", "done": false }

// completion
→ { "reply": "...", "done": true,
    "feedback": { "summary": "...", "strengths": [], "gaps": [], "next": [] } }
```

Served by the same engine the frontend drives, so every interview exercises the graded
contract — it can't silently rot. Two behaviours the spec leaves open: **start is idempotent**
(a retried request replays rather than wiping the session), and the opening reply carries the
greeting *and* the first question, since a greeting alone leaves nothing to answer.

### Platform API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/interviews` | Start (by `candidate_id` or inline candidate) |
| `GET /api/v1/interviews/{id}` | Full state: profile, plan, transcript, live telemetry |
| `POST /api/v1/interviews/{id}/turns` | Submit answer → next question |
| `GET /api/v1/interviews/{id}/report` | Final report |
| `GET /api/v1/interviews/{id}/diagnostics` | Provider call trail — did failover fire, and what did it cost |
| `GET /api/v1/candidates/{id}/profile` | Evidence profile + planned probes, **before** starting |
| `GET /api/v1/curriculum` | The 31-day curriculum |

---

## Product decisions worth defending

**The live rail shows no per-answer scores.** Telling someone "that answer scored 41"
mid-interview spikes anxiety and changes how they answer the next question — you end up
measuring the interface, not the candidate. The rail shows one smoothed readiness figure,
floored at 25, that rises quickly and falls slowly.

**"Why this question?" is one click away on every turn.** The controller's decision is shipped
to the UI verbatim. It's what turns *"the AI adapted"* from a claim in a pitch deck into
something the candidate can verify.

**The last question is deliberately easier.** The difficulty arc peaks around three-quarters
through, then steps back. The final answer is what someone remembers, and they should leave
having answered something well.

**Two weak turns pivot rather than grind.** One weak answer lowers difficulty on the same
topic. Two abandons it warmly and moves somewhere they can show more. A non-answer ("idk")
doesn't count toward that streak — pivoting on honesty would punish exactly the behaviour the
rubric rewards.

**Recommendation thresholds shift with seniority.** 72 is a strong result for an intern and a
mediocre one for a Distinguished Engineer. A fixed cut-off systematically over-rewards the
experienced and punishes the junior.

---

## Layout

```
backend/app/
  core/       config · structured logging · error taxonomy · sanitisation
  domain/     models mirroring the source JSON · enums · scoring rubric
  data/       curriculum.json · candidates.json · validating loader
  db/         Mongo lifecycle · repositories (Mongo + in-memory, one interface)
  ai/         provider base · Grok · Gemini · local strategist · router · prompts
  engine/     profiler · planner · controller · evaluator · reporter · service
  api/        spec contract (frozen) · v1 platform API
frontend/src/
  components/ui/   design system primitives · ScoreRing · Markdown
  features/        landing · dashboard · interview · report
  lib/             typed API client · domain formatting · design tokens
```

---

## Known limits

- **Offline mode scores are coarse.** With no API keys the heuristic scorer keeps sessions
  alive and coherent but is not a substitute for a real model. Set `XAI_API_KEY` or
  `GEMINI_API_KEY` before judging assessment quality.
- **Reports are single-session.** Cross-interview trend analytics are wired through the API
  and dashboard but only populate once a candidate has completed more than one interview.
- **`prompt_versions` and `analytics` collections are indexed but not yet written to** — the
  schema is in place for prompt A/B testing, which is the natural next step.

---

Built for the ABTalks AI Hackathon · Grounded in the 31-day AI Cohort curriculum.
