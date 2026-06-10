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
from google.adk.events import Event, EventActions
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from src.agent.agent.root_agent import build_recognition_agent
from src.agent.agent.session_state import (
    PATIENT_ID,
    PATIENT_NAME,
    PATIENT_VERIFIED,
    set_verified,
    verified_patient_id,
)
from src.core.config import config

logger = logging.getLogger(__name__)

_APP_NAME = "homeward_voice"
_USER_ID = "patient"
_INPUT_MIME = f"audio/pcm;rate={config.VOICE_INPUT_SAMPLE_RATE}"
# How much of a care-plan chunk to ship in a source chip; the grounding panel
# holds the full chunk text (from the context endpoint) for highlighting.
_SOURCE_SNIPPET_CHARS = 240

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


def source_items_for(name: str, response: Any) -> list[dict]:
    """Map one tool's function-response to grounding source descriptors.

    Pure helper so each tool's mapping can be unit-tested without a model. The
    frontend matches these against the grounding panel: medication by name,
    appointment by kind/start, care-plan by (source_file, chunk_index). An
    ``identity`` item signals the frontend to load the session context.
    """
    if not isinstance(response, dict):
        return []
    status = response.get("status")

    if name == "find_patient":
        if status in {"found", "already_verified"}:
            return [{"type": "identity", "tool": name}]
        return []

    if name == "answer_recovery_question" and status == "ok":
        return [
            {
                "type": "care_plan",
                "source_file": chunk.get("source_file", ""),
                "chunk_index": chunk.get("chunk_index", 0),
                "snippet": (chunk.get("text", "") or "")[:_SOURCE_SNIPPET_CHARS],
                "tool": name,
            }
            for chunk in (response.get("context") or [])
            if chunk.get("text")
        ]

    if name == "get_my_plan" and status == "ok":
        return [{"type": "plan", "tool": name}]

    if name == "get_medications" and status == "ok":
        return [
            {"type": "medication", "name": med.get("name", ""), "tool": name}
            for med in (response.get("medications") or [])
            if med.get("name")
        ]

    if name == "get_next_dose" and status in {"ok", "as_needed"}:
        med_name = response.get("name")
        return (
            [{"type": "medication", "name": med_name, "tool": name}] if med_name else []
        )

    if name in {
        "get_follow_up_booking",
        "list_follow_up_slots",
        "book_follow_up_slot",
        "reschedule_follow_up",
    }:
        booking = response.get("booking") or response.get("current_booking")
        if isinstance(booking, dict) and booking.get("start_iso"):
            return [
                {
                    "type": "appointment",
                    "kind": booking.get("kind", ""),
                    "start_iso": booking.get("start_iso", ""),
                    "tool": name,
                }
            ]
        return []

    if name == "triage_symptom" and status == "red_flag":
        # Only a red-flag triage is a grounding source worth surfacing; a routine
        # check-in carries no rule and must not render as a flagged source.
        return [
            {
                "type": "symptom",
                "rule_id": response.get("rule_id"),
                "status": status,
                "tool": name,
            }
        ]

    return []


def _transcript_frame(transcription: Any, role: str) -> dict | None:
    """Frame an ADK ``types.Transcription`` (text + finished), or None if empty."""
    text = getattr(transcription, "text", None)
    if not text:
        return None
    return {
        "type": "transcript",
        "role": role,
        "text": text,
        "final": bool(getattr(transcription, "finished", False)),
    }


def normalize_event(event: Any) -> dict | None:
    """Map an ADK live event to a small client-facing event, or None to skip.

    Shapes: ``{"type": "audio", "data": bytes}``,
    ``{"type": "sources", "items": [...]}``,
    ``{"type": "transcript", "role": str, "text": str, "final": bool}``,
    ``{"type": "interrupted"}``, ``{"type": "turn_complete"}``.
    """
    if getattr(event, "interrupted", False):
        return {"type": "interrupted"}

    # Native-audio transcripts arrive in dedicated fields (one per event),
    # separate from content.parts: output is the model speaking, input is the
    # patient. This is the reliable user/assistant distinction for the unified
    # transcript.
    out_frame = _transcript_frame(
        getattr(event, "output_transcription", None), "assistant"
    )
    if out_frame is not None:
        return out_frame
    in_frame = _transcript_frame(getattr(event, "input_transcription", None), "user")
    if in_frame is not None:
        return in_frame

    content = getattr(event, "content", None)
    parts = (getattr(content, "parts", None) or []) if content else []
    # Audio is the primary payload: prefer it over any text part in the same
    # event so a multi-part event never drops audio in favor of a transcript.
    for part in parts:
        inline = getattr(part, "inline_data", None)
        if inline is not None and getattr(inline, "data", None):
            return {"type": "audio", "data": inline.data}

    # Tool results carry grounding sources. Function-response parts arrive in
    # their own events (separate from audio/text), so emitting a sources frame
    # here never drops a spoken reply.
    sources: list[dict] = []
    for part in parts:
        fr = getattr(part, "function_response", None)
        if fr is not None:
            sources.extend(
                source_items_for(
                    getattr(fr, "name", "") or "", getattr(fr, "response", None)
                )
            )
    if sources:
        return {"type": "sources", "items": sources}

    for part in parts:
        # Skip the model's private reasoning ("thought") parts so only spoken
        # content reaches the transcript.
        if getattr(part, "thought", False):
            continue
        text = getattr(part, "text", None)
        if text:
            # Model text output (e.g. text-mode); the patient's typed turns are
            # echoed client-side, so any content-part text here is the assistant.
            return {
                "type": "transcript",
                "role": "assistant",
                "text": text,
                "final": not getattr(event, "partial", False),
            }

    if getattr(event, "turn_complete", False):
        return {"type": "turn_complete"}
    return None


async def verified_patient_id_for(session_id: str) -> str | None:
    """The verified patient id for a live voice session, or None.

    Reads the live session service's state (the unified conversation IS the live
    session). Returns None for an unknown, expired, or not-yet-verified session.
    """
    try:
        session = await _session_service.get_session(
            app_name=_APP_NAME, user_id=_USER_ID, session_id=session_id
        )
    except Exception:
        # Fail closed (no data) but surface the error: a real session-store
        # regression must not look like a merely-unverified session.
        logger.warning("session lookup failed for %s", session_id, exc_info=True)
        return None
    if session is None:
        return None
    return verified_patient_id(session.state)


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
        # The session object handed to run_live. The service may store a copy,
        # so deterministic identity writes must update THIS object too (the
        # verification gate reads the live invocation's state, not the store).
        self._session: Any = None
        # Server-minted live session id, set on start(). The bridge sends it to
        # the client so it can query the grounding context for this session.
        self.session_id: str | None = None

    async def start(self) -> "VoiceSession":
        session = await self._service.create_session(
            app_name=_APP_NAME, user_id=_USER_ID, state={}
        )
        self._session = session
        self.session_id = session.id
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

    async def identify(self, patient_code: str) -> str | None:
        """Deterministically verify this session for a patient code.

        Onboarded accounts identify without an LLM round trip: look up the
        patient and write the verified identity into the live session state via
        ``append_event`` (the same pattern the text runner uses for turn
        preferences). The verification gate and every tool only read state, so
        they see the session as verified immediately. Returns the patient's
        name, or None when the code or session is unknown.
        """
        from src.models import Patient  # deferred: queried at call time only

        code = (patient_code or "").strip().upper()
        if not code or not self.session_id:
            return None
        try:
            patient = await Patient.find_one({"patient_code": code})
            if patient is None:
                return None
            session = await self._service.get_session(
                app_name=_APP_NAME, user_id=_USER_ID, session_id=self.session_id
            )
            if session is None:
                return None
            name = f"{patient.first_name} {patient.last_name}".strip()
            # The live invocation reads state from the session object passed to
            # run_live; the service store backs the context endpoint. Both must
            # see the identity, and the store may hold a separate copy.
            if self._session is not None:
                set_verified(
                    self._session.state, patient_id=patient.patient_id, name=name
                )
            await self._service.append_event(
                session,
                Event(
                    author="system",
                    actions=EventActions(
                        state_delta={
                            PATIENT_VERIFIED: True,
                            PATIENT_ID: patient.patient_id,
                            PATIENT_NAME: name,
                        }
                    ),
                ),
            )
            return name
        except Exception:
            logger.warning("deterministic identify failed", exc_info=True)
            return None

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
            # Drop the live session from the in-memory store so it does not leak
            # (and retain the verified patient id/name) for the life of the
            # process. The grounding context is only queried while the socket is
            # open, so deleting on close is safe.
            if self.session_id:
                try:
                    await self._service.delete_session(
                        app_name=_APP_NAME,
                        user_id=_USER_ID,
                        session_id=self.session_id,
                    )
                except Exception:
                    logger.debug(
                        "voice session %s already gone on close",
                        self.session_id,
                        exc_info=True,
                    )
