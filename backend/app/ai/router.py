"""The AI router: failover, circuit breaking, and observability.

Design rule that drove everything here: **the candidate must never see the
seam.** A provider switch mid-interview is an operational event, not a user-
facing one. So the router returns the same `LLMResponse` shape regardless of
who served it, and the only trace is a `ProviderCall` record the dashboard can
show to *us*.

Why a circuit breaker rather than just retrying: if Grok is down, every single
turn would otherwise burn its full retry budget (~3 attempts with backoff, up
to ~10s) before falling back. Across a 14-turn interview that is two minutes of
dead air. The breaker learns after three failures and routes straight to Gemini
until the reset window elapses.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from app.ai.base import BaseProvider, ChatMessage, LLMResponse
from app.core.config import settings
from app.core.errors import AllProvidersFailedError
from app.core.logging import get_logger
from app.core.security import redact_secrets
from app.domain.enums import ProviderName
from app.domain.models import ProviderCall

logger = get_logger(__name__)


@dataclass
class CircuitBreaker:
    """Classic three-state breaker.

    closed -> failures accumulate -> open (skip provider entirely)
           -> after reset window -> half-open (one trial request)
           -> success closes it, failure re-opens it
    """

    fail_threshold: int
    reset_seconds: float
    failures: int = 0
    opened_at: float | None = None

    @property
    def state(self) -> str:
        if self.opened_at is None:
            return "closed"
        if time.monotonic() - self.opened_at >= self.reset_seconds:
            return "half_open"
        return "open"

    def allows(self) -> bool:
        return self.state != "open"

    def record_success(self) -> None:
        self.failures = 0
        self.opened_at = None

    def record_failure(self) -> None:
        self.failures += 1
        if self.failures >= self.fail_threshold and self.opened_at is None:
            self.opened_at = time.monotonic()


@dataclass
class RouterStats:
    calls: int = 0
    failovers: int = 0
    by_provider: dict[str, int] = field(default_factory=dict)
    last_error: str | None = None


class AIRouter:
    def __init__(self, providers: list[BaseProvider]) -> None:
        if not providers:
            raise ValueError("AIRouter requires at least one provider")
        self._providers = providers
        self._breakers = {
            p.name: CircuitBreaker(
                fail_threshold=settings.ai_circuit_fail_threshold,
                reset_seconds=settings.ai_circuit_reset_s,
            )
            for p in providers
        }
        self.stats = RouterStats()

    @property
    def chain(self) -> list[str]:
        return [p.name.value for p in self._providers]

    def breaker_states(self) -> dict[str, str]:
        return {name.value: b.state for name, b in self._breakers.items()}

    async def complete(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        purpose: str,
        temperature: float = 0.7,
        max_tokens: int = 1200,
        json_mode: bool = False,
    ) -> tuple[LLMResponse, list[ProviderCall]]:
        """Try each provider in order. Return the first success plus an audit trail.

        The audit trail is returned rather than logged-and-forgotten because
        the session stores it: showing "Grok timed out, Gemini answered in
        820ms" on an ops view is how you build trust in a failover path that
        users are supposed to never notice.
        """
        calls: list[ProviderCall] = []
        attempted: list[ProviderName] = []
        last_error: Exception | None = None

        for provider in self._providers:
            breaker = self._breakers[provider.name]

            if not breaker.allows():
                logger.info(
                    "provider_skipped_circuit_open",
                    extra={"provider": provider.name.value, "purpose": purpose},
                )
                continue

            started = time.perf_counter()
            try:
                response = await provider.complete(
                    system=system,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    json_mode=json_mode,
                )
                breaker.record_success()

                fell_back_from = attempted[0] if attempted else None
                calls.append(
                    ProviderCall(
                        provider=provider.name,
                        model=response.model,
                        purpose=purpose,
                        latency_ms=response.latency_ms,
                        ok=True,
                        fell_back_from=fell_back_from,
                    )
                )

                self.stats.calls += 1
                self.stats.by_provider[provider.name.value] = (
                    self.stats.by_provider.get(provider.name.value, 0) + 1
                )
                if fell_back_from:
                    self.stats.failovers += 1
                    logger.warning(
                        "provider_failover_succeeded",
                        extra={
                            "from": fell_back_from.value,
                            "to": provider.name.value,
                            "purpose": purpose,
                        },
                    )

                return response, calls

            except Exception as exc:  # noqa: BLE001 - we fail over on anything
                elapsed = int((time.perf_counter() - started) * 1000)
                breaker.record_failure()
                last_error = exc
                attempted.append(provider.name)
                message = redact_secrets(str(exc))[:300]
                self.stats.last_error = message

                calls.append(
                    ProviderCall(
                        provider=provider.name,
                        model=provider.model,
                        purpose=purpose,
                        latency_ms=elapsed,
                        ok=False,
                        error=message,
                    )
                )
                logger.warning(
                    "provider_failed",
                    extra={
                        "provider": provider.name.value,
                        "purpose": purpose,
                        "breaker": breaker.state,
                        "error": message,
                    },
                )

        # Unreachable in practice: LocalProvider is always last and cannot
        # fail. Kept because "in practice" is not "by construction".
        raise AllProvidersFailedError(
            "The interviewer is momentarily unavailable. Please retry.",
            details={"attempted": [p.value for p in attempted]},
        ) from last_error

    async def aclose(self) -> None:
        for provider in self._providers:
            await provider.aclose()


_router: AIRouter | None = None


def get_router() -> AIRouter:
    global _router
    if _router is None:
        from app.ai.providers import build_providers

        _router = AIRouter(build_providers())
    return _router


async def close_router() -> None:
    global _router
    if _router is not None:
        await _router.aclose()
        _router = None
