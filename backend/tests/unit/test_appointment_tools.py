"""Unit tests for F4 appointment helper behavior."""

from datetime import UTC, datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from src.agent.agent.session_state import set_client_time_zone
from src.agent.tools import appointment_tools as appt
from src.agent.tools.appointment_tools import (
    book_follow_up_slot,
    filter_slots_to_window,
    get_follow_up_booking,
    list_follow_up_slots,
    reschedule_follow_up,
)
from src.services.calcom_service import CalBooking, CalComError


def _verified_ctx(time_zone: str | None = None):
    state = {"patient_verified": True, "patient_id": "pid-1"}
    set_client_time_zone(state, time_zone)
    return SimpleNamespace(state=state)


def _patient(**overrides):
    data = {
        "patient_id": "pid-1",
        "first_name": "Pat",
        "last_name": "One",
        "email": "pat@example.com",
        "assigned_clinician": "Dr. Test",
        "follow_up_required": True,
        "follow_up_window_start": datetime(2026, 6, 10, 9, 0, tzinfo=UTC),
        "follow_up_window_end": datetime(2026, 6, 10, 17, 0, tzinfo=UTC),
        "follow_up_kind": "cardiology follow-up",
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def _appointment(**overrides):
    data = {
        "patient_id": "pid-1",
        "kind": "cardiology follow-up",
        "start": datetime(2026, 6, 10, 14, 0, tzinfo=UTC),
        "end": datetime(2026, 6, 10, 14, 30, tzinfo=UTC),
        "provider": "Dr. Test",
        "location": "Clinic",
        "status": "scheduled",
        "cal_booking_uid": "cal-1",
        "follow_up_window_start": None,
        "follow_up_window_end": None,
        "follow_up_required": True,
        "booked_at": None,
        "updated_at": None,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def test_filter_slots_to_window_keeps_only_in_window_slots():
    window_start = datetime(2026, 6, 10, 9, 0, tzinfo=UTC)
    window_end = datetime(2026, 6, 10, 17, 0, tzinfo=UTC)
    inside = datetime(2026, 6, 10, 10, 0, tzinfo=UTC)
    edge = datetime(2026, 6, 10, 17, 0, tzinfo=UTC)
    outside = datetime(2026, 6, 10, 18, 0, tzinfo=UTC)

    assert filter_slots_to_window(
        [outside, inside, edge], window_start, window_end
    ) == [inside, edge]


def test_timezone_and_payload_helpers():
    zone = appt._zone_info("America/Toronto")
    assert zone is not None
    assert appt._zone_info("Not/AZone") is None
    assert appt._parse_iso("bad") is None
    assert appt._parse_iso("2026-06-10T10:00:00Z") == datetime(
        2026, 6, 10, 10, 0, tzinfo=UTC
    )
    assert appt._normalize("  A   B ") == "a b"
    assert appt._invalid_time_zone("Mars/Base")["status"] == "invalid_time_zone"

    slot = appt._slot_payload(datetime(2026, 6, 10, 14, 0, tzinfo=UTC), zone)
    assert slot["start_iso"] == "2026-06-10T14:00:00Z"
    assert slot["time_zone"] == "America/Toronto"
    assert "10:00 AM" in slot["start_local"]


def test_follow_up_window_and_matching_helpers():
    window = appt._follow_up_window(_patient())
    assert isinstance(window, tuple)
    assert (
        appt._follow_up_window(_patient(follow_up_required=False))["status"]
        == "none_required"
    )
    assert (
        appt._follow_up_window(_patient(follow_up_window_start=None))["status"]
        == "no_window"
    )

    patient = _patient()
    assert not appt._is_follow_up(_appointment(status="cancelled"), patient)
    assert appt._is_follow_up(_appointment(cal_booking_uid="abc"), patient)
    assert appt._is_follow_up(_appointment(cal_booking_uid=None), patient)
    assert appt._is_follow_up(
        _appointment(kind="surgical follow up", cal_booking_uid=None), patient
    )


def test_requested_slot_and_booking_payload_helpers():
    requested = datetime(2026, 6, 10, 14, 0, tzinfo=UTC)
    equivalent = datetime(2026, 6, 10, 10, 0, tzinfo=ZoneInfo("America/Toronto"))
    assert appt._find_requested_slot(requested, [equivalent]) == equivalent
    assert appt._find_requested_slot(requested, []) is None

    payload = appt._booking_payload(_appointment(), ZoneInfo("America/Toronto"))
    assert payload["start_iso"] == "2026-06-10T14:00:00Z"
    assert payload["end_iso"] == "2026-06-10T14:30:00Z"
    assert payload["time_zone"] == "America/Toronto"

    no_end = appt._booking_payload(_appointment(end=None), ZoneInfo("America/Toronto"))
    assert no_end["end_iso"] is None


def test_appointment_tools_are_not_public():
    from src.agent.tools.guards import PUBLIC_TOOLS

    assert {
        "list_follow_up_slots",
        "book_follow_up_slot",
        "get_follow_up_booking",
        "reschedule_follow_up",
    }.isdisjoint(PUBLIC_TOOLS)


def _unverified_ctx():
    return SimpleNamespace(state={})


async def test_list_follow_up_slots_unverified_guard():
    res = await list_follow_up_slots(tool_context=_unverified_ctx())
    assert res["status"] == "unverified"


async def test_book_follow_up_slot_unverified_guard():
    res = await book_follow_up_slot(
        "2026-06-10T10:00:00Z", tool_context=_unverified_ctx()
    )
    assert res["status"] == "unverified"


async def test_get_follow_up_booking_unverified_guard():
    res = await get_follow_up_booking(tool_context=_unverified_ctx())
    assert res["status"] == "unverified"


async def test_reschedule_follow_up_unverified_guard():
    res = await reschedule_follow_up(
        "2026-06-10T10:00:00Z", tool_context=_unverified_ctx()
    )
    assert res["status"] == "unverified"


class _FakeCalClient:
    def __init__(self, slots=None, *, fail=False):
        self.slots = slots or []
        self.fail = fail
        self.created = []
        self.rescheduled = []

    async def get_available_slots(self, start, end, **kwargs):
        if self.fail:
            raise CalComError("down")
        self.last_slots_args = (start, end, kwargs)
        return self.slots

    async def create_booking(self, start, patient, **kwargs):
        if self.fail:
            raise CalComError("down")
        self.created.append((start, patient.patient_id, kwargs))
        return CalBooking(uid="new-cal", start=start, location="Video")

    async def reschedule_booking(self, booking_uid, start, patient, **kwargs):
        if self.fail:
            raise CalComError("down")
        self.rescheduled.append((booking_uid, start, patient.patient_id, kwargs))
        return CalBooking(uid="moved-cal", start=start, location="Video")


async def test_available_slots_filters_and_handles_scheduler_failure(monkeypatch):
    slot = datetime(2026, 6, 10, 14, 0, tzinfo=UTC)
    outside = datetime(2026, 6, 11, 14, 0, tzinfo=UTC)
    client = _FakeCalClient([outside, slot])
    monkeypatch.setattr(appt, "get_calcom_client", lambda: client)

    res = await appt._available_follow_up_slots(
        _patient(), zone=ZoneInfo("America/Toronto")
    )

    assert res == [slot]
    assert client.last_slots_args[2]["time_zone"] == "America/Toronto"

    monkeypatch.setattr(appt, "get_calcom_client", lambda: _FakeCalClient(fail=True))
    failed = await appt._available_follow_up_slots(
        _patient(), zone=ZoneInfo("America/Toronto")
    )
    assert failed["status"] == "scheduler_unavailable"


async def test_mirror_booking_creates_and_updates_utc(monkeypatch):
    inserted = []

    class FakeAppointment:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

        async def insert(self):
            inserted.append(self)
            return self

    monkeypatch.setattr(appt, "Appointment", FakeAppointment)
    booking = CalBooking(
        uid="cal-1",
        start=datetime(2026, 6, 10, 10, 0, tzinfo=ZoneInfo("America/Toronto")),
        end=datetime(2026, 6, 10, 10, 30, tzinfo=ZoneInfo("America/Toronto")),
        location="Video",
    )

    created = await appt._mirror_booking(_patient(), booking)

    assert inserted == [created]
    assert created.start == datetime(2026, 6, 10, 14, 0, tzinfo=UTC)
    assert created.end == datetime(2026, 6, 10, 14, 30, tzinfo=UTC)

    class Existing:
        def __init__(self):
            self.location = "Old"
            self.status = "scheduled"

        async def save(self):
            self.saved = True

    existing = Existing()
    updated = await appt._mirror_booking(_patient(), booking, existing=existing)

    assert updated is existing
    assert existing.start == datetime(2026, 6, 10, 14, 0, tzinfo=UTC)
    assert existing.cal_booking_uid == "cal-1"
    assert existing.saved is True


async def test_list_follow_up_slots_success_and_invalid_timezone(monkeypatch):
    patient = _patient()
    current = _appointment()
    slot = datetime(2026, 6, 10, 15, 0, tzinfo=UTC)

    async def patient_from_state(ctx):
        return patient

    async def current_follow_up(p):
        return current

    async def available(p, *, zone, booking_uid_to_reschedule=None):
        assert booking_uid_to_reschedule == "cal-1"
        return [slot]

    monkeypatch.setattr(appt, "_patient_from_state", patient_from_state)
    monkeypatch.setattr(appt, "_current_follow_up", current_follow_up)
    monkeypatch.setattr(appt, "_available_follow_up_slots", available)

    res = await list_follow_up_slots(
        max_slots=5, time_zone="America/Toronto", tool_context=_verified_ctx()
    )
    assert res["status"] == "ok"
    assert res["current_booking"]["cal_booking_uid"] == "cal-1"
    assert res["slots"][0]["start_iso"] == "2026-06-10T15:00:00Z"

    invalid = await list_follow_up_slots(
        time_zone="Not/AZone", tool_context=_verified_ctx()
    )
    assert invalid["status"] == "invalid_time_zone"


async def test_book_follow_up_slot_branches(monkeypatch):
    patient = _patient()
    slot = datetime(2026, 6, 10, 15, 0, tzinfo=UTC)
    client = _FakeCalClient([slot])
    mirrored = _appointment(start=slot, cal_booking_uid="new-cal")

    async def patient_from_state(ctx):
        return patient

    async def no_current(p):
        return None

    async def current(p):
        return _appointment()

    async def available(p, *, zone, booking_uid_to_reschedule=None):
        return [slot]

    async def mirror(p, booking, *, existing=None):
        assert booking.uid == "new-cal"
        return mirrored

    monkeypatch.setattr(appt, "_patient_from_state", patient_from_state)
    monkeypatch.setattr(appt, "_current_follow_up", no_current)
    monkeypatch.setattr(appt, "_available_follow_up_slots", available)
    monkeypatch.setattr(appt, "get_calcom_client", lambda: client)
    monkeypatch.setattr(appt, "_mirror_booking", mirror)

    assert (await book_follow_up_slot("not-a-date", tool_context=_verified_ctx()))[
        "status"
    ] == "invalid_time"
    assert (
        await book_follow_up_slot("2026-06-10T16:00:00Z", tool_context=_verified_ctx())
    )["status"] == "unavailable"

    booked = await book_follow_up_slot(slot.isoformat(), tool_context=_verified_ctx())
    assert booked["status"] == "booked"
    assert booked["booking"]["cal_booking_uid"] == "new-cal"
    assert client.created[0][2]["time_zone"] == "America/New_York"

    monkeypatch.setattr(appt, "_current_follow_up", current)
    already = await book_follow_up_slot(slot.isoformat(), tool_context=_verified_ctx())
    assert already["status"] == "already_booked"

    monkeypatch.setattr(appt, "_current_follow_up", no_current)
    monkeypatch.setattr(appt, "get_calcom_client", lambda: _FakeCalClient(fail=True))
    failed = await book_follow_up_slot(slot.isoformat(), tool_context=_verified_ctx())
    assert failed["status"] == "scheduler_unavailable"


async def test_get_follow_up_booking_branches(monkeypatch):
    async def patient_none(ctx):
        return _patient(follow_up_required=False)

    async def patient_ok(ctx):
        return _patient()

    async def no_current(p):
        return None

    async def current(p):
        return _appointment()

    monkeypatch.setattr(appt, "_patient_from_state", patient_none)
    assert (await get_follow_up_booking(tool_context=_verified_ctx()))[
        "status"
    ] == "none_required"

    monkeypatch.setattr(appt, "_patient_from_state", patient_ok)
    monkeypatch.setattr(appt, "_current_follow_up", no_current)
    assert (await get_follow_up_booking(tool_context=_verified_ctx()))[
        "status"
    ] == "not_booked"

    monkeypatch.setattr(appt, "_current_follow_up", current)
    res = await get_follow_up_booking(
        time_zone="America/Toronto", tool_context=_verified_ctx()
    )
    assert res["status"] == "ok"
    assert res["booking"]["time_zone"] == "America/Toronto"


async def test_reschedule_follow_up_branches(monkeypatch):
    patient = _patient()
    slot = datetime(2026, 6, 10, 15, 0, tzinfo=UTC)
    current = _appointment(cal_booking_uid="old-cal")
    client = _FakeCalClient([slot])

    async def patient_from_state(ctx):
        return patient

    async def no_current(p):
        return None

    async def current_follow_up(p):
        return current

    async def available(p, *, zone, booking_uid_to_reschedule=None):
        return [slot]

    async def mirror(p, booking, *, existing=None):
        assert existing is current
        return _appointment(start=slot, cal_booking_uid=booking.uid)

    monkeypatch.setattr(appt, "_patient_from_state", patient_from_state)
    monkeypatch.setattr(appt, "_current_follow_up", no_current)
    assert (await reschedule_follow_up(slot.isoformat(), tool_context=_verified_ctx()))[
        "status"
    ] == "not_booked"

    monkeypatch.setattr(appt, "_current_follow_up", current_follow_up)
    assert (await reschedule_follow_up("bad", tool_context=_verified_ctx()))[
        "status"
    ] == "invalid_time"

    monkeypatch.setattr(appt, "_available_follow_up_slots", available)
    monkeypatch.setattr(appt, "get_calcom_client", lambda: client)
    monkeypatch.setattr(appt, "_mirror_booking", mirror)
    moved = await reschedule_follow_up(slot.isoformat(), tool_context=_verified_ctx())
    assert moved["status"] == "rescheduled"
    assert client.rescheduled[0][0] == "old-cal"

    current.cal_booking_uid = None
    created = await reschedule_follow_up(slot.isoformat(), tool_context=_verified_ctx())
    assert created["status"] == "rescheduled"
    assert client.created

    monkeypatch.setattr(appt, "get_calcom_client", lambda: _FakeCalClient(fail=True))
    failed = await reschedule_follow_up(slot.isoformat(), tool_context=_verified_ctx())
    assert failed["status"] == "scheduler_unavailable"
