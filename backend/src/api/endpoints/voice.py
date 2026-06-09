"""WebSocket voice endpoint for F6.

Bridges a browser audio stream to a Gemini Live session through ADK: inbound
binary frames are PCM16 audio at the input sample rate; outbound frames are
binary audio plus small JSON control/transcript messages. Public for the demo,
matching the chat endpoint (production would authenticate the socket).
"""

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.voice.session import VoiceSession, encode_for_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])


async def pump_client_to_session(websocket: WebSocket, session: VoiceSession) -> None:
    """Forward inbound audio frames (and optional text control) to the session."""
    while True:
        message = await websocket.receive()
        if message.get("type") == "websocket.disconnect":
            return
        data = message.get("bytes")
        if data is not None:
            session.send_audio(data)
            continue
        text = message.get("text")
        if not text:
            continue
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            continue
        if payload.get("type") == "text" and payload.get("text"):
            session.send_text(payload["text"])


async def pump_session_to_client(websocket: WebSocket, session: VoiceSession) -> None:
    """Forward live session events to the client in the framed protocol."""
    async for norm in session.events():
        frame = encode_for_client(norm)
        if "binary" in frame:
            await websocket.send_bytes(frame["binary"])
        else:
            await websocket.send_text(json.dumps(frame["text"]))


@router.websocket("/ws")
async def voice_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    session = VoiceSession()
    try:
        await session.start()
        tasks = {
            asyncio.create_task(pump_client_to_session(websocket, session)),
            asyncio.create_task(pump_session_to_client(websocket, session)),
        }
        _, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
    except WebSocketDisconnect:
        logger.info("voice socket disconnected")
    except Exception:
        logger.warning("voice session error", exc_info=True)
        try:
            await websocket.send_text(json.dumps({"type": "error"}))
        except Exception:
            logger.debug("could not send error frame to client")
    finally:
        await session.close()
