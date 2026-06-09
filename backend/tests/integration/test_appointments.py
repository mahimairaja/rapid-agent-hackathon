"""DB-backed tests for F4 Cal.com follow-up scheduling tools."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from src.agent.agent.session_state import set_client_time_zone, set_verified
from src.agent.tools import appointment_tools
from src.agent.tools.appointment_tools import (
    book_follow_up_slot,
    get_follow_up_booking,
    list_follow_up_slots,
    reschedule_follow_up,
)
from src.models import Appointment, Patient
from src.services.calcom_service import CalBooking


def _ctx(patient_id: str, time_zone: str | None = None):
    state: dict = {}
    set_verified(state, patient_id=patient_id, name="Test Patient")
    set_client_time_zone(state, time_zone)
    return SimpleNamespace(state=state)


class FakeCalComClient:
    def __init__(self, slots: list[datetime]):
        self.slots = slots
        self.created: list[tuple[datetime, str, str | None]] = []
        self.rescheduled: list[tuple[str, datetime, str, str | None]] = []
        self.last_booking_uid_to_reschedule: str | None = None
        self.last_time_zone: str | None = None

    async def get_available_slots(
        self,
        start: datetime,
        end: datetime,
        *,
        time_zone: str | None = None,
        booking_uid_to_reschedule: str | None = None,
    ) -> list[datetime]:
        self.last_booking_uid_to_reschedule = booking_uid_to_reschedule
        self.last_time_zone = time_zone
        return self.slots

    async def create_booking(
        self,
        start: datetime,
        patient: Patient,
        *,
        time_zone: str | None = None,
    ) -> CalBooking:
        self.created.append((start, patient.patient_id, time_zone))
        return CalBooking(
            uid=f"cal-created-{len(self.created)}",
            start=start,
            end=start + timedelta(minutes=30),
            status="accepted",
            location="Cal Video",
        )

    async def reschedule_booking(
        self,
        booking_uid: str,
        start: datetime,
        patient: Patient,
        *,
        time_zone: str | None = None,
    ) -> CalBooking:
        self.rescheduled.append((booking_uid, start, patient.patient_id, time_zone))
        return CalBooking(
            uid="cal-rescheduled",
            start=start,
            end=start + timedelta(minutes=30),
            status="accepted",
            location="Cal Video",
        )


def _patch_cal(monkeypatch, fake: FakeCalComClient) -> FakeCalComClient:
    monkeypatch.setattr(appointment_tools, "get_calcom_client", lambda: fake)
    return fake


async def _insert_booking_patient(patient_id: str = "pid-book") -> Patient:
    patient = Patient(
        patient_id=patient_id,
        first_name="Book",
        last_name="Patient",
        birth_date=datetime(1970, 1, 1, tzinfo=UTC).date(),
        email=f"{patient_id}@example.com",
        discharge_reason="Follow-up booking test",
        assigned_clinician="Dr. Scheduler",
        follow_up_required=True,
        follow_up_window_start=datetime(2099, 2, 1, 8, 0, tzinfo=UTC),
        follow_up_window_end=datetime(2099, 2, 3, 17, 0, tzinfo=UTC),
        follow_up_kind="primary care follow-up",
    )
    await patient.insert()
    return patient


async def test_list_follow_up_slots_filters_to_plan_window(seed_demo, monkeypatch):
    fake = _patch_cal(
        monkeypatch,
        FakeCalComClient(
            [
                datetime(2098, 12, 31, 10, 0, tzinfo=UTC),
                datetime(2099, 1, 2, 10, 0, tzinfo=UTC),
                datetime(2099, 1, 4, 10, 0, tzinfo=UTC),
            ]
        ),
    )

    res = await list_follow_up_slots(
        tool_context=_ctx("pid-margaret", time_zone="America/Toronto")
    )

    assert res["status"] == "ok"
    assert [slot["start_iso"] for slot in res["slots"]] == ["2099-01-02T10:00:00Z"]
    assert res["current_booking"]["kind"] == "cardiology follow-up"
    assert fake.last_booking_uid_to_reschedule is None
    assert fake.last_time_zone == "America/Toronto"
    assert res["slots"][0]["time_zone"] == "America/Toronto"


async def test_no_follow_up_path(seed_demo, monkeypatch):
    _patch_cal(monkeypatch, FakeCalComClient([]))

    res = await list_follow_up_slots(tool_context=_ctx("pid-james"))

    assert res["status"] == "none_required"


async def test_invalid_time_zone_is_rejected(seed_demo, monkeypatch):
    _patch_cal(monkeypatch, FakeCalComClient([]))

    res = await list_follow_up_slots(
        time_zone="Not/AZone", tool_context=_ctx("pid-margaret")
    )

    assert res["status"] == "invalid_time_zone"


async def test_book_follow_up_slot_mirrors_cal_booking(db, monkeypatch):
    await _insert_booking_patient()
    slot = datetime(2099, 2, 2, 9, 0, tzinfo=ZoneInfo("America/Toronto"))
    fake = _patch_cal(monkeypatch, FakeCalComClient([slot]))

    res = await book_follow_up_slot(slot.isoformat(), tool_context=_ctx("pid-book"))

    assert res["status"] == "booked"
    assert res["booking"]["cal_booking_uid"] == "cal-created-1"
    assert "2099-02-02T14:00:00Z" == res["booking"]["start_iso"]
    assert fake.created == [(slot, "pid-book", "America/New_York")]

    docs = await Appointment.find(Appointment.patient_id == "pid-book").to_list()
    assert len(docs) == 1
    assert docs[0].cal_booking_uid == "cal-created-1"
    assert docs[0].status == "scheduled"
    stored_start = (
        docs[0].start.replace(tzinfo=UTC)
        if docs[0].start.tzinfo is None
        else docs[0].start.astimezone(UTC)
    )
    assert stored_start == datetime(2099, 2, 2, 14, 0, tzinfo=UTC)


async def test_double_booking_is_rejected_by_local_mirror(db, monkeypatch):
    await _insert_booking_patient()
    slot = datetime(2099, 2, 2, 14, 0, tzinfo=UTC)
    fake = _patch_cal(monkeypatch, FakeCalComClient([slot]))

    first = await book_follow_up_slot(slot.isoformat(), tool_context=_ctx("pid-book"))
    second = await book_follow_up_slot(slot.isoformat(), tool_context=_ctx("pid-book"))

    assert first["status"] == "booked"
    assert second["status"] == "already_booked"
    assert len(fake.created) == 1


async def test_get_follow_up_booking_returns_current_visit(seed_demo):
    res = await get_follow_up_booking(
        time_zone="America/Los_Angeles", tool_context=_ctx("pid-margaret")
    )

    assert res["status"] == "ok"
    assert res["booking"]["kind"] == "cardiology follow-up"
    assert res["booking"]["provider"] == "Dr. Helen Park"
    assert res["booking"]["time_zone"] == "America/Los_Angeles"


async def test_reschedule_updates_existing_cal_booking(db, monkeypatch):
    patient = await _insert_booking_patient("pid-move")
    current = await Appointment(
        patient_id=patient.patient_id,
        kind=patient.follow_up_kind or "Follow-up",
        start=datetime(2099, 2, 1, 10, 0, tzinfo=UTC),
        end=datetime(2099, 2, 1, 10, 30, tzinfo=UTC),
        provider=patient.assigned_clinician,
        status="scheduled",
        cal_booking_uid="cal-old",
    ).insert()
    new_slot = datetime(2099, 2, 3, 15, 0, tzinfo=UTC)
    fake = _patch_cal(monkeypatch, FakeCalComClient([new_slot]))

    res = await reschedule_follow_up(
        new_slot.isoformat(), tool_context=_ctx("pid-move")
    )

    assert res["status"] == "rescheduled"
    assert fake.last_booking_uid_to_reschedule == "cal-old"
    assert fake.rescheduled == [("cal-old", new_slot, "pid-move", "America/New_York")]

    await current.sync()
    assert current.cal_booking_uid == "cal-rescheduled"
    actual_start = (
        current.start.replace(tzinfo=UTC)
        if current.start.tzinfo is None
        else current.start.astimezone(UTC)
    )
    assert actual_start == new_slot
    assert current.status == "scheduled"
