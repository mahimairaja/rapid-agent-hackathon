"""Unit tests for the session-minting / LRU boundary in agent_runner.

DB-free and Gemini-free: these exercise the InMemorySessionService logic only.
They guard the isolation boundary (an unknown client id must never become a
creation key) and the unbounded-growth fix (LRU eviction).
"""

import pytest
from google.adk.sessions import InMemorySessionService

from src.agent.agent import agent_runner as ar


@pytest.fixture(autouse=True)
def _fresh_registry(monkeypatch):
    monkeypatch.setattr(ar, "_session_service", InMemorySessionService())
    ar._session_lru.clear()
    ar._locks.clear()
    yield
    ar._session_lru.clear()
    ar._locks.clear()


async def _get(session_id):
    return await ar._session_service.get_session(
        app_name=ar._APP_NAME, user_id=ar._USER_ID, session_id=session_id
    )


async def test_none_mints_a_new_session():
    sid = await ar._ensure_session(None)
    assert sid
    assert await _get(sid) is not None


async def test_known_id_is_reused():
    sid = await ar._ensure_session(None)
    assert await ar._ensure_session(sid) == sid


async def test_forged_id_is_never_a_creation_key():
    forged = "forged-id-never-issued"
    sid = await ar._ensure_session(forged)
    assert sid != forged
    # The forged id itself was never created as a session.
    assert await _get(forged) is None


async def test_lock_is_stable_per_session():
    a1 = await ar._lock_for("s1")
    a2 = await ar._lock_for("s1")
    b = await ar._lock_for("s2")
    assert a1 is a2
    assert b is not a1


async def test_lru_eviction_bounds_session_count(monkeypatch):
    monkeypatch.setattr(ar, "_MAX_SESSIONS", 3)
    ids = [await ar._ensure_session(None) for _ in range(5)]
    assert len(ar._session_lru) == 3
    for evicted in ids[:2]:
        assert await _get(evicted) is None
    for kept in ids[2:]:
        assert kept in ar._session_lru
        assert await _get(kept) is not None
