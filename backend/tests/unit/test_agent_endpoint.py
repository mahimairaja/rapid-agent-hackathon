"""Unit tests for the /agent/chat endpoint contract (no DB, no Gemini)."""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.api.endpoints import agent as agent_module


@pytest.fixture
def chat_app(monkeypatch):
    async def fake_run_turn(session_id, message, *, time_zone=None):
        suffix = f":{time_zone}" if time_zone else ""
        return "sess-123", f"echo:{message}{suffix}"

    monkeypatch.setattr(agent_module, "run_turn", fake_run_turn)
    app = FastAPI()
    app.include_router(agent_module.router, prefix="/api/v1")
    return app


async def _post(app, body):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post("/api/v1/agent/chat", json=body)


async def test_chat_returns_reply_and_session(chat_app):
    resp = await _post(app=chat_app, body={"message": "hi"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"] == "sess-123"
    assert body["reply"] == "echo:hi"


async def test_chat_accepts_time_zone(chat_app):
    resp = await _post(chat_app, {"message": "hi", "time_zone": "America/Toronto"})
    assert resp.status_code == 200
    assert resp.json()["reply"] == "echo:hi:America/Toronto"


async def test_chat_returns_502_on_error(chat_app, monkeypatch):
    async def boom(session_id, message, *, time_zone=None):
        raise RuntimeError("agent down")

    monkeypatch.setattr(agent_module, "run_turn", boom)
    resp = await _post(chat_app, {"message": "hi"})
    assert resp.status_code == 502


async def test_chat_rejects_empty_message(chat_app):
    resp = await _post(chat_app, {"message": ""})
    assert resp.status_code == 422
