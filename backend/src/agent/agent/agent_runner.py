"""Process-wide ADK Runner and the text-first ``run_turn`` entry point.

One Runner with a single InMemorySessionService serves the whole process. Each
conversation is one ADK session; identity lives in per-session state and is
discarded with the session.

Isolation and footprint rules live here:
- Session ids are server-minted. A client-supplied id is reused only if the
  server already issued it; an unknown id never becomes a creation key, so a
  caller cannot pre-create or bind to a forged session id.
- The session store is LRU-bounded (``_MAX_SESSIONS``): the public endpoint can
  be hit anonymously, so old conversations (and the verified-patient state they
  hold) are evicted instead of accumulating in memory forever.
- Turns on one session are serialized with a per-session lock, so two
  near-simultaneous requests on the same session cannot interleave state writes.
  Distinct sessions proceed in parallel.
"""

import asyncio
import logging
from collections import OrderedDict

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from src.agent.agent.root_agent import root_agent
from src.agent.agent.session_state import set_client_time_zone

logger = logging.getLogger(__name__)

_APP_NAME = "homeward"
# Internal, fixed user id for the ADK session triple. Not part of the public
# chat contract; a real per-patient id can replace it when auth is added.
_USER_ID = "patient"
# Cap on live in-memory sessions so the public endpoint cannot grow unbounded.
_MAX_SESSIONS = 500

_session_service = InMemorySessionService()
_runner = Runner(
    agent=root_agent,
    app_name=_APP_NAME,
    session_service=_session_service,
)

# session_id -> None, ordered by recency (LRU at the front, MRU at the back).
_session_lru: OrderedDict[str, None] = OrderedDict()
_locks: dict[str, asyncio.Lock] = {}
_registry_guard = asyncio.Lock()


async def _evict_session(session_id: str) -> None:
    """Drop a session and its lock. Caller holds ``_registry_guard``."""
    _session_lru.pop(session_id, None)
    _locks.pop(session_id, None)
    try:
        await _session_service.delete_session(
            app_name=_APP_NAME, user_id=_USER_ID, session_id=session_id
        )
    except Exception:
        logger.debug("session %s already gone during eviction", session_id)


async def _touch(session_id: str) -> None:
    """Mark a session most-recently-used, evicting the LRU beyond the cap."""
    async with _registry_guard:
        _session_lru[session_id] = None
        _session_lru.move_to_end(session_id)
        while len(_session_lru) > _MAX_SESSIONS:
            oldest = next(iter(_session_lru))
            await _evict_session(oldest)


async def _lock_for(session_id: str) -> asyncio.Lock:
    async with _registry_guard:
        lock = _locks.get(session_id)
        if lock is None:
            lock = asyncio.Lock()
            _locks[session_id] = lock
        return lock


async def _ensure_session(session_id: str | None) -> str:
    """Reuse an existing server-side session, or mint a fresh one.

    A client-supplied id is reused only if the server already issued it; an
    unknown id is never used as a creation key.
    """
    if session_id:
        existing = await _session_service.get_session(
            app_name=_APP_NAME, user_id=_USER_ID, session_id=session_id
        )
        if existing is not None:
            await _touch(existing.id)
            return existing.id
    session = await _session_service.create_session(
        app_name=_APP_NAME, user_id=_USER_ID, state={}
    )
    await _touch(session.id)
    return session.id


async def _set_turn_preferences(
    session_id: str, *, time_zone: str | None = None
) -> None:
    if not time_zone:
        return
    session = await _session_service.get_session(
        app_name=_APP_NAME, user_id=_USER_ID, session_id=session_id
    )
    if session is not None:
        set_client_time_zone(session.state, time_zone)


async def run_turn(
    session_id: str | None,
    message: str,
    *,
    time_zone: str | None = None,
) -> tuple[str, str]:
    """Run one conversational turn and return ``(session_id, reply_text)``."""
    sid = await _ensure_session(session_id)
    lock = await _lock_for(sid)
    async with lock:
        await _set_turn_preferences(sid, time_zone=time_zone)
        content = types.Content(role="user", parts=[types.Part(text=message)])
        reply_parts: list[str] = []
        async for event in _runner.run_async(
            user_id=_USER_ID, session_id=sid, new_message=content
        ):
            if event.is_final_response() and event.content and event.content.parts:
                for part in event.content.parts:
                    text = getattr(part, "text", None)
                    if text:
                        reply_parts.append(text)
        return sid, "".join(reply_parts).strip()
