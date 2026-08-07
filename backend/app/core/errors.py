"""Error taxonomy and the single response envelope every failure uses.

A consistent error shape is a UX feature, not a backend nicety: the frontend has
exactly one branch to write, and the candidate always sees a human sentence
instead of a stack trace.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger

logger = get_logger(__name__)


class AppError(Exception):
    """Base class for every error we raise deliberately."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    code: str = "internal_error"
    # What the candidate reads. Never leak internals here.
    public_message: str = "Something went wrong on our side. Please try again."

    def __init__(
        self,
        message: str | None = None,
        *,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.public_message = message or self.public_message
        self.details = details or {}
        super().__init__(self.public_message)


class SessionNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "session_not_found"
    public_message = "We couldn't find that interview session. It may have expired."


class SessionAlreadyCompleteError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "session_complete"
    public_message = "This interview has already been completed."


class CandidateNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "candidate_not_found"
    public_message = "We couldn't find that candidate profile."


class ValidationError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "validation_error"
    public_message = "That request didn't look right."


class UnsafeContentError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "unsafe_content"
    public_message = "That message couldn't be processed. Please rephrase your answer."


class AIProviderError(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "ai_unavailable"
    public_message = "The interviewer is momentarily unavailable. Please retry."


class AllProvidersFailedError(AIProviderError):
    code = "ai_all_providers_failed"


def error_payload(code: str, message: str, details: dict[str, Any] | None = None) -> dict:
    body: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return body


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        # 5xx is our bug; 4xx is an expected outcome. Log accordingly.
        log = logger.error if exc.status_code >= 500 else logger.info
        log("app_error", extra={"code": exc.code, "detail": str(exc)})
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(exc.code, exc.public_message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_payload(
                "validation_error",
                "That request didn't look right.",
                {"fields": jsonable_encoder(exc.errors())[:10]},
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload("http_error", str(exc.detail)),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_exception", extra={"kind": type(exc).__name__})
        return JSONResponse(
            status_code=500,
            content=error_payload(
                "internal_error",
                "Something went wrong on our side. Please try again.",
            ),
        )
