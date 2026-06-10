"""Unit tests for the live-session grounding context endpoint and accessor.

The endpoint is keyed by a live voice session id and returns the verified
patient's plan/meds/appointments/care-plan, or ``verified=false``. The full
verified path with a database lives in integration tests; here we cover the
contract with stubbed model queries (mirroring the dashboard endpoint test) and
the ``verified_patient_id_for`` session-state accessor in isolation.
"""

from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.agent.agent.session_state import (
    PATIENT_ID,
    PATIENT_VERIFIED,
)
from src.api.endpoints import agent as agent_module
from src.voice import session as voice_session


class FakeQuery:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self):
        return self.docs


# -- verified_patient_id_for ----------------------------------------------------


async def test_verified_patient_id_for_returns_id_when_verified(monkeypatch):
    fake = SimpleNamespace(
        id="sess-1", state={PATIENT_VERIFIED: True, PATIENT_ID: "pid-1"}
    )

    async def fake_get_session(*args, **kwargs):
        return fake

    monkeypatch.setattr(voice_session._session_service, "get_session", fake_get_session)
    assert await voice_session.verified_patient_id_for("sess-1") == "pid-1"


async def test_verified_patient_id_for_none_when_unverified(monkeypatch):
    fake = SimpleNamespace(id="sess-1", state={})

    async def fake_get_session(*args, **kwargs):
        return fake

    monkeypatch.setattr(voice_session._session_service, "get_session", fake_get_session)
    assert await voice_session.verified_patient_id_for("sess-1") is None


async def test_verified_patient_id_for_none_when_unknown_session(monkeypatch):
    async def fake_get_session(*args, **kwargs):
        return None

    monkeypatch.setattr(voice_session._session_service, "get_session", fake_get_session)
    assert await voice_session.verified_patient_id_for("nope") is None


# -- GET /agent/session/{id}/context -------------------------------------------


def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(agent_module.router, prefix="/api/v1")
    return app


async def _get(app, session_id):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get(f"/api/v1/agent/session/{session_id}/context")


@pytest.fixture
def context_app(monkeypatch):
    now = datetime.now(UTC)
    patient = SimpleNamespace(
        id="patient-doc-id",
        patient_id="pid-margaret",
        first_name="Margaret",
        last_name="Chen",
        birth_date=date(1948, 3, 12),
        gender="F",
        city="Boston",
        state="MA",
        phone="555-0101",
        email="m@example.com",
        patient_code="HW-1001",
        discharge_reason="Heart failure discharge plan",
        assigned_clinician="Dr. Helen Park",
        follow_up_required=True,
        follow_up_window_start=now + timedelta(days=5),
        follow_up_window_end=now + timedelta(days=7),
        follow_up_kind="Cardiology follow-up",
    )
    medications = [
        SimpleNamespace(
            id="med-active",
            patient_id="pid-margaret",
            name="Furosemide 40 MG Oral Tablet",
            code="310429",
            dosage="40 mg",
            frequency="once daily",
            start=now - timedelta(days=1),
            stop=None,
            reason="CHF",
            instructions="Morning.",
            schedule_times=["08:00"],
            cautions=["Stand up slowly"],
        ),
        SimpleNamespace(
            id="med-stopped",
            patient_id="pid-margaret",
            name="Old Med",
            code=None,
            dosage=None,
            frequency=None,
            start=now - timedelta(days=10),
            stop=now - timedelta(days=1),
            reason=None,
            instructions=None,
            schedule_times=[],
            cautions=[],
        ),
    ]
    appointments = [
        SimpleNamespace(
            id="appt-future",
            patient_id="pid-margaret",
            kind="Cardiology follow-up",
            title=None,
            start=now + timedelta(days=5),
            end=now + timedelta(days=5, minutes=30),
            provider="Dr. Helen Park",
            location="BMC",
            reason="Follow-up",
            status="scheduled",
            cal_booking_uid="cal-123",
            follow_up_window_start=now + timedelta(days=5),
            follow_up_window_end=now + timedelta(days=7),
            follow_up_required=True,
            booked_at=now,
        ),
    ]
    chunks = [
        SimpleNamespace(text="Second chunk.", source_file="plan.md", chunk_index=1),
        SimpleNamespace(text="First chunk.", source_file="plan.md", chunk_index=0),
    ]

    async def fake_pid(_session_id):
        return "pid-margaret"

    async def fake_find_one(*args, **kwargs):
        return patient

    monkeypatch.setattr(agent_module, "verified_patient_id_for", fake_pid)
    monkeypatch.setattr(agent_module.Patient, "find_one", fake_find_one)
    monkeypatch.setattr(
        agent_module.Medication, "find", lambda *a, **k: FakeQuery(medications)
    )
    monkeypatch.setattr(
        agent_module.Appointment, "find", lambda *a, **k: FakeQuery(appointments)
    )
    monkeypatch.setattr(
        agent_module.CarePlanChunk, "find", lambda *a, **k: FakeQuery(chunks)
    )
    return _build_app()


async def test_context_verified_payload(context_app):
    resp = await _get(context_app, "sess-1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["verified"] is True
    assert body["patient"]["patient_id"] == "pid-margaret"
    # Stopped medication is filtered; only the active one remains.
    assert [m["id"] for m in body["medications"]] == ["med-active"]
    assert [a["id"] for a in body["appointments"]] == ["appt-future"]
    # Care-plan chunks are returned sorted by chunk_index.
    assert [c["chunk_index"] for c in body["care_plan"]["chunks"]] == [0, 1]


async def test_context_unverified_returns_placeholder(monkeypatch):
    async def fake_pid(_session_id):
        return None

    monkeypatch.setattr(agent_module, "verified_patient_id_for", fake_pid)
    resp = await _get(_build_app(), "sess-unknown")
    assert resp.status_code == 200
    body = resp.json()
    assert body["verified"] is False
    assert body["patient"] is None
    assert body["medications"] == []
    assert body["care_plan"] is None
