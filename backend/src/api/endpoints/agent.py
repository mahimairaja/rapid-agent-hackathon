"""Text-first chat endpoint that drives the recognition agent (F1).

Public for the demo (real authentication and identity proofing are out of scope
per the blueprint). A null ``session_id`` starts a fresh conversation; the
returned id is reused for follow-up turns and dropped to start a new one.
"""

import logging

from fastapi import APIRouter, HTTPException

from src.agent.agent.agent_runner import run_turn
from src.schemas.agent_schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    try:
        session_id, reply = await run_turn(
            payload.session_id,
            payload.message,
            time_zone=payload.time_zone,
        )
    except Exception:
        logger.warning("agent chat turn failed", exc_info=True)
        raise HTTPException(
            status_code=502, detail="The assistant is unavailable right now."
        ) from None
    return ChatResponse(session_id=session_id, reply=reply)
