"""Unit tests for the F6 voice WebSocket bridge.

The real-time audio path is manual-tested (no microphone in CI). These tests
cover the CI-verifiable seams: ADK-event normalization, client framing, the two
bridge pump loops with fakes, and session-close lifecycle.
"""

import asyncio
import json
from types import SimpleNamespace

import pytest

from src.api.endpoints.voice import (
    pump_client_to_session,
    pump_session_to_client,
    run_voice_bridge,
)
from src.voice.session import VoiceSession, encode_for_client, normalize_event


def _audio_event(data: bytes):
    part = SimpleNamespace(inline_data=SimpleNamespace(data=data), text=None)
    return SimpleNamespace(
        interrupted=False,
        content=SimpleNamespace(parts=[part]),
        partial=False,
        turn_complete=False,
    )


def _text_event(text: str, partial: bool):
    part = SimpleNamespace(inline_data=None, text=text)
    return SimpleNamespace(
        interrupted=False,
        content=SimpleNamespace(parts=[part]),
        partial=partial,
        turn_complete=False,
    )


# -- normalize_event ------------------------------------------------------------


def test_normalize_audio_event():
    assert normalize_event(_audio_event(b"pcm")) == {"type": "audio", "data": b"pcm"}


def test_normalize_final_transcript():
    assert normalize_event(_text_event("hello", partial=False)) == {
        "type": "transcript",
        "text": "hello",
        "final": True,
    }


def test_normalize_partial_transcript():
    out = normalize_event(_text_event("hel", partial=True))
    assert out["type"] == "transcript" and out["final"] is False


def test_normalize_interrupted_wins():
    ev = _audio_event(b"pcm")
    ev.interrupted = True
    assert normalize_event(ev) == {"type": "interrupted"}


def test_normalize_turn_complete():
    ev = SimpleNamespace(
        interrupted=False, content=None, partial=False, turn_complete=True
    )
    assert normalize_event(ev) == {"type": "turn_complete"}


def test_normalize_skips_empty():
    ev = SimpleNamespace(
        interrupted=False, content=None, partial=False, turn_complete=False
    )
    assert normalize_event(ev) is None


# -- encode_for_client ----------------------------------------------------------


def test_encode_audio_is_binary():
    assert encode_for_client({"type": "audio", "data": b"x"}) == {"binary": b"x"}


def test_encode_transcript_is_text():
    norm = {"type": "transcript", "text": "hi", "final": True}
    assert encode_for_client(norm) == {"text": norm}


# -- pump_client_to_session -----------------------------------------------------


class _FakeIncomingWS:
    def __init__(self, messages):
        self._messages = list(messages)

    async def receive(self):
        return self._messages.pop(0)


class _RecordingSession:
    def __init__(self):
        self.audio = []
        self.texts = []

    def send_audio(self, data):
        self.audio.append(data)

    def send_text(self, text):
        self.texts.append(text)


async def test_pump_client_forwards_audio_and_text_then_stops():
    ws = _FakeIncomingWS(
        [
            {"type": "websocket.receive", "bytes": b"frame1"},
            {
                "type": "websocket.receive",
                "text": json.dumps({"type": "text", "text": "hi"}),
            },
            {"type": "websocket.receive", "bytes": b"frame2"},
            {"type": "websocket.disconnect"},
        ]
    )
    session = _RecordingSession()
    await pump_client_to_session(ws, session)
    assert session.audio == [b"frame1", b"frame2"]
    assert session.texts == ["hi"]


# -- pump_session_to_client -----------------------------------------------------


class _ScriptedSession:
    def __init__(self, events):
        self._events = events

    async def events(self):
        for ev in self._events:
            yield ev


class _RecordingWS:
    def __init__(self):
        self.binary = []
        self.text = []

    async def send_bytes(self, data):
        self.binary.append(data)

    async def send_text(self, text):
        self.text.append(text)


async def test_pump_session_frames_audio_and_control():
    session = _ScriptedSession(
        [
            {"type": "audio", "data": b"abc"},
            {"type": "transcript", "text": "hi", "final": True},
            {"type": "interrupted"},
        ]
    )
    ws = _RecordingWS()
    await pump_session_to_client(ws, session)

    assert ws.binary == [b"abc"]
    assert [json.loads(t)["type"] for t in ws.text] == ["transcript", "interrupted"]


# -- lifecycle ------------------------------------------------------------------


async def test_voice_session_close_is_idempotent(monkeypatch):
    session = VoiceSession()
    calls = []
    monkeypatch.setattr(session._queue, "close", lambda: calls.append(1))
    await session.close()
    await session.close()
    assert calls == [1]


# -- run_voice_bridge teardown --------------------------------------------------


class _OneAudioThenDisconnectWS:
    def __init__(self):
        self._messages = [
            {"type": "websocket.receive", "bytes": b"a"},
            {"type": "websocket.disconnect"},
        ]

    async def receive(self):
        if self._messages:
            return self._messages.pop(0)
        await asyncio.Event().wait()

    async def send_bytes(self, data):
        pass

    async def send_text(self, text):
        pass


class _IdleSession:
    def __init__(self):
        self.audio = []

    def send_audio(self, data):
        self.audio.append(data)

    def send_text(self, text):
        pass

    async def events(self):
        await asyncio.Event().wait()
        yield  # pragma: no cover - never reached


class _BlockingWS:
    async def receive(self):
        await asyncio.Event().wait()

    async def send_bytes(self, data):
        pass

    async def send_text(self, text):
        pass


class _ErrorSession:
    def send_audio(self, data):
        pass

    async def events(self):
        raise RuntimeError("adk stream failed")
        yield  # pragma: no cover - makes this an async generator


async def test_run_voice_bridge_cancels_pending_and_returns():
    # Client disconnects (one task finishes); the session pump is cancelled and
    # awaited, and the bridge returns without raising.
    ws = _OneAudioThenDisconnectWS()
    session = _IdleSession()
    await run_voice_bridge(ws, session)
    assert session.audio == [b"a"]


async def test_run_voice_bridge_propagates_pump_error():
    # An error in a pump must surface (so the handler logs it and sends an error
    # frame) rather than being swallowed by asyncio.wait.
    with pytest.raises(RuntimeError):
        await run_voice_bridge(_BlockingWS(), _ErrorSession())
