"""Unit tests for the shared patient read-model helpers.

These back both the dashboard and the session-context endpoints, so the
active/upcoming filtering and ordering are pinned here once.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from src.services.patient_view import (
    active_medications,
    is_active_medication,
    is_upcoming_appointment,
    upcoming_appointments,
)

NOW = datetime(2026, 6, 9, 12, 0, tzinfo=UTC)


def _med(name, start=None, stop=None):
    return SimpleNamespace(name=name, start=start, stop=stop)


def _appt(status, start):
    return SimpleNamespace(status=status, start=start)


def test_is_active_medication_open_ended():
    assert is_active_medication(_med("A"), NOW) is True


def test_is_active_medication_stopped_is_inactive():
    assert is_active_medication(_med("A", stop=NOW - timedelta(days=1)), NOW) is False


def test_is_active_medication_future_start_is_inactive():
    assert is_active_medication(_med("A", start=NOW + timedelta(days=1)), NOW) is False


def test_active_medications_sorted_by_start_then_name():
    meds = [
        _med("Zinc", start=NOW - timedelta(days=1)),
        _med("Aspirin", start=NOW - timedelta(days=1)),
        _med("Early", start=NOW - timedelta(days=5)),
        _med("Stopped", stop=NOW - timedelta(days=1)),
    ]
    result = [m.name for m in active_medications(meds, NOW)]
    assert result == ["Early", "Aspirin", "Zinc"]


def test_naive_datetime_treated_as_utc():
    naive = NOW.replace(tzinfo=None) - timedelta(days=1)
    assert is_active_medication(_med("A", start=naive), NOW) is True


def test_is_upcoming_appointment_excludes_closed_and_past():
    assert is_upcoming_appointment(_appt("scheduled", NOW + timedelta(1)), NOW) is True
    assert is_upcoming_appointment(_appt("completed", NOW + timedelta(1)), NOW) is False
    assert is_upcoming_appointment(_appt("cancelled", NOW + timedelta(1)), NOW) is False
    assert is_upcoming_appointment(_appt("scheduled", NOW - timedelta(1)), NOW) is False


def test_upcoming_appointments_sorted_chronologically():
    appts = [
        _appt("scheduled", NOW + timedelta(days=3)),
        _appt("scheduled", NOW + timedelta(days=1)),
        _appt("completed", NOW + timedelta(days=2)),
    ]
    starts = [a.start for a in upcoming_appointments(appts, NOW)]
    assert starts == [NOW + timedelta(days=1), NOW + timedelta(days=3)]
