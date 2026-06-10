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
from src.voice.session import (
    VoiceSession,
    encode_for_client,
    normalize_event,
    source_items_for,
)


def _audio_event(data: bytes):
    part = SimpleNamespace(inline_data=SimpleNamespace(data=data), text=None)
    return SimpleNamespace(
        interrupted=False,
        content=SimpleNamespace(parts=[part]),
        partial=False,
        turn_complete=False,
    )


def _text_event(text: str, partial: bool, thought: bool = False):
    part = SimpleNamespace(inline_data=None, text=text, thought=thought)
    return SimpleNamespace(
        interrupted=False,
        content=SimpleNamespace(parts=[part]),
        partial=partial,
        turn_complete=False,
    )


def _function_response_event(name: str, response):
    fr = SimpleNamespace(name=name, response=response)
    part = SimpleNamespace(inline_data=None, text=None, function_response=fr)
    return SimpleNamespace(
        interrupted=False,
        content=SimpleNamespace(parts=[part]),
        partial=False,
        turn_complete=False,
    )


def _transcription_event(*, output=None, input=None):
    def _tr(value):
        if value is None:
            return None
        text, finished = value
        return SimpleNamespace(text=text, finished=finished)

    return SimpleNamespace(
        interrupted=False,
        output_transcription=_tr(output),
        input_transcription=_tr(input),
        content=None,
        partial=False,
        turn_complete=False,
    )


# -- normalize_event ------------------------------------------------------------


def test_normalize_audio_event():
    assert normalize_event(_audio_event(b"pcm")) == {"type": "audio", "data": b"pcm"}


def test_normalize_text_part_is_assistant_transcript():
    assert normalize_event(_text_event("hello", partial=False)) == {
        "type": "transcript",
        "role": "assistant",
        "text": "hello",
        "final": True,
    }


def test_normalize_partial_transcript():
    out = normalize_event(_text_event("hel", partial=True))
    assert out["type"] == "transcript" and out["final"] is False


def test_normalize_output_transcription_is_assistant():
    assert normalize_event(_transcription_event(output=("the answer", True))) == {
        "type": "transcript",
        "role": "assistant",
        "text": "the answer",
        "final": True,
    }


def test_normalize_input_transcription_is_user():
    assert normalize_event(_transcription_event(input=("my name is", False))) == {
        "type": "transcript",
        "role": "user",
        "text": "my name is",
        "final": False,
    }


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


def test_normalize_skips_thought_text():
    # The model's private reasoning must not reach the transcript.
    assert (
        normalize_event(_text_event("thinking...", partial=False, thought=True)) is None
    )


# -- source_items_for (per-tool grounding mapping) ------------------------------


def test_sources_find_patient_signals_identity():
    assert source_items_for("find_patient", {"status": "found"}) == [
        {"type": "identity", "tool": "find_patient"}
    ]
    assert source_items_for("find_patient", {"status": "not_found"}) == []


def test_sources_recovery_question_maps_each_chunk():
    response = {
        "status": "ok",
        "context": [
            {"text": "Walk daily.", "source_file": "plan.md", "chunk_index": 2},
            {"text": "", "source_file": "plan.md", "chunk_index": 3},
        ],
    }
    items = source_items_for("answer_recovery_question", response)
    assert items == [
        {
            "type": "care_plan",
            "source_file": "plan.md",
            "chunk_index": 2,
            "snippet": "Walk daily.",
            "tool": "answer_recovery_question",
        }
    ]


def test_sources_get_medications_lists_named_meds():
    response = {"status": "ok", "medications": [{"name": "Aspirin"}, {"name": ""}]}
    items = source_items_for("get_medications", response)
    assert items == [
        {"type": "medication", "name": "Aspirin", "tool": "get_medications"}
    ]


def test_sources_get_next_dose_maps_medication():
    assert source_items_for("get_next_dose", {"status": "ok", "name": "Lasix"}) == [
        {"type": "medication", "name": "Lasix", "tool": "get_next_dose"}
    ]
    assert source_items_for("get_next_dose", {"status": "not_found"}) == []


def test_sources_plan_and_appointment_and_symptom():
    assert source_items_for("get_my_plan", {"status": "ok"}) == [
        {"type": "plan", "tool": "get_my_plan"}
    ]
    booking = {
        "status": "ok",
        "booking": {"kind": "Follow-up", "start_iso": "2026-06-20T15:00:00Z"},
    }
    assert source_items_for("get_follow_up_booking", booking) == [
        {
            "type": "appointment",
            "kind": "Follow-up",
            "start_iso": "2026-06-20T15:00:00Z",
            "tool": "get_follow_up_booking",
        }
    ]
    symptom = {"status": "red_flag", "rule_id": "chest_pain"}
    assert source_items_for("triage_symptom", symptom) == [
        {
            "type": "symptom",
            "rule_id": "chest_pain",
            "status": "red_flag",
            "tool": "triage_symptom",
        }
    ]


def test_sources_routine_symptom_is_not_a_source():
    # A routine check-in has no rule and must not render as a flagged source.
    assert source_items_for("triage_symptom", {"status": "routine"}) == []


def test_sources_ignores_non_dict_response():
    assert source_items_for("find_patient", None) == []
    assert source_items_for("unknown_tool", {"status": "ok"}) == []


def test_normalize_emits_sources_frame():
    ev = _function_response_event(
        "get_medications", {"status": "ok", "medications": [{"name": "Aspirin"}]}
    )
    assert normalize_event(ev) == {
        "type": "sources",
        "items": [{"type": "medication", "name": "Aspirin", "tool": "get_medications"}],
    }


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


class _IdentifyWS(_FakeIncomingWS):
    def __init__(self, messages):
        super().__init__(messages)
        self.sent = []

    async def send_text(self, text):
        self.sent.append(json.loads(text))


class _IdentifySession(_RecordingSession):
    def __init__(self, name):
        super().__init__()
        self.name = name
        self.codes = []

    async def identify(self, patient_code):
        self.codes.append(patient_code)
        return self.name


async def test_pump_client_identify_success_emits_identity_source():
    ws = _IdentifyWS(
        [
            {
                "type": "websocket.receive",
                "text": json.dumps({"type": "identify", "patient_code": "HW-7K3F"}),
            },
            {"type": "websocket.disconnect"},
        ]
    )
    session = _IdentifySession(name="Asha Rao")
    await pump_client_to_session(ws, session)
    assert session.codes == ["HW-7K3F"]
    assert ws.sent == [
        {
            "type": "sources",
            "items": [{"type": "identity", "tool": "identify", "name": "Asha Rao"}],
        }
    ]


async def test_pump_client_identify_failure_emits_identify_failed():
    ws = _IdentifyWS(
        [
            {
                "type": "websocket.receive",
                "text": json.dumps({"type": "identify", "patient_code": "HW-NOPE"}),
            },
            {"type": "websocket.disconnect"},
        ]
    )
    session = _IdentifySession(name=None)
    await pump_client_to_session(ws, session)
    assert ws.sent == [{"type": "identify_failed"}]


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


async def test_voice_session_identify_writes_state_delta(monkeypatch):
    from src.agent.agent.session_state import (
        PATIENT_ID,
        PATIENT_NAME,
        PATIENT_VERIFIED,
    )
    from src.models import Patient

    appended = []

    class _FakeService:
        async def get_session(self, **kwargs):
            return SimpleNamespace(id="sess-1", state={})

        async def append_event(self, session, event):
            appended.append(event)

    async def fake_find_one(*args, **kwargs):
        return SimpleNamespace(patient_id="pid-9", first_name="Asha", last_name="Rao")

    monkeypatch.setattr(Patient, "find_one", fake_find_one)
    session = VoiceSession(runner=object(), session_service=_FakeService())
    session.session_id = "sess-1"

    name = await session.identify("hw-7k3f")

    assert name == "Asha Rao"
    assert len(appended) == 1
    delta = appended[0].actions.state_delta
    assert delta[PATIENT_VERIFIED] is True
    assert delta[PATIENT_ID] == "pid-9"
    assert delta[PATIENT_NAME] == "Asha Rao"


async def test_voice_session_identify_unknown_code_returns_none(monkeypatch):
    from src.models import Patient

    class _FakeService:
        async def get_session(self, **kwargs):  # pragma: no cover - not reached
            return SimpleNamespace(id="sess-1", state={})

        async def append_event(self, session, event):  # pragma: no cover
            raise AssertionError("must not append for unknown code")

    async def fake_find_one(*args, **kwargs):
        return None

    monkeypatch.setattr(Patient, "find_one", fake_find_one)
    session = VoiceSession(runner=object(), session_service=_FakeService())
    session.session_id = "sess-1"
    assert await session.identify("HW-NOPE") is None


async def test_voice_session_close_deletes_session(monkeypatch):
    # close() must drop the live session from the store so it cannot leak the
    # verified patient id/name for the life of the process.
    deleted = []

    class _FakeService:
        async def delete_session(self, **kwargs):
            deleted.append(kwargs)

    session = VoiceSession(runner=object(), session_service=_FakeService())
    session.session_id = "sess-x"
    monkeypatch.setattr(session._queue, "close", lambda: None)
    await session.close()
    assert len(deleted) == 1 and deleted[0]["session_id"] == "sess-x"


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
