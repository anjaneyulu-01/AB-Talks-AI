"""Test configuration — force the suite offline and hermetic.

Once real API keys landed in `.env`, the suite started calling Groq and Breeth
for real: runtime went from 12s to 211s, results became dependent on network
and quota, and every run cost money.

Tests exist to verify *our* logic. The provider chain and the Breeth client are
integration concerns, verified separately against live endpoints. So this
fixture blanks every credential before `app.core.config` is imported, which
puts the whole suite on the deterministic local strategist and the in-memory
repository.

This must run at import time, before any `app.*` module is loaded — `Settings`
is instantiated at module scope and cached with `lru_cache`, so patching after
the first import would have no effect.
"""

from __future__ import annotations

import os

# Blank every credential the app reads. `MONGO_URI` is included because config
# accepts it as an alias for `MONGODB_URI`.
for _var in (
    "GROQ_API_KEY",
    "XAI_API_KEY",
    "GEMINI_API_KEY",
    "BREETH_API_KEY",
    "MONGODB_URI",
    "MONGO_URI",
):
    os.environ[_var] = ""

# Blanking os.environ is not enough on its own: pydantic-settings reads the
# dotenv file too, and dotenv values win over an empty environment variable.
# Point config at a file that does not exist so only our blanks apply.
os.environ["ABTALKS_ENV_FILE"] = ".env.test-nonexistent"
os.environ["ENVIRONMENT"] = "local"
os.environ["BREETH_ENABLED"] = "false"

import pytest  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _assert_offline():
    """Fail loudly if a credential leaked into the suite.

    A test run that silently starts billing a live API is worse than a failing
    one -- it looks green while costing money and producing non-reproducible
    results.
    """
    from app.core.config import settings

    assert not settings.has_any_llm, (
        "Tests must run offline. A provider key leaked into the test "
        "environment — check tests/conftest.py runs before app imports."
    )
    assert not settings.breeth_configured, "Breeth must be disabled in tests."
    assert not settings.persistence_enabled, "Tests must not touch a real database."
    yield
