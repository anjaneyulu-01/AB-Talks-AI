"""Structured logging.

Interview sessions are long-lived and multi-provider, so a flat log line is
useless when something goes wrong on turn 9. Every record carries the
`session_id` when one is in scope, which makes a whole interview greppable.
"""

from __future__ import annotations

import contextvars
import json
import logging
import sys
from typing import Any

from app.core.config import settings

# Bound at the start of a request; every log line inside that request inherits it.
session_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "session_id", default=None
)

_RESERVED = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "taskName", "message", "asctime",
}


class ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.session_id = session_id_ctx.get() or "-"
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "session_id": getattr(record, "session_id", "-"),
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_") and key != "session_id":
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class ConsoleFormatter(logging.Formatter):
    """Human-readable, aligned, and quiet about the noise."""

    COLORS = {
        "DEBUG": "\033[38;5;244m",
        "INFO": "\033[38;5;39m",
        "WARNING": "\033[38;5;214m",
        "ERROR": "\033[38;5;203m",
        "CRITICAL": "\033[38;5;199m",
    }
    RESET = "\033[0m"
    DIM = "\033[38;5;240m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        sid = getattr(record, "session_id", "-")
        sid_part = f"{self.DIM}[{sid[:8]}]{self.RESET} " if sid != "-" else ""
        head = f"{color}{record.levelname:<8}{self.RESET}"
        body = record.getMessage()
        extras = {
            k: v for k, v in record.__dict__.items()
            if k not in _RESERVED and not k.startswith("_") and k != "session_id"
        }
        tail = ""
        if extras:
            rendered = " ".join(f"{k}={v}" for k, v in extras.items())
            tail = f" {self.DIM}{rendered}{self.RESET}"
        out = f"{head} {sid_part}{self.DIM}{record.name}{self.RESET} {body}{tail}"
        if record.exc_info:
            out += "\n" + self.formatException(record.exc_info)
        return out


def configure_logging() -> None:
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(settings.log_level)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if settings.log_json else ConsoleFormatter())
    handler.addFilter(ContextFilter())
    root.addHandler(handler)

    # These are chatty and tell us nothing we don't already log ourselves.
    for noisy in ("httpx", "httpcore", "pymongo", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
