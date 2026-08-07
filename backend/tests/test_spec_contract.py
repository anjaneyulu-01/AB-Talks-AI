"""The test that matters most: the frozen specification contract.

Drives a complete interview through `POST /api/interview` exactly as a grading
harness would, and asserts the response shape at every phase. Runs offline via
the local strategist, so it needs no API keys and no network.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

CANDIDATES = json.loads(
    (Path(__file__).parents[1] / "app" / "data" / "candidates.json").read_text(encoding="utf-8")
)["candidates"]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _answer(turn: int) -> str:
    """A plausible mid-quality answer, so the interview neither stalls nor aces."""
    return (
        f"For this I'd start by framing the problem clearly. In the cohort I used "
        f"embeddings with a Chroma vector store, chunking documents at around 500 "
        f"tokens with overlap because retrieval quality degraded without it. "
        f"The main trade-off was latency versus recall — a larger top-k improved "
        f"grounding but cost about 200ms per query, so I settled on k=5. "
        f"If it needed to scale further I'd add a metadata pre-filter before the "
        f"vector search. (turn {turn})"
    )


def test_full_interview_matches_spec_contract(client):
    session_id = f"test-{uuid.uuid4()}"
    candidate = CANDIDATES[2]  # Emily Chen -- 31/31 first try, the hardest calibration

    # --- Phase 1: start ---------------------------------------------------
    response = client.post(
        "/api/interview", json={"sessionId": session_id, "candidate": candidate}
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert set(body.keys()) == {"reply", "done"}, "start response must be exactly {reply, done}"
    assert isinstance(body["reply"], str) and body["reply"].strip()
    assert body["done"] is False

    # --- Phase 2: conversation turns --------------------------------------
    done = False
    turns = 0
    final = body

    while not done and turns < 25:
        turns += 1
        response = client.post(
            "/api/interview", json={"sessionId": session_id, "message": _answer(turns)}
        )
        assert response.status_code == 200, response.text
        final = response.json()

        assert isinstance(final["reply"], str) and final["reply"].strip()
        assert isinstance(final["done"], bool)
        done = final["done"]

        if not done:
            assert "feedback" not in final, "feedback must only appear on the final turn"

    # --- Phase 3: completion ----------------------------------------------
    assert done, f"interview did not complete within {turns} turns"
    assert "feedback" in final, "final response must include feedback"

    feedback = final["feedback"]
    assert set(feedback.keys()) == {"summary", "strengths", "gaps", "next"}

    assert isinstance(feedback["summary"], str) and feedback["summary"].strip()
    for key in ("strengths", "gaps", "next"):
        assert isinstance(feedback[key], list), f"{key} must be a list"
        assert feedback[key], f"{key} must not be empty"
        assert all(isinstance(item, str) and item.strip() for item in feedback[key])


def test_session_state_persists_across_requests(client):
    """The spec's core requirement: state is maintained via sessionId."""
    session_id = f"test-{uuid.uuid4()}"
    client.post("/api/interview", json={"sessionId": session_id, "candidate": CANDIDATES[0]})

    state = client.get(f"/api/v1/interviews/{session_id}").json()
    assert state["live"]["turn"] == 1

    client.post("/api/interview", json={"sessionId": session_id, "message": _answer(1)})

    state = client.get(f"/api/v1/interviews/{session_id}").json()
    assert state["live"]["answered"] == 1
    assert len(state["messages"]) >= 3  # greeting+q, answer, next q


def test_unknown_session_is_rejected(client):
    response = client.post(
        "/api/interview", json={"sessionId": "does-not-exist", "message": "hello"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_start_is_idempotent(client):
    """A retried start must replay, not wipe an interview in progress."""
    session_id = f"test-{uuid.uuid4()}"
    first = client.post(
        "/api/interview", json={"sessionId": session_id, "candidate": CANDIDATES[1]}
    ).json()
    second = client.post(
        "/api/interview", json={"sessionId": session_id, "candidate": CANDIDATES[1]}
    ).json()
    assert first["reply"] == second["reply"]


def test_empty_message_is_rejected(client):
    session_id = f"test-{uuid.uuid4()}"
    client.post("/api/interview", json={"sessionId": session_id, "candidate": CANDIDATES[0]})
    response = client.post("/api/interview", json={"sessionId": session_id, "message": "   "})
    assert response.status_code == 422
