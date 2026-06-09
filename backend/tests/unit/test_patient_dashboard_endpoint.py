"""Unit tests for the patient-code dashboard endpoint contract."""

from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.api.endpoints import patients as patients_module
from src.core.security import get_current_user


class FakeQuery:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self):
        return self.docs


@pytest.fixture
def dashboard_app(monkeypatch):
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
        email="margaret.chen@example.com",
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
            frequency="once daily in the morning",
            start=now - timedelta(days=1),
            stop=None,
            reason="Chronic congestive heart failure",
            instructions="Take earlier in the day.",
            schedule_times=["08:00"],
            cautions=["Stand up slowly"],
        ),
        SimpleNamespace(
            id="med-stopped",
            patient_id="pid-margaret",
            name="Stopped Medication",
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
            location="Boston Medical Center",
            reason="Follow-up visit",
            status="scheduled",
            cal_booking_uid="cal-123",
            follow_up_window_start=now + timedelta(days=5),
            follow_up_window_end=now + timedelta(days=7),
            follow_up_required=True,
            booked_at=now,
        ),
        SimpleNamespace(
            id="appt-completed",
            patient_id="pid-margaret",
            kind="Lab",
            title=None,
            start=now - timedelta(days=2),
            end=None,
            provider=None,
            location=None,
            reason=None,
            status="completed",
            cal_booking_uid=None,
            follow_up_window_start=None,
            follow_up_window_end=None,
            follow_up_required=None,
            booked_at=None,
        ),
    ]

    async def fake_find_one(*args, **kwargs):
        return patient

    def fake_medication_find(*args, **kwargs):
        return FakeQuery(medications)

    def fake_appointment_find(*args, **kwargs):
        return FakeQuery(appointments)

    monkeypatch.setattr(patients_module.Patient, "find_one", fake_find_one)
    monkeypatch.setattr(patients_module.Medication, "find", fake_medication_find)
    monkeypatch.setattr(patients_module.Appointment, "find", fake_appointment_find)

    app = FastAPI()
    app.dependency_overrides[get_current_user] = lambda: "user-123"
    app.include_router(patients_module.router, prefix="/api/v1")
    return app


async def _post(app, body):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post("/api/v1/patients/dashboard", json=body)


async def test_dashboard_returns_one_patient_payload(dashboard_app):
    resp = await _post(dashboard_app, {"patient_code": "hw-1001"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["patient"]["patient_id"] == "pid-margaret"
    assert body["patient"]["patient_code"] == "HW-1001"
    assert [m["id"] for m in body["medications"]] == ["med-active"]
    assert [a["id"] for a in body["appointments"]] == ["appt-future"]
    assert body["appointments"][0]["start"].endswith("Z")


async def test_dashboard_returns_404_for_bad_code(dashboard_app, monkeypatch):
    async def fake_find_one(*args, **kwargs):
        return None

    monkeypatch.setattr(patients_module.Patient, "find_one", fake_find_one)

    resp = await _post(dashboard_app, {"patient_code": "bad-code"})

    assert resp.status_code == 404


async def test_dashboard_rejects_blank_code(dashboard_app):
    resp = await _post(dashboard_app, {"patient_code": ""})

    assert resp.status_code == 422
