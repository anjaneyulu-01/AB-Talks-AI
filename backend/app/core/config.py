"""Application configuration.

Every knob the platform needs is declared here and sourced from the environment.
Nothing else in the codebase reads `os.environ` directly -- that keeps secrets in
one auditable place and makes the app trivially testable.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.environ.get("ABTALKS_ENV_FILE", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---- Application -------------------------------------------------------
    app_name: str = "ABTalks Interview Intelligence"
    environment: Literal["local", "staging", "production"] = "local"
    debug: bool = False
    api_prefix: str = "/api"

    # Comma-separated in the environment, list in code.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ---- Persistence -------------------------------------------------------
    # Left empty the app runs on an in-memory repository with identical
    # semantics. That is a deliberate product decision: `git clone && run`
    # must work with zero configuration, or a reviewer never sees the product.
    #
    # Both `MONGODB_URI` and `MONGO_URI` are accepted -- two plain fields plus
    # an explicit resolver, rather than an AliasChoices validation_alias, which
    # does not resolve against the dotenv source here and fails *silently*.
    # That is the worst possible failure mode for a connection string: the app
    # boots fine and quietly persists nothing. `MONGODB_URI` wins if both set.
    mongodb_uri: str = ""
    mongo_uri: str = ""
    mongodb_db: str = "abtalks_interview"
    # 15s, not 5s. A free-tier Atlas cluster that has gone idle needs to spin
    # up, and SRV resolution across three shard hosts adds more. At 5s the app
    # silently fell back to in-memory on a cluster that was perfectly healthy
    # ten seconds later -- persistence appearing to "work sometimes" is a much
    # worse bug than a slightly slower boot.
    mongo_timeout_ms: int = 15000

    # ---- AI providers ------------------------------------------------------
    # Chain: Groq -> Gemini 2.5 Flash -> deterministic local strategist.
    #
    # Note on naming, because it bites everyone: **Groq** (fast inference host,
    # OpenAI-compatible, `gsk_...` keys) is a different company from **Grok**
    # (xAI's model, `xai-...` keys). The cohort curriculum teaches Groq on
    # Day 11, so Groq leads the chain. xAI stays supported for whoever has a
    # key -- both speak the same OpenAI-compatible wire format.
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "openai/gpt-oss-120b"

    xai_api_key: str = ""
    xai_base_url: str = "https://api.x.ai/v1"
    xai_model: str = "grok-4-fast-reasoning"

    gemini_api_key: str = ""
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_model: str = "gemini-2.5-flash"

    ai_request_timeout_s: float = 45.0
    ai_max_attempts: int = 3
    ai_circuit_fail_threshold: int = 3
    ai_circuit_reset_s: float = 60.0

    # Reasoning models (gpt-oss, o-series, grok-*-reasoning) spend output
    # tokens thinking before they emit anything. With a tight cap they hit the
    # ceiling mid-thought and JSON mode fails outright -- Groq returns
    # `json_validate_failed`, not a partial object. Measured: gpt-oss-120b used
    # 304 completion tokens for an evaluation that llama-3.3-70b did in 108.
    # This budget is generous on purpose; unused tokens cost nothing.
    ai_eval_max_tokens: int = 2000
    ai_question_max_tokens: int = 900
    ai_report_max_tokens: int = 2600

    # ---- Breeth MCP (optional) ---------------------------------------------
    # Longitudinal cross-interview memory. Entirely optional: unset, the
    # platform behaves exactly as it does today, minus prior-interview recall.
    breeth_api_key: str = ""
    breeth_mcp_url: str = "https://mcp.thebreeth.com/mcp"
    breeth_timeout_s: float = 12.0
    breeth_enabled: bool = True

    # ---- Interview policy --------------------------------------------------
    # Tuned for a ~20 minute session: long enough to show real adaptation,
    # short enough that a candidate finishes in one sitting.
    interview_min_turns: int = 8
    interview_max_turns: int = 14
    interview_answer_max_chars: int = 8000

    # ---- Observability -----------------------------------------------------
    log_level: str = "INFO"
    log_json: bool = False

    @field_validator("log_level")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()

    @property
    def resolved_mongodb_uri(self) -> str:
        """The connection string, from either accepted spelling."""
        return (self.mongodb_uri or self.mongo_uri).strip()

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return origins or ["*"]

    @property
    def persistence_enabled(self) -> bool:
        return bool(self.resolved_mongodb_uri)

    @property
    def has_any_llm(self) -> bool:
        return bool(
            self.groq_api_key.strip()
            or self.xai_api_key.strip()
            or self.gemini_api_key.strip()
        )

    @property
    def breeth_configured(self) -> bool:
        return self.breeth_enabled and bool(self.breeth_api_key.strip())


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
