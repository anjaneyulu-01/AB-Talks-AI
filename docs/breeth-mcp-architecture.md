# Breeth MCP — Inspection Findings & Platform Architecture

**Date:** 7 August 2026
**Method:** Direct JSON-RPC inspection of `https://mcp.thebreeth.com/mcp` (`initialize`,
`tools/list`, `prompts/list`, `resources/list`, plus live `whoami` and `list_groups` calls).
Nothing below is assumed; every claim about Breeth came off the wire.

---

## 1. What Breeth actually is

| | |
|---|---|
| **Server** | `cogram` v1.27.1 (uvicorn, MCP Streamable HTTP) |
| **Surface** | **15 tools · 0 prompts · 0 resources** |
| **Account** | Anjaneyulu Organization → project `default` · role `admin` · scopes `["write"]` |
| **Nature** | **Temporal knowledge graph** — Graphiti-style entity/edge extraction over Neo4j, with a behavioural annotation layer |

**Breeth is not an AI platform.** It is a memory system. It does one thing deeply and
provides nothing else. This is the single most important finding, because the brief assumed
otherwise.

### The 15 tools

| Group | Tools |
|---|---|
| **Write** | `add_episode` · `record_fact` · `retract` |
| **Read** | `search_graph` · `get_entity_view` · `get_episode` |
| **Behavioural** | `list_cognitive_patterns` · `edges_by_pattern` · `get_director_profile` · `get_unified_profile` |
| **Admin** | `whoami` · `list_groups` |
| **Async** | `list_episode_tasks` · `get_episode_task` · `cancel_episode_task` |

### Capability audit against the 15 requested categories

| Category | Provided? | Detail |
|---|:--:|---|
| Memory | ✅ | Core competency. Episodes, entities, edges, retraction with audit trail. |
| Knowledge Base | ✅ | Entity/edge shaped. Not document shaped. |
| Analytics | 🟡 | *Behavioural* analytics (`cognitive_patterns`, `director_profile`). Not product analytics. |
| RAG | 🟡 | `search_graph` retrieves **facts**, not passages. No chunking, no document ingestion. |
| Vector Search | 🟡 | Embeddings are internal to `search_graph`. No exposed index, no upsert, no similarity API. |
| Authentication | 🟡 | `whoami` authenticates *us to Breeth*. Cannot authenticate candidates. |
| AI Chat | ❌ | — |
| **LLM inference** | ❌ | **No inference endpoint. The provider chain stays ours.** |
| Tool Calling | ❌ | Breeth *is* tools; it does not orchestrate them. |
| Agent Framework | ❌ | — |
| Prompt Management | ❌ | `prompts/list` → `[]`. |
| Document Processing | ❌ | — |
| File Search · Web Search · Speech | ❌ | — |

**Can Breeth replace custom backend logic?** No. Not the profiler, planner, controller,
evaluator, reporter, provider chain, prompt manager, or session store. It **adds one
capability** none of them have: memory that persists *across* interviews.

---

## 2. Build vs. reuse decisions

| Capability | Decision | Why |
|---|---|---|
| Cross-interview memory | **Breeth** | Genuinely hard to build. Temporal graph + entity resolution + retraction is months of work. |
| LLM inference | **Ours** (Groq → Gemini → local) | Breeth provides none. |
| Evidence profiling | **Ours** | Deterministic arithmetic over mission records. Must be exact and reproducible; a graph gives fuzzy recall. |
| Question planning | **Ours** | Must guarantee no repeats and no skipped-topic questions. Structural guarantees, not retrieval. |
| Adaptive control | **Ours** | Pure function, unit-testable. This is the product's differentiator. |
| Answer evaluation | **Ours** | Bounded Pydantic schema; scores must be auditable. |
| Session state | **MongoDB** | Needs exact, immediate, transactional reads. |
| Curriculum | **JSON file** | `day_by_number(7)` must return day 7, not "something like day 7". |
| Prompt versioning | **Ours** | Breeth exposes no prompt surface. |
| Candidate auth | **Neither yet** | Breeth cannot do it. Not required by the spec. |

---

## 3. Three constraints that shaped the integration

These fall directly out of the tool documentation and were confirmed in testing.

### 3.1 `search_graph` defaults to *every* group

> *"Default scope is EVERY group the user has data in."*

Search for "embeddings" while interviewing candidate A without scoping, and you get
candidate B's interview answers. In an assessment product that is a **cross-candidate data
leak and a fairness violation**.

**Mitigation:** one group per candidate (`cand_CAND-003`), and `group_id` is a *required*
argument on every read path in `app/memory/breeth.py`. There is no code path that can omit it.

### 3.2 `get_entity_view` cannot be scoped at all

Verified against the live schema: its parameters are `entity_name`, `mode`, `limit`. **No
`group_id`.** It substring-matches entity names team-wide.

**Mitigation:** it is used only as *decoration*. The group-scoped `search_graph` result is
the sole authority on whether a candidate has history. If scoped facts are empty, recall
returns empty regardless of what the entity view said.

This caught a real bug in testing: a first-time candidate (Tyler Brooks) was being greeted
as a returning one, because the "No entity matches" JSON envelope was non-empty and
`has_content` was checking the wrong thing.

### 3.3 The write pipeline is async and slow

`add_episode` returns a `task_id` in ~3s; the annotation pipeline settles ~15s later.
Reading before settlement requires a blocking `get_episode_task(wait_seconds=20)`.

Our interview turn budget is 2–4s end to end.

**Mitigation:** **nothing in the memory layer is ever called inside a turn.** Recall runs
once at session start and is cached. Writes are detached (`asyncio.create_task`) after the
report is saved, with a strong reference held so the loop cannot garbage-collect them
mid-flight.

---

## 4. Recommended architecture

```
                          ┌──────────────────────────────┐
   React 19 / Vite ──────▶│  FastAPI                     │
                          │                              │
                          │  /api/interview   (frozen)   │
                          │  /api/v1/*        (platform) │
                          └───────────────┬──────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              ▼                           ▼                           ▼
   ┌────────────────────┐   ┌──────────────────────────┐   ┌────────────────────┐
   │ DETERMINISTIC      │   │ AI LAYER                 │   │ PERSISTENCE        │
   │ POLICY (pure fns)  │   │                          │   │                    │
   │                    │   │  Groq  (primary)         │   │  MongoDB Atlas     │
   │  Profiler          │   │    ↓ circuit breaker     │   │   sessions         │
   │  Planner           │   │  Gemini 2.5 Flash        │   │   reports          │
   │  Controller        │   │    ↓                     │   │   messages         │
   │  Rubric / scoring  │   │  Local strategist        │   │                    │
   └────────────────────┘   │                          │   │  ── or in-memory   │
                            │  Evaluator (structured)  │   │     fallback       │
                            │  Reporter (prose only)   │   └────────────────────┘
                            └──────────────────────────┘
                                          │
                                          ▼
                            ┌──────────────────────────┐
                            │ BREETH MCP  (optional)   │
                            │  longitudinal memory     │
                            │                          │
                            │  recall  ← session start │
                            │  write   → after report  │
                            │            (detached)    │
                            └──────────────────────────┘
```

**The governing principle is unchanged:** interview *policy* is deterministic Python; the
LLM supplies language and assessment, never control flow. Breeth attaches at the edges —
before the first question and after the last — and never inside the loop.

---

## 5. MCP integration strategy

**Direct JSON-RPC over HTTP, not the `npx mcp-remote` bridge.**

That bridge exists for desktop MCP clients. Spawning a Node subprocess per call from a
FastAPI worker would add startup latency and a process-management problem for no benefit.
The wire protocol is plain JSON-RPC and we use 5 of the 15 tools.

`.mcp.json` is still provided so Claude Code sessions get the tools interactively — that is
a *development* convenience, separate from the runtime path.

| Tool | Used for |
|---|---|
| `record_fact` | Per-topic strength/gap after each interview |
| `add_episode` | One-paragraph interview summary |
| `search_graph` | Group-scoped recall — the authority on prior history |
| `get_entity_view` | Narrative decoration only (cannot be scoped) |
| `whoami` | Startup connectivity check |

**Unused, deliberately:** `retract` (no correction workflow yet), the four behavioural tools
(need 3+ interviews per candidate before they say anything real), the async task tools
(nothing waits on writes).

---

## 6. What we write, and what we refuse to write

A knowledge graph full of noise is worse than an empty one — it produces confident,
irrelevant recall.

**Written:** demonstrated strengths (score ≥ 75), demonstrated gaps (score ≤ 50), and a
one-paragraph summary. Capped at 6 facts per interview, gaps first.

**Never written:**
- Raw answer text — privacy, and it is already in Mongo.
- Per-turn scores — session-relative, would mislead later.
- Anything about *skipped* curriculum days — that asymmetry is load-bearing. Skipped
  material must never become an interview question, and putting it in memory invites
  exactly that.

### A subtlety that cost a debugging cycle

Long predicates get split by the graph extractor and lose their object, producing fragments
like `"showed a gap in"` — which read as damning when surfaced back to an interviewer.

```python
#  Wrong: extractor splits this, object is lost
(name, "demonstrated strength in", f"{title} at {level} level")

#  Right: short verb, complete object, survives extraction
(name, "is strong at", f"{title} ({level} level)")
```

A defensive filter (`_is_usable_fact`) rejects any fact under 5 words or ending on a
dangling preposition, in case the extractor fragments anyway.

---

## 7. Interview workflow

```
START
 ├─ Profiler        (deterministic)  evidence profile from mission record
 ├─ Planner         (deterministic)  probe plan: day → objective → competency → difficulty
 ├─ Breeth recall   (group-scoped)   prior-interview context, cached for session ── FAILS SOFT
 └─ Greeting + Q1   (LLM)            returning candidates acknowledged naturally

EACH TURN                            ← Breeth is NOT called here
 ├─ Sanitise                         neutralise-and-flag prompt injection
 ├─ Evaluate        (LLM, schema)    bounded 0-100 per competency
 ├─ register_evaluation              update weak-turn streak
 ├─ decide          (pure fn)        FOLLOW_UP | DRILL_DOWN | EASE_OFF | PIVOT | ADVANCE | CLOSE
 ├─ apply                            mutate session at one known point
 └─ Generate Q      (LLM)            phrasing only — the decision is already made

CLOSE
 ├─ Aggregate       (arithmetic)     weighted by recency × signal quality
 ├─ Recommend       (threshold)      banded by seniority
 ├─ Narrate         (LLM)            explains fixed numbers, cannot revise them
 ├─ Roadmap         (curriculum)     real days, includes skipped material
 ├─ Save            Mongo            session + report
 └─ Breeth write    (detached)       ~15s pipeline, nobody waits ── FAILS SOFT
```

---

## 8. Folder structure (additions in bold)

```
backend/app/
  core/      config · logging · errors · security
  domain/    models · enums · rubric
  data/      curriculum.json · candidates.json · loader
  db/        mongo · repositories
  ai/        base · providers · router · prompts · local_strategist
  engine/    profiler · planner · controller · evaluator · reporter · interview_service
  memory/    **breeth.py**       MCP client, group-scoped, fails soft
             **longitudinal.py** what to remember, how to render it
  api/       spec (frozen) · v1/
```

Three new files. No existing engine changed its contract.

---

## 9. Benefits of using Breeth

1. **Closes a real, documented gap.** The README already flagged *"Reports are
   single-session."* This is the fix.
2. **A candidate is recognised across sessions.** *"Last time you weren't sure about MCP
   failure modes — where are you with that now?"* No other hackathon entry will do this.
3. **Growth becomes measurable and visible**, not just a score delta.
4. **Zero risk to the core product.** Optional, fails soft, off the turn loop. Breeth down =
   today's behaviour exactly.
5. **Future headroom.** After 3+ interviews per candidate, `edges_by_pattern` can surface
   longitudinal patterns ("consistently strong on mechanics, consistently thin on
   trade-offs") that no single interview can prove.

## 10. Competitive advantages

- **Most entries will not inspect the server.** They will assume Breeth provides chat or
  inference, wire it wrong, and either fail or bolt on something meaningless. We can state
  precisely what it does and why we used it for exactly one thing.
- **We found the constraints the docs bury.** The team-wide search default is a live
  cross-candidate data leak for anyone who stores multiple candidates and forgets to scope.
  We designed it out.
- **We use it where it is genuinely strongest** — temporal memory — rather than forcing it
  to be a database or a retriever.
- **Correct failure semantics.** Optional infrastructure that degrades silently is a
  production instinct, and it matches how the provider chain already behaves.

---

## Appendix: unrelated issues found while integrating

Three real bugs surfaced from the newly-added `.env`, all now fixed:

1. **`MONGO_URI` was silently ignored** — config read `MONGODB_URI`, so the app ran on the
   in-memory store while appearing healthy. Both spellings now accepted. *(An `AliasChoices`
   validation_alias does **not** resolve against the dotenv source — it fails silently, which
   is the worst possible failure mode for a connection string.)*

2. **`GROQ_API_KEY` was present; no xAI key was.** **Groq** (fast inference host,
   OpenAI-compatible, `gsk_` keys) is a different company from **Grok** (xAI, `xai_` keys).
   The cohort curriculum teaches Groq on Day 11, so the brief's "Grok" is almost certainly
   Groq. Groq now leads the chain; xAI remains supported.

3. **Reasoning models break JSON mode at low token caps.** `gpt-oss-120b` spends output
   tokens thinking before emitting anything and returns `json_validate_failed` — not a
   partial object — when it runs out. Measured: 304 completion tokens where
   `llama-3.3-70b` needed 108. Budgets raised; the error is now classified *permanent* so
   the router fails over immediately instead of burning three guaranteed-identical retries.

Also: the test suite had started calling live APIs (12s → 211s, costing money,
non-reproducible). `tests/conftest.py` now blanks all credentials before app import and
asserts offline, with the suite back to 12.6s.

**Mongo timeout raised 5s → 15s.** A free-tier Atlas cluster that has gone idle needs longer
to wake; at 5s persistence appeared to "work sometimes", which is worse than not working.
