"""Repositories.

One interface, two implementations. Callers never learn which one they hold --
that is the whole point, and it is what lets the product run with zero
configuration while still being genuinely production-shaped.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.logging import get_logger
from app.domain.models import FeedbackReport, InterviewSession, utcnow

logger = get_logger(__name__)


class SessionRepository(ABC):
    @abstractmethod
    async def save(self, session: InterviewSession) -> None: ...

    @abstractmethod
    async def get(self, session_id: str) -> InterviewSession | None: ...

    @abstractmethod
    async def list_for_candidate(self, candidate_id: str, limit: int = 20) -> list[InterviewSession]: ...

    @abstractmethod
    async def delete(self, session_id: str) -> bool: ...


class ReportRepository(ABC):
    @abstractmethod
    async def save(self, report: FeedbackReport) -> None: ...

    @abstractmethod
    async def get(self, session_id: str) -> FeedbackReport | None: ...

    @abstractmethod
    async def list_for_candidate(self, candidate_id: str, limit: int = 20) -> list[FeedbackReport]: ...


# ---------------------------------------------------------------------------
# In-memory
# ---------------------------------------------------------------------------

class InMemorySessionRepository(SessionRepository):
    """Process-local store with TTL eviction.

    The TTL matters: without it a long-running demo instance leaks every
    abandoned session forever. 12 hours is generous for a 20-minute interview
    while still bounding memory.
    """

    TTL = timedelta(hours=12)
    MAX_SESSIONS = 5000

    def __init__(self) -> None:
        self._store: dict[str, InterviewSession] = {}

    def _evict(self) -> None:
        cutoff = utcnow() - self.TTL
        stale = [k for k, v in self._store.items() if _aware(v.updated_at) < cutoff]
        for k in stale:
            self._store.pop(k, None)

        if len(self._store) > self.MAX_SESSIONS:
            ordered = sorted(self._store.items(), key=lambda kv: _aware(kv[1].updated_at))
            for k, _ in ordered[: len(self._store) - self.MAX_SESSIONS]:
                self._store.pop(k, None)

    async def save(self, session: InterviewSession) -> None:
        session.updated_at = utcnow()
        # Deep copy on write so a caller mutating its handle cannot corrupt
        # stored state -- this mirrors what the Mongo implementation does for
        # free, and keeps behaviour identical across the two backends.
        self._store[session.session_id] = session.model_copy(deep=True)
        self._evict()

    async def get(self, session_id: str) -> InterviewSession | None:
        found = self._store.get(session_id)
        return found.model_copy(deep=True) if found else None

    async def list_for_candidate(self, candidate_id: str, limit: int = 20) -> list[InterviewSession]:
        matches = [s for s in self._store.values() if s.candidate.id == candidate_id]
        matches.sort(key=lambda s: _aware(s.created_at), reverse=True)
        return [s.model_copy(deep=True) for s in matches[:limit]]

    async def delete(self, session_id: str) -> bool:
        return self._store.pop(session_id, None) is not None


class InMemoryReportRepository(ReportRepository):
    def __init__(self) -> None:
        self._store: dict[str, FeedbackReport] = {}

    async def save(self, report: FeedbackReport) -> None:
        self._store[report.session_id] = report.model_copy(deep=True)

    async def get(self, session_id: str) -> FeedbackReport | None:
        found = self._store.get(session_id)
        return found.model_copy(deep=True) if found else None

    async def list_for_candidate(self, candidate_id: str, limit: int = 20) -> list[FeedbackReport]:
        matches = [r for r in self._store.values() if r.candidate_id == candidate_id]
        matches.sort(key=lambda r: _aware(r.generated_at), reverse=True)
        return [r.model_copy(deep=True) for r in matches[:limit]]


# ---------------------------------------------------------------------------
# MongoDB
# ---------------------------------------------------------------------------

class MongoSessionRepository(SessionRepository):
    def __init__(self, db: Any) -> None:
        self._c = db.interview_sessions

    async def save(self, session: InterviewSession) -> None:
        session.updated_at = utcnow()
        doc = session.model_dump(mode="json")
        # Denormalised for the dashboard's candidate-scoped index. Worth the
        # duplication: it turns a collection scan into an index seek.
        doc["candidate_id"] = session.candidate.id
        await self._c.replace_one({"session_id": session.session_id}, doc, upsert=True)

    async def get(self, session_id: str) -> InterviewSession | None:
        doc = await self._c.find_one({"session_id": session_id}, {"_id": 0})
        return InterviewSession.model_validate(doc) if doc else None

    async def list_for_candidate(self, candidate_id: str, limit: int = 20) -> list[InterviewSession]:
        cursor = (
            self._c.find({"candidate_id": candidate_id}, {"_id": 0})
            .sort("created_at", -1)
            .limit(limit)
        )
        return [InterviewSession.model_validate(d) async for d in cursor]

    async def delete(self, session_id: str) -> bool:
        result = await self._c.delete_one({"session_id": session_id})
        return result.deleted_count > 0


class MongoReportRepository(ReportRepository):
    def __init__(self, db: Any) -> None:
        self._c = db.feedback_reports

    async def save(self, report: FeedbackReport) -> None:
        await self._c.replace_one(
            {"session_id": report.session_id},
            report.model_dump(mode="json"),
            upsert=True,
        )

    async def get(self, session_id: str) -> FeedbackReport | None:
        doc = await self._c.find_one({"session_id": session_id}, {"_id": 0})
        return FeedbackReport.model_validate(doc) if doc else None

    async def list_for_candidate(self, candidate_id: str, limit: int = 20) -> list[FeedbackReport]:
        cursor = (
            self._c.find({"candidate_id": candidate_id}, {"_id": 0})
            .sort("generated_at", -1)
            .limit(limit)
        )
        return [FeedbackReport.model_validate(d) async for d in cursor]


# ---------------------------------------------------------------------------
# Wiring
# ---------------------------------------------------------------------------

def _aware(dt: datetime) -> datetime:
    """Mongo round-trips can drop tzinfo; comparisons must not explode."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


class RepositoryBundle:
    def __init__(self, sessions: SessionRepository, reports: ReportRepository, backend: str) -> None:
        self.sessions = sessions
        self.reports = reports
        self.backend = backend


_bundle: RepositoryBundle | None = None


def build_repositories(db: Any | None) -> RepositoryBundle:
    global _bundle
    if db is not None:
        _bundle = RepositoryBundle(
            MongoSessionRepository(db), MongoReportRepository(db), "mongodb"
        )
    else:
        _bundle = RepositoryBundle(
            InMemorySessionRepository(), InMemoryReportRepository(), "memory"
        )
    logger.info("repositories_ready", extra={"backend": _bundle.backend})
    return _bundle


def get_repositories() -> RepositoryBundle:
    global _bundle
    if _bundle is None:
        _bundle = build_repositories(None)
    return _bundle
