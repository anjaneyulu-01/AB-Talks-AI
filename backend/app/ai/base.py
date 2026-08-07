"""Provider-agnostic LLM contract.

The whole point of this abstraction is that conversation context survives a
provider switch. Grok and Gemini have genuinely different wire formats -- Grok
is OpenAI-shaped with a `system` role, Gemini uses `contents` with `parts` and
a separate `systemInstruction`. If that difference leaked upward, a mid-
interview failover would corrupt the transcript. So it stops here.
"""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.domain.enums import ProviderName


@dataclass(slots=True)
class ChatMessage:
    role: str  # "user" | "assistant"
    content: str


@dataclass(slots=True)
class LLMResponse:
    text: str
    provider: ProviderName
    model: str
    latency_ms: int
    finish_reason: str = "stop"
    usage: dict[str, Any] = field(default_factory=dict)

    def as_json(self) -> dict[str, Any]:
        """Parse the response as JSON, tolerating the ways models wrap it.

        Models fenced JSON in markdown long before they had JSON modes, and
        they still do it intermittently under load. Being forgiving here is the
        difference between a robust evaluator and one that throws on turn 7.
        """
        return extract_json(self.text)


class JSONParseError(ValueError):
    pass


_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def extract_json(text: str) -> dict[str, Any]:
    if not text or not text.strip():
        raise JSONParseError("empty response")

    candidates: list[str] = []
    stripped = text.strip()
    candidates.append(stripped)

    fenced = _FENCE.search(text)
    if fenced:
        candidates.insert(0, fenced.group(1))

    # Last resort: the outermost brace-balanced span. Handles a model that
    # prefixes "Here's the evaluation:" before the object.
    span = _balanced_object(text)
    if span:
        candidates.append(span)

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed
        if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
            return parsed[0]

    raise JSONParseError(f"no JSON object found in response: {text[:200]!r}")


def _balanced_object(text: str) -> str | None:
    start = text.find("{")
    if start == -1:
        return None
    depth, in_string, escaped = 0, False, False
    for i in range(start, len(text)):
        ch = text[i]
        if escaped:
            escaped = False
            continue
        if ch == "\\":
            escaped = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


class BaseProvider(ABC):
    name: ProviderName
    model: str

    @abstractmethod
    async def complete(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 1200,
        json_mode: bool = False,
    ) -> LLMResponse:
        """Return a completion. Raise on any failure so the router can fail over."""

    @abstractmethod
    async def healthy(self) -> bool: ...

    async def aclose(self) -> None:
        return None

    def __repr__(self) -> str:
        return f"<{type(self).__name__} model={self.model}>"
