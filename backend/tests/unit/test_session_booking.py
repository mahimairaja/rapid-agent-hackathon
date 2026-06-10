"""Unit tests for the session-scoped slots/book endpoints (calendar widget)."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.api.endpoints import agent as agent_module

NOW = datetime(2026, 6, 10, 12, 0, tzinfo=UTC)
SLOT = NOW + timedelta(days=5)


def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(agent_module.router, prefix="/api/v1")
    return app


async def _client(app):
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


def _patient():
    return SimpleNamespace(
        patient_id="pid-1",
        follow_up_required=True,
        follow_up_window_start=NOW + timedelta(days=4),
        follow_up_window_end=NOW + timedelta(days=8),
        follow_up_kind="Cardiology follow-up",
        assigned_clinician="Dr. Park",
    )


@pytest.fixture
def booking_env(monkeypatch):
    env = SimpleNamespace(
        patient=_patient(), current=None, slots=[SLOT], booked=[], rescheduled=[]
    )

    async def fake_session_patient(session_id):
        return env.patient if session_id == "sess-1" else None

    async def fake_current(patient):
        return env.current

    async def fake_available(patient, *, zone, booking_uid_to_reschedule=None):
        return env.slots

    async def fake_mirror(patient, booking, *, existing=None):
        return SimpleNamespace(
            kind="Cardiology follow-up",
            start=booking.start,
            end=None,
            provider="Dr. Park",
            location="BMC",
            status="scheduled",
            cal_booking_uid=booking.uid,
        )

    class FakeCal:
        async def create_booking(self, start, patient, *, time_zone):
            env.booked.append(start)
            return SimpleNamespace(
                uid="cal-new", start=start, end=None, status="accepted", location="BMC"
            )

        async def reschedule_booking(self, uid, start, patient, *, time_zone):
            env.rescheduled.append((uid, start))
            return SimpleNamespace(
                uid="cal-moved",
                start=start,
                end=None,
                status="accepted",
                location="BMC",
            )

    monkeypatch.setattr(agent_module, "_session_patient", fake_session_patient)
    monkeypatch.setattr(agent_module, "_current_follow_up", fake_current)
    monkeypatch.setattr(agent_module, "_available_follow_up_slots", fake_available)
    monkeypatch.setattr(agent_module, "_mirror_booking", fake_mirror)
    monkeypatch.setattr(agent_module, "get_calcom_client", lambda: FakeCal())
    return env


async def test_slots_unverified_session(booking_env):
    async with await _client(_build_app()) as client:
        resp = await client.get("/api/v1/agent/session/unknown/slots")
    assert resp.status_code == 200
    assert resp.json()["status"] == "unverified"


async def test_slots_ok_payload(booking_env):
    async with await _client(_build_app()) as client:
        resp = await client.get(
            "/api/v1/agent/session/sess-1/slots", params={"time_zone": "UTC"}
        )
    body = resp.json()
    assert body["status"] == "ok"
    assert body["window"]["start_iso"].endswith("Z")
    assert body["current_booking"] is None
    assert len(body["slots"]) == 1
    assert body["slots"][0]["start_iso"] == "2026-06-15T12:00:00Z"


async def test_slots_none_required(booking_env):
    booking_env.patient.follow_up_required = False
    async with await _client(_build_app()) as client:
        resp = await client.get("/api/v1/agent/session/sess-1/slots")
    assert resp.json()["status"] == "none_required"


async def test_book_creates_when_no_current(booking_env):
    async with await _client(_build_app()) as client:
        resp = await client.post(
            "/api/v1/agent/session/sess-1/book",
            json={"start_iso": "2026-06-15T12:00:00Z", "time_zone": "UTC"},
        )
    body = resp.json()
    assert body["status"] == "booked"
    assert body["booking"]["cal_booking_uid"] == "cal-new"
    assert booking_env.booked == [SLOT] and booking_env.rescheduled == []


async def test_book_reschedules_when_current_exists(booking_env):
    booking_env.current = SimpleNamespace(
        cal_booking_uid="cal-old",
        kind="Cardiology follow-up",
        start=NOW + timedelta(days=6),
        end=None,
        provider="Dr. Park",
        location="BMC",
        status="scheduled",
    )
    async with await _client(_build_app()) as client:
        resp = await client.post(
            "/api/v1/agent/session/sess-1/book",
            json={"start_iso": "2026-06-15T12:00:00Z", "time_zone": "UTC"},
        )
    body = resp.json()
    assert body["status"] == "rescheduled"
    assert booking_env.rescheduled == [("cal-old", SLOT)]


async def test_book_rejects_unlisted_slot(booking_env):
    async with await _client(_build_app()) as client:
        resp = await client.post(
            "/api/v1/agent/session/sess-1/book",
            json={"start_iso": "2026-06-16T12:00:00Z", "time_zone": "UTC"},
        )
    assert resp.json()["status"] == "unavailable"


async def test_book_invalid_time(booking_env):
    async with await _client(_build_app()) as client:
        resp = await client.post(
            "/api/v1/agent/session/sess-1/book",
            json={"start_iso": "not-a-time"},
        )
    assert resp.json()["status"] == "invalid_time"


def test_zone_passthrough_sanity():
    # The endpoints lean on the F4 zone helper; pin its happy path here.
    assert agent_module._zone_info("UTC") == ZoneInfo("UTC")
    assert agent_module._zone_info("Not/AZone") is None
