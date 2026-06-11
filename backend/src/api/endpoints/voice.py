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
    """Forward inbound audio frames (and control frames) to the session."""
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
        elif payload.get("type") == "identify" and payload.get("patient_code"):
            # Deterministic identification for onboarded accounts: no LLM round
            # trip for the verification itself. Success reuses the identity
            # source frame, so the frontend's grounding/hydration pipeline
            # fires unchanged.
            name = await session.identify(payload["patient_code"])
            if name is not None:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "sources",
                            "items": [
                                {
                                    "type": "identity",
                                    "tool": "identify",
                                    "name": name,
                                }
                            ],
                        }
                    )
                )
                # The live model's context predates the state write, so tell it
                # the patient is verified; otherwise it still asks who they are.
                # On the first session the reply doubles as a personal greeting;
                # on a reconnect the patient already has a running transcript,
                # so a fresh greeting would read as a non sequitur.
                if payload.get("reconnect"):
                    session.send_text(
                        f"[system note, not spoken by the patient] {name} has "
                        "just been re-verified automatically after a brief "
                        "reconnect; their discharge plan is available through "
                        "your tools. The conversation is already in progress: "
                        "do not greet them, do not introduce yourself, and do "
                        "not mention the reconnect or their plan being loaded. "
                        "Stay silent until they say something. Never ask them "
                        "to identify themselves."
                    )
                else:
                    session.send_text(
                        f"[system note, not spoken by the patient] {name} has just "
                        "been verified automatically through their saved patient "
                        "code; their discharge plan is available through your "
                        f"tools. Greet {name} by name in one short sentence and "
                        "offer to help. Never ask them to identify themselves."
                    )
            else:
                await websocket.send_text(json.dumps({"type": "identify_failed"}))


async def pump_session_to_client(websocket: WebSocket, session: VoiceSession) -> None:
    """Forward live session events to the client in the framed protocol."""
    async for norm in session.events():
        frame = encode_for_client(norm)
        if "binary" in frame:
            await websocket.send_bytes(frame["binary"])
        else:
            await websocket.send_text(json.dumps(frame["text"]))


async def run_voice_bridge(websocket: WebSocket, session: VoiceSession) -> None:
    """Run both pump loops; when one finishes, cancel and await the other.

    ``asyncio.wait`` does not re-raise a finished task's exception, so the done
    task is inspected and any error is re-raised to the caller (which logs it and
    sends an error frame). The losing task is cancelled AND awaited so its
    cleanup runs before the session is torn down.
    """
    tasks = {
        asyncio.create_task(pump_client_to_session(websocket, session)),
        asyncio.create_task(pump_session_to_client(websocket, session)),
    }
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for task in pending:
        task.cancel()
    if pending:
        await asyncio.gather(*pending, return_exceptions=True)
    for task in done:
        if task.cancelled():
            continue
        exc = task.exception()
        if exc is not None:
            raise exc


@router.websocket("/ws")
async def voice_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    session = VoiceSession()
    try:
        await session.start()
        # First frame: tell the client which live session this is, so it can
        # query the grounding context (/agent/session/{id}/context) for it.
        await websocket.send_text(
            json.dumps({"type": "session", "session_id": session.session_id})
        )
        await run_voice_bridge(websocket, session)
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
