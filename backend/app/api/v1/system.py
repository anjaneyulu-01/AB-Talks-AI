"""Health and system endpoints.

`/health` reports the *whole* dependency chain -- which providers are live,
what state each circuit breaker is in, whether persistence is Mongo or memory.
A green tick that hides a tripped breaker is worse than no health check at all.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.ai.prompts import PROMPT_REGISTRY, PROMPT_VERSION
from app.ai.router import get_router
from app.api.schemas import HealthResponse
from app.core.config import settings
from app.data.loader import load_candidates, load_curriculum
from app.db.repositories import get_repositories
from app.memory.breeth import get_breeth

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse, summary="Service health")
async def health() -> HealthResponse:
    ai = get_router()
    return HealthResponse(
        status="ok",
        environment=settings.environment,
        persistence=get_repositories().backend,
        providers=ai.chain,
        breakers=ai.breaker_states(),
        prompt_version=PROMPT_VERSION,
        curriculum_days=len(load_curriculum().days),
        candidates=len(load_candidates()),
        longitudinal_memory="breeth" if settings.breeth_configured else "disabled",
    )


@router.get("/system/memory", summary="Longitudinal memory status")
async def memory_status() -> dict:
    """Breeth connectivity and identity.

    Separate from /health because it makes a live network call. Health must
    stay cheap enough for a 30-second poll.
    """
    if not settings.breeth_configured:
        return {
            "enabled": False,
            "reason": "BREETH_API_KEY not set",
            "impact": "interviews run without prior-interview recall",
        }

    identity = await get_breeth().whoami()
    return {
        "enabled": True,
        "reachable": identity is not None,
        "endpoint": settings.breeth_mcp_url,
        "identity": identity,
    }


@router.get("/system/prompts", summary="Prompt registry versions")
async def prompts() -> dict:
    return {"version": PROMPT_VERSION, "prompts": PROMPT_REGISTRY}


@router.get("/system/ai", summary="AI router statistics")
async def ai_stats() -> dict:
    ai = get_router()
    return {
        "chain": ai.chain,
        "breakers": ai.breaker_states(),
        "calls": ai.stats.calls,
        "failovers": ai.stats.failovers,
        "by_provider": ai.stats.by_provider,
        "last_error": ai.stats.last_error,
    }
