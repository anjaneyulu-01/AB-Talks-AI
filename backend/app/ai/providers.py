"""Concrete providers: Grok (primary), Gemini 2.5 Flash (fallback), Local (floor).

Each provider translates the neutral `ChatMessage` list into its own wire
format and translates the reply back. Nothing above this file knows or cares
which one answered.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from app.ai.base import BaseProvider, ChatMessage, LLMResponse
from app.core.config import settings
from app.core.errors import AIProviderError
from app.core.logging import get_logger
from app.core.security import redact_secrets
from app.domain.enums import ProviderName

logger = get_logger(__name__)


class TransientProviderError(AIProviderError):
    """Worth retrying: timeout, 429, 5xx, connection reset."""


class PermanentProviderError(AIProviderError):
    """Not worth retrying: bad key, malformed request, model not found."""


def _classify(status_code: int, body: str) -> AIProviderError:
    if status_code in (408, 409, 425, 429, 500, 502, 503, 504):
        return TransientProviderError(f"http {status_code}: {body[:200]}")
    return PermanentProviderError(f"http {status_code}: {body[:200]}")


_RETRY = dict(
    stop=stop_after_attempt(settings.ai_max_attempts),
    # Jitter matters under a rate limit: synchronised retries from concurrent
    # interviews would re-trigger the same 429 in lockstep.
    wait=wait_exponential_jitter(initial=0.6, max=8.0),
    retry=retry_if_exception_type((TransientProviderError, httpx.TransportError)),
    reraise=True,
)


class OpenAICompatibleProvider(BaseProvider):
    """Shared implementation for any `/chat/completions` provider.

    Groq and xAI expose the identical OpenAI wire format, so they differ only
    in base URL, key and model name. One implementation, two thin subclasses --
    adding a third OpenAI-compatible host later is a five-line change.
    """

    name: ProviderName

    def __init__(self, *, base_url: str, api_key: str, model: str) -> None:
        self.model = model
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(settings.ai_request_timeout_s, connect=10.0),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )

    @retry(**_RETRY)
    async def complete(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 1200,
        json_mode: bool = False,
    ) -> LLMResponse:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}]
            + [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        started = time.perf_counter()
        try:
            response = await self._client.post("/chat/completions", json=payload)
        except httpx.TimeoutException as exc:
            raise TransientProviderError(f"{self.name.value} timeout: {exc}") from exc

        if response.status_code >= 400:
            # `json_validate_failed` means a reasoning model exhausted its
            # token budget before closing the JSON object. Retrying the same
            # request reproduces it exactly -- the fix is a larger budget, so
            # classify it permanent and let the router fail over immediately
            # rather than burn three attempts on a guaranteed failure.
            if "json_validate_failed" in response.text:
                raise PermanentProviderError(
                    f"{self.name.value} could not close JSON within max_tokens "
                    f"({self.model} is a reasoning model — raise the budget)"
                )
            raise _classify(response.status_code, response.text)

        data = response.json()
        choice = data["choices"][0]
        return LLMResponse(
            text=choice["message"]["content"] or "",
            provider=self.name,
            model=data.get("model", self.model),
            latency_ms=int((time.perf_counter() - started) * 1000),
            finish_reason=choice.get("finish_reason", "stop"),
            usage=data.get("usage", {}),
        )

    async def healthy(self) -> bool:
        return True

    async def aclose(self) -> None:
        await self._client.aclose()


class GroqProvider(OpenAICompatibleProvider):
    """Groq — the primary. Very fast inference, OpenAI-compatible.

    Not to be confused with xAI's Grok. The cohort curriculum teaches Groq on
    Day 11, which makes it the natural primary for this platform.
    """

    name = ProviderName.GROQ

    def __init__(self) -> None:
        super().__init__(
            base_url=settings.groq_base_url,
            api_key=settings.groq_api_key,
            model=settings.groq_model,
        )


class GrokProvider(OpenAICompatibleProvider):
    """xAI Grok. Same wire format as Groq, different host and key prefix."""

    name = ProviderName.GROK

    def __init__(self) -> None:
        super().__init__(
            base_url=settings.xai_base_url,
            api_key=settings.xai_api_key,
            model=settings.xai_model,
        )


class GeminiProvider(BaseProvider):
    """Google Gemini 2.5 Flash.

    Different shape from Grok in three ways we have to normalise: `assistant`
    is called `model`, content lives in `parts`, and the system prompt is a
    top-level `systemInstruction` rather than a message.
    """

    name = ProviderName.GEMINI

    def __init__(self) -> None:
        self.model = settings.gemini_model
        self._client = httpx.AsyncClient(
            base_url=settings.gemini_base_url.rstrip("/"),
            timeout=httpx.Timeout(settings.ai_request_timeout_s, connect=10.0),
            headers={"Content-Type": "application/json"},
        )

    @retry(**_RETRY)
    async def complete(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 1200,
        json_mode: bool = False,
    ) -> LLMResponse:
        contents = [
            {
                "role": "model" if m.role == "assistant" else "user",
                "parts": [{"text": m.content}],
            }
            for m in messages
        ]

        generation_config: dict[str, Any] = {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        }
        if json_mode:
            generation_config["responseMimeType"] = "application/json"

        payload: dict[str, Any] = {
            "contents": contents,
            "systemInstruction": {"parts": [{"text": system}]},
            "generationConfig": generation_config,
        }

        started = time.perf_counter()
        try:
            response = await self._client.post(
                f"/models/{self.model}:generateContent",
                json=payload,
                params={"key": settings.gemini_api_key},
            )
        except httpx.TimeoutException as exc:
            raise TransientProviderError(f"gemini timeout: {exc}") from exc

        if response.status_code >= 400:
            raise _classify(response.status_code, response.text)

        data = response.json()
        candidates = data.get("candidates") or []
        if not candidates:
            # Safety filters return 200 with no candidate. That is permanent
            # for this input -- retrying the identical prompt cannot help.
            reason = data.get("promptFeedback", {}).get("blockReason", "no_candidates")
            raise PermanentProviderError(f"gemini returned no candidates: {reason}")

        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts)

        return LLMResponse(
            text=text,
            provider=self.name,
            model=self.model,
            latency_ms=int((time.perf_counter() - started) * 1000),
            finish_reason=candidates[0].get("finishReason", "STOP"),
            usage=data.get("usageMetadata", {}),
        )

    async def healthy(self) -> bool:
        return bool(settings.gemini_api_key.strip())

    async def aclose(self) -> None:
        await self._client.aclose()


class LocalProvider(BaseProvider):
    """The floor. Deterministic, offline, and incapable of failing.

    This exists for one reason: an interview that has already started must
    never die. If both hosted providers are down, the candidate gets a slightly
    plainer question rather than an error screen -- and because the *policy*
    engines are deterministic Python, the interview still advances correctly,
    still avoids repeats, and still produces a scored report.

    It is also what makes the repo runnable with no API keys at all, which is
    the difference between a reviewer seeing the product and seeing a 503.
    """

    name = ProviderName.LOCAL

    def __init__(self) -> None:
        self.model = "abtalks-local-strategist"

    async def complete(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 1200,
        json_mode: bool = False,
    ) -> LLMResponse:
        started = time.perf_counter()
        # A touch of latency so the UI's thinking state doesn't flicker.
        await asyncio.sleep(0.35)

        from app.ai.local_strategist import render_local_response

        text = render_local_response(system=system, messages=messages, json_mode=json_mode)
        return LLMResponse(
            text=text,
            provider=self.name,
            model=self.model,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )

    async def healthy(self) -> bool:
        return True


def build_providers() -> list[BaseProvider]:
    """Ordered preference chain. Only configured providers are instantiated.

    Groq leads on latency, Gemini backs it up, and the local strategist is the
    floor that guarantees a live interview can never die.
    """
    chain: list[BaseProvider] = []

    if settings.groq_api_key.strip():
        chain.append(GroqProvider())
    if settings.xai_api_key.strip():
        chain.append(GrokProvider())
    if settings.gemini_api_key.strip():
        chain.append(GeminiProvider())

    if not chain:
        logger.warning(
            "no_hosted_llm_configured",
            extra={"hint": "set GROQ_API_KEY and/or GEMINI_API_KEY in backend/.env"},
        )

    chain.append(LocalProvider())

    logger.info(
        "provider_chain_ready",
        extra={"chain": " -> ".join(p.name.value for p in chain)},
    )
    return chain
