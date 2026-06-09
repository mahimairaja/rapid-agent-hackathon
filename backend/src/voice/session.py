"""Gemini Live voice session for F6, driven through ADK bidirectional streaming.

Voice is a delivery surface over the existing agent: ``build_recognition_agent``
is reused with the Live audio model (config.GEMINI_LIVE_MODEL), so every F1-F5
tool, the verification gate, and the prompts apply unchanged. The patient
identifies by voice exactly as they would by text.

The ADK/Live event shapes are isolated in two pure helpers, ``normalize_event``
and ``encode_for_client``, so the WebSocket bridge and its framing can be
unit-tested without a model, audio, or a network. The live audio path itself is
manual-tested (no microphone in CI).
"""

import logging
from typing import Any

from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from src.agent.agent.root_agent import build_recognition_agent
from src.core.config import config

logger = logging.getLogger(__name__)

_APP_NAME = "homeward_voice"
_USER_ID = "patient"
_INPUT_MIME = f"audio/pcm;rate={config.VOICE_INPUT_SAMPLE_RATE}"

# The voice agent is the same agent (tools, gate, prompts) on the Live model, so
# voice inherits every feature. Built once; run_live opens a session per call.
_voice_agent = build_recognition_agent(model=config.GEMINI_LIVE_MODEL)
_session_service = InMemorySessionService()
_runner = Runner(
    agent=_voice_agent, app_name=_APP_NAME, session_service=_session_service
)


def _run_config() -> RunConfig:
    """Bidirectional audio with transcription when the SDK supports it."""
    kwargs: dict[str, Any] = {
        "response_modalities": ["AUDIO"],
        "streaming_mode": StreamingMode.BIDI,
    }
    transcription = getattr(types, "AudioTranscriptionConfig", None)
    if transcription is not None:
        # Surface spoken text for the live transcript display.
        kwargs["output_audio_transcription"] = transcription()
        kwargs["input_audio_transcription"] = transcription()
    return RunConfig(**kwargs)


def normalize_event(event: Any) -> dict | None:
    """Map an ADK live event to a small client-facing event, or None to skip.

    Shapes: ``{"type": "audio", "data": bytes}``,
    ``{"type": "transcript", "text": str, "final": bool}``,
    ``{"type": "interrupted"}``, ``{"type": "turn_complete"}``.
    """
    if getattr(event, "interrupted", False):
        return {"type": "interrupted"}

    content = getattr(event, "content", None)
    parts = getattr(content, "parts", None) or [] if content else []
    for part in parts:
        inline = getattr(part, "inline_data", None)
        if inline is not None and getattr(inline, "data", None):
            return {"type": "audio", "data": inline.data}
        text = getattr(part, "text", None)
        if text:
            return {
                "type": "transcript",
                "text": text,
                "final": not getattr(event, "partial", False),
            }

    if getattr(event, "turn_complete", False):
        return {"type": "turn_complete"}
    return None


def encode_for_client(norm: dict) -> dict:
    """Frame a normalized event for the WebSocket.

    Returns ``{"binary": bytes}`` for audio (sent as a binary frame) or
    ``{"text": dict}`` for everything else (sent as a JSON text frame).
    """
    if norm.get("type") == "audio":
        return {"binary": norm["data"]}
    return {"text": norm}


class VoiceSession:
    """Owns one ADK live session and its request queue for a single socket."""

    def __init__(self, runner: Runner | None = None, session_service: Any = None):
        self._runner = runner or _runner
        self._service = session_service or _session_service
        self._queue = LiveRequestQueue()
        self._live: Any = None
        self._closed = False

    async def start(self) -> "VoiceSession":
        session = await self._service.create_session(
            app_name=_APP_NAME, user_id=_USER_ID, state={}
        )
        self._live = self._runner.run_live(
            session=session,
            live_request_queue=self._queue,
            run_config=_run_config(),
        )
        return self

    def send_audio(self, pcm: bytes) -> None:
        """Forward a chunk of inbound PCM16 (input sample rate) to the model."""
        self._queue.send_realtime(types.Blob(data=pcm, mime_type=_INPUT_MIME))

    def send_text(self, text: str) -> None:
        self._queue.send_content(
            types.Content(role="user", parts=[types.Part(text=text)])
        )

    async def events(self):
        """Yield normalized client-facing events from the live session."""
        async for event in self._live:
            norm = normalize_event(event)
            if norm is not None:
                yield norm

    async def close(self) -> None:
        if not self._closed:
            self._closed = True
            self._queue.close()
