"""Breeth MCP client — longitudinal cross-interview memory.

## What Breeth is, and what it is not

Inspected directly (`tools/list` against https://mcp.thebreeth.com/mcp): the
server is `cogram` v1.27.1, a **temporal knowledge graph** — Graphiti-style
entity/edge extraction over Neo4j with a behavioural annotation layer. It
exposes 15 tools, 0 prompts, 0 resources.

It is **not** an LLM provider, agent framework, RAG service, auth service, or
document processor. It therefore replaces none of this platform's engines. It
adds exactly one capability we could not cheaply build: memory that persists
*across* interviews.

## The three constraints that shaped this client

**1. `search_graph` defaults to every group.** Straight from the tool docs:
"Default scope is EVERY group the user has data in." If we search for
"embeddings" while interviewing candidate A and forget to scope, we get
candidate B's answers back. That is a cross-candidate data leak and a fairness
violation in an assessment product. So `group_id` is a *required* argument on
every read in this module — there is no code path that can omit it.

**2. `retract` is team-wide by default on name targets.** Also from the docs.
Every retract here passes `group_id`.

**3. The write pipeline is async and slow.** `add_episode` returns a task_id in
~3s and the annotation pipeline settles ~15s later; reading before settlement
needs a blocking `get_episode_task(wait_seconds=20)`. Our interview turn budget
is 2-4s end to end. So **nothing in this module is ever called inside a turn.**
Writes happen once, after the interview completes, fire-and-forget.

## Failure policy

Every method returns a value or `None`. Nothing raises. Breeth being slow,
down, or misconfigured must never affect a live interview — same principle as
the LLM provider chain, where the local strategist guarantees a session can
never die. Memory is an enhancement; its absence degrades the product silently
rather than breaking it.
"""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Streamable-HTTP MCP responses come back as SSE frames: `data: {json}`.
_SSE_DATA = re.compile(r"^data:\s*(.+)$", re.MULTILINE)

# One group per candidate. Keeps every read naturally scoped and makes a
# candidate's entire memory trivially deletable — which matters for a product
# holding assessment data about real people.
GROUP_PREFIX = "cand_"


def group_for(candidate_id: str) -> str:
    """Deterministic, collision-free group label for one candidate."""
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", candidate_id)
    return f"{GROUP_PREFIX}{safe}"


@dataclass(slots=True)
class PriorInterview:
    """What Breeth remembers about a candidate from previous sessions."""

    narrative: str = ""
    facts: list[str] = field(default_factory=list)
    source_count: int = 0

    @property
    def has_content(self) -> bool:
        return bool(self.narrative.strip() or self.facts)


class BreethClient:
    """Thin, defensive JSON-RPC client for the Breeth MCP endpoint.

    Speaks MCP over Streamable HTTP directly rather than shelling out to
    `mcp-remote`. That npx bridge is designed for desktop MCP clients; spawning
    a Node subprocess per call from a FastAPI worker would add startup latency
    and a process-management problem for no benefit. The wire protocol is plain
    JSON-RPC and we only need five of the fifteen tools.
    """

    def __init__(self) -> None:
        self._id = 0
        self._client: httpx.AsyncClient | None = None
        self._lock = asyncio.Lock()

    @property
    def enabled(self) -> bool:
        return settings.breeth_configured

    async def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(settings.breeth_timeout_s, connect=6.0),
                headers={
                    "Authorization": f"Bearer {settings.breeth_api_key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/event-stream",
                },
            )
        return self._client

    async def _rpc(self, method: str, params: dict[str, Any]) -> dict[str, Any] | None:
        """One JSON-RPC round trip. Returns None on any failure, never raises."""
        if not self.enabled:
            return None

        async with self._lock:
            self._id += 1
            request_id = self._id

        try:
            client = await self._http()
            response = await client.post(
                settings.breeth_mcp_url,
                json={
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "method": method,
                    "params": params,
                },
            )
            if response.status_code >= 400:
                logger.warning(
                    "breeth_http_error",
                    extra={"status": response.status_code, "method": method},
                )
                return None

            body = response.text
            match = _SSE_DATA.search(body)
            payload = json.loads(match.group(1) if match else body)

            if "error" in payload:
                logger.warning(
                    "breeth_rpc_error",
                    extra={"method": method, "error": str(payload["error"])[:200]},
                )
                return None
            return payload.get("result")

        except Exception as exc:  # noqa: BLE001 — memory must never be fatal
            logger.warning(
                "breeth_unavailable",
                extra={"method": method, "error": str(exc)[:200]},
            )
            return None

    async def _call_tool(self, name: str, arguments: dict[str, Any]) -> str | None:
        """Invoke an MCP tool and return its text content."""
        result = await self._rpc(
            "tools/call", {"name": name, "arguments": arguments}
        )
        if not result:
            return None
        if result.get("isError"):
            logger.warning("breeth_tool_error", extra={"tool": name})
            return None

        parts = result.get("content") or []
        text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
        return text or None

    # -- writes -------------------------------------------------------------

    async def record_outcome(
        self,
        *,
        candidate_id: str,
        subject: str,
        predicate: str,
        obj: str,
    ) -> str | None:
        """Write one structural fact about a candidate.

        Uses `record_fact` rather than `add_episode`: it builds a clean
        subject-predicate-object triple, and the tool docs are explicit that
        this "locks edge structure better than free prose." Our facts are
        already structured — inventing narrative for the extractor to re-parse
        would only add ambiguity.

        `extract_intent` is deliberately left False. It bills the team's
        intent-extraction cap and is designed for inferring a *user's* decisions
        and preferences. We are recording observed candidate performance, which
        is a statement of fact, not an intent to mine.
        """
        return await self._call_tool(
            "record_fact",
            {
                "subject": subject,
                "predicate": predicate,
                "object": obj,
                "group_id": group_for(candidate_id),
                "extract_intent": False,
            },
        )

    async def record_narrative(self, *, candidate_id: str, content: str) -> str | None:
        """Write a prose episode — used for the interview summary."""
        return await self._call_tool(
            "add_episode",
            {
                "content": content,
                "source_description": "abtalks-interview-platform",
                "group_id": group_for(candidate_id),
                "extract_intent": False,
            },
        )

    # -- reads --------------------------------------------------------------

    async def recall(self, *, candidate_id: str, candidate_name: str) -> PriorInterview:
        """Everything Breeth knows about this candidate, group-scoped.

        Note `group_id` is passed explicitly on the search. Omitting it would
        search every group on the team and return other candidates' interview
        answers — see the module docstring.
        """
        prior = PriorInterview()
        if not self.enabled:
            return prior

        group = group_for(candidate_id)

        # `get_entity_view` has NO group_id parameter -- verified against the
        # live schema. It substring-matches entity names across the whole team,
        # so it can surface a different candidate's narrative. It is therefore
        # used only as *decoration*, and never as the thing that decides
        # whether this person has history.
        narrative_task = self._call_tool(
            "get_entity_view",
            {"entity_name": candidate_name, "mode": "narrative", "limit": 10},
        )
        # `search_graph` IS group-scopeable, so this is the authoritative
        # source of truth for "have we interviewed this person before".
        facts_task = self._call_tool(
            "search_graph",
            {
                "query": f"{candidate_name} interview performance strengths gaps",
                "limit": 12,
                "group_id": group,  # REQUIRED -- see module docstring
            },
        )

        narrative_raw, facts_raw = await asyncio.gather(narrative_task, facts_task)

        prior.facts = _extract_facts(facts_raw, limit=8) if facts_raw else []

        # Gate everything on group-scoped evidence. No facts in this
        # candidate's own group means no history -- regardless of what the
        # unscoped entity view returned. This is what stops a first-time
        # candidate being greeted as a returning one, and stops one candidate's
        # narrative bleeding into another's interview.
        if not prior.facts:
            return prior

        if narrative_raw:
            prior.narrative = _condense(narrative_raw, limit=800)

        prior.source_count = len(prior.facts)
        logger.info(
            "breeth_recall_hit",
            extra={"candidate": candidate_id, "facts": prior.source_count},
        )
        return prior

    async def whoami(self) -> dict[str, Any] | None:
        text = await self._call_tool("whoami", {})
        if not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return None

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None


# ---------------------------------------------------------------------------
# Response shaping
# ---------------------------------------------------------------------------

def _condense(raw: str, *, limit: int) -> str:
    """Pull readable prose out of a tool response.

    Breeth returns JSON-in-text, and `narrative` is a **list** of entity
    objects each carrying a `summary` -- not a string. Naively falling back to
    the raw payload dumps the whole JSON envelope into a system prompt, which
    is pure token waste and reads as noise to the model.

    Returns "" when there is nothing human-readable, so callers can treat
    empty as "no narrative" rather than having to sniff for envelope text.
    """
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return _clip(re.sub(r"\s+", " ", raw).strip(), limit)

    if not isinstance(parsed, dict):
        return ""

    # Explicit no-match response — the server tells us plainly.
    if parsed.get("note") and not parsed.get("narrative"):
        return ""

    pieces: list[str] = []
    narrative = parsed.get("narrative")

    if isinstance(narrative, list):
        for entry in narrative:
            if isinstance(entry, dict):
                summary = entry.get("summary")
                if isinstance(summary, str) and summary.strip():
                    pieces.append(summary.strip())
            elif isinstance(entry, str) and entry.strip():
                pieces.append(entry.strip())
    elif isinstance(narrative, str) and narrative.strip():
        pieces.append(narrative.strip())
    else:
        for key in ("summary", "text", "result"):
            value = parsed.get(key)
            if isinstance(value, str) and value.strip():
                pieces.append(value.strip())
                break

    text = re.sub(r"\s+", " ", " ".join(pieces)).strip()
    return _clip(text, limit)


def _clip(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + "…"


# Graph extraction sometimes yields a bare predicate with no object --
# "showed a gap in", "demonstrated solid reasoning". Those carry no
# information and, worse, read as damning fragments if shown to an
# interviewer. Require enough words to constitute a claim, and reject
# anything ending mid-phrase.
_FRAGMENT_TAIL = re.compile(
    r"\b(in|with|at|of|to|for|on|the|a|an|and|or)\s*$", re.IGNORECASE
)
_MIN_FACT_WORDS = 5


def _is_usable_fact(text: str) -> bool:
    if not text or len(text.split()) < _MIN_FACT_WORDS:
        return False
    return not _FRAGMENT_TAIL.search(text.strip())


def _extract_facts(raw: str, *, limit: int) -> list[str]:
    """Flatten search results into short fact sentences."""
    facts: list[str] = []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return [_condense(raw, limit=200)] if raw.strip() else []

    edges = []
    if isinstance(parsed, dict):
        for key in ("edges", "results", "facts", "hits"):
            value = parsed.get(key)
            if isinstance(value, list):
                edges = value
                break
    elif isinstance(parsed, list):
        edges = parsed

    for edge in edges:
        if len(facts) >= limit:
            break

        candidate = ""
        if isinstance(edge, str):
            candidate = edge.strip()
        elif isinstance(edge, dict):
            # `fact` first: it is the fully-formed sentence. `name` is often
            # just the bare predicate and produces fragments.
            for key in ("fact", "summary", "content", "name"):
                value = edge.get(key)
                if isinstance(value, str) and value.strip():
                    candidate = value.strip()
                    break

        candidate = _clip(re.sub(r"\s+", " ", candidate).strip(), 180)
        if _is_usable_fact(candidate) and candidate not in facts:
            facts.append(candidate)

    return facts


_client: BreethClient | None = None


def get_breeth() -> BreethClient:
    global _client
    if _client is None:
        _client = BreethClient()
    return _client


async def close_breeth() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
