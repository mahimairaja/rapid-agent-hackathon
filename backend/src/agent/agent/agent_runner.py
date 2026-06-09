"""Process-wide ADK Runner and the text-first ``run_turn`` entry point.

One Runner with a single InMemorySessionService serves the whole process. Each
conversation is one ADK session; identity lives in per-session state and is
discarded with the session.

Two isolation-relevant rules live here:
- Session ids are server-minted. A client-supplied id is reused only if the
  server already issued it; an unknown id never becomes a creation key, so a
  caller cannot pre-create a session under a chosen id.
- Turns on one session are serialized with a per-session lock, so two
  near-simultaneous requests on the same session cannot interleave state writes.
  Distinct sessions proceed in parallel.
"""

import asyncio
import logging

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from src.agent.agent.root_agent import root_agent

logger = logging.getLogger(__name__)

_APP_NAME = "homeward"
# Internal, fixed user id for the ADK session triple. Not part of the public
# chat contract; a real per-patient id can replace it when auth is added.
_USER_ID = "patient"

_session_service = InMemorySessionService()
_runner = Runner(
    agent=root_agent,
    app_name=_APP_NAME,
    session_service=_session_service,
)

_locks: dict[str, asyncio.Lock] = {}
_locks_guard = asyncio.Lock()


async def _lock_for(session_id: str) -> asyncio.Lock:
    async with _locks_guard:
        lock = _locks.get(session_id)
        if lock is None:
            lock = asyncio.Lock()
            _locks[session_id] = lock
        return lock


async def _ensure_session(session_id: str | None) -> str:
    """Reuse an existing server-side session, or mint a fresh one."""
    if session_id:
        existing = await _session_service.get_session(
            app_name=_APP_NAME, user_id=_USER_ID, session_id=session_id
        )
        if existing is not None:
            return existing.id
    session = await _session_service.create_session(
        app_name=_APP_NAME, user_id=_USER_ID, state={}
    )
    return session.id


async def run_turn(session_id: str | None, message: str) -> tuple[str, str]:
    """Run one conversational turn and return ``(session_id, reply_text)``."""
    sid = await _ensure_session(session_id)
    lock = await _lock_for(sid)
    async with lock:
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
