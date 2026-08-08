"""ABTalks Interview Intelligence -- application entrypoint.

Startup order matters and is deliberate:

1. Validate the datasets. If `curriculum.json` is malformed we refuse to boot,
   rather than failing mysteriously on turn 6 of a live interview.
2. Connect Mongo, or fall back to memory. Never fatal.
3. Build the provider chain and log what is actually configured, so a missing
   API key is visible in the first five lines of output instead of being
   discovered by a candidate.
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.ai.router import close_router, get_router
from app.api import spec
from app.api.v1 import candidates, curriculum, interview, system
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.data.loader import warm_caches
from app.db.mongo import connect, disconnect
from app.db.repositories import build_repositories
from app.memory.breeth import close_breeth, get_breeth

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "starting",
        extra={"app": settings.app_name, "env": settings.environment},
    )

    warm_caches()

    db = await connect()
    build_repositories(db)

    ai = get_router()
    if not settings.has_any_llm:
        logger.warning(
            "no_llm_configured_running_offline",
            extra={
                "impact": "interviews will use the deterministic local strategist",
                "fix": "set XAI_API_KEY and/or GEMINI_API_KEY in backend/.env",
            },
        )
    logger.info("ready", extra={"providers": " -> ".join(ai.chain)})

    # Breeth is optional. Confirm the credential up front so a bad key shows
    # in the startup log rather than being discovered as silent no-recall.
    if settings.breeth_configured:
        identity = await get_breeth().whoami()
        if identity:
            logger.info(
                "breeth_connected",
                extra={
                    "team": identity.get("team_name"),
                    "project": identity.get("project_name"),
                    "scopes": identity.get("scopes"),
                },
            )
        else:
            logger.warning(
                "breeth_configured_but_unreachable",
                extra={"impact": "interviews run without prior-interview recall"},
            )
    else:
        logger.info("breeth_disabled", extra={"hint": "set BREETH_API_KEY to enable"})

    yield

    await close_breeth()
    await close_router()
    await disconnect()
    logger.info("stopped")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Evidence-grounded adaptive technical interviewing for the ABTalks AI "
        "Cohort. Interview policy is deterministic; the language model supplies "
        "phrasing and assessment, never control flow."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
# Reports and full session state are the largest payloads; they compress well.
app.add_middleware(GZipMiddleware, minimum_size=1024)

register_exception_handlers(app)


@app.middleware("http")
async def timing(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    response.headers["X-Response-Time-Ms"] = str(elapsed_ms)

    # Only log the slow ones. Logging every request buries the signal.
    if elapsed_ms > 2000:
        logger.info(
            "slow_request",
            extra={
                "path": request.url.path,
                "method": request.method,
                "ms": elapsed_ms,
            },
        )
    return response


# The frozen specification contract.
app.include_router(spec.router, prefix=settings.api_prefix)

# The platform API our frontend drives.
app.include_router(system.router, prefix=f"{settings.api_prefix}/v1")
app.include_router(interview.router, prefix=f"{settings.api_prefix}/v1")
app.include_router(candidates.router, prefix=f"{settings.api_prefix}/v1")
app.include_router(curriculum.router, prefix=f"{settings.api_prefix}/v1")


@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "spec_endpoint": f"{settings.api_prefix}/interview",
        "docs": "/docs",
        "health": f"{settings.api_prefix}/v1/health",
    }


@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict:
    """Liveness probe for uptime monitors (UptimeRobot, Render, etc.).

    Deliberately trivial: it touches no dependency and does no I/O, so it can
    only ever answer 200 while the process is up. The rich dependency report
    lives at ``{api_prefix}/v1/health`` -- that one can legitimately signal a
    degraded provider or a tripped breaker and must not be used for uptime
    pings, or a soft failover would page you at 3am.
    """
    return {"status": "ok"}
