"""MongoDB Atlas connection lifecycle.

Connection is lazy and failure is non-fatal: if Atlas is unreachable the app
logs it and continues on the in-memory repository. Losing persistence should
degrade the product, never take it down mid-interview.
"""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import redact_secrets

logger = get_logger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect() -> AsyncIOMotorDatabase | None:
    global _client, _db

    if not settings.persistence_enabled:
        logger.info("mongo_disabled_using_memory_store")
        return None

    try:
        _client = AsyncIOMotorClient(
            settings.resolved_mongodb_uri,
            serverSelectionTimeoutMS=settings.mongo_timeout_ms,
            connectTimeoutMS=settings.mongo_timeout_ms,
            retryWrites=True,
            appname=settings.app_name,
        )
        await _client.admin.command("ping")
        _db = _client[settings.mongodb_db]
        await _ensure_indexes(_db)
        logger.info("mongo_connected", extra={"db": settings.mongodb_db})
        return _db
    except Exception as exc:  # noqa: BLE001 - degradation is the point
        logger.warning(
            "mongo_connect_failed_falling_back_to_memory",
            extra={"error": redact_secrets(str(exc))},
        )
        _client, _db = None, None
        return None


async def _ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Indexes chosen from the actual read paths, not speculatively.

    - sessions by id: every turn does this lookup.
    - sessions by candidate + recency: the dashboard's history list.
    - messages by session + turn: transcript replay in order.
    - reports by candidate + recency: dashboard analytics and trend charts.
    """
    await db.interview_sessions.create_index("session_id", unique=True)
    await db.interview_sessions.create_index([("candidate_id", 1), ("created_at", -1)])
    await db.messages.create_index([("session_id", 1), ("turn_index", 1)])
    await db.feedback_reports.create_index("session_id", unique=True)
    await db.feedback_reports.create_index([("candidate_id", 1), ("generated_at", -1)])
    await db.analytics.create_index([("candidate_id", 1), ("date", -1)])
    await db.prompt_versions.create_index([("name", 1), ("version", -1)])
    await db.system_logs.create_index([("created_at", -1)])
    await db.candidate_profiles.create_index("candidate_id", unique=True)
    await db.curriculum.create_index("day", unique=True)


async def disconnect() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
        logger.info("mongo_disconnected")
    _client, _db = None, None


def get_db() -> AsyncIOMotorDatabase | None:
    return _db
