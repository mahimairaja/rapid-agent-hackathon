"""Shared read-model helpers for a patient's active plan.

The patient dashboard (``/patients/dashboard``) and the live-session context
endpoint (``/agent/session/{id}/context``) both need the same notion of which
medications are currently active and which appointments are still upcoming, in
the same sort order. Keeping that logic here means the two surfaces cannot drift
apart. The helpers are pure (no I/O) so they are unit-tested without a database.
"""

from datetime import UTC, datetime

from src.models import Appointment, Medication

# Appointment statuses that mean the visit is no longer upcoming.
_CLOSED_APPOINTMENT_STATUSES = {"completed", "cancelled", "rejected"}


def aware(value: datetime) -> datetime:
    """Treat a naive datetime as UTC so comparisons never raise."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def is_active_medication(medication: Medication, now: datetime) -> bool:
    return (medication.start is None or aware(medication.start) <= now) and (
        medication.stop is None or aware(medication.stop) >= now
    )


def is_upcoming_appointment(appointment: Appointment, now: datetime) -> bool:
    return (
        appointment.status.lower() not in _CLOSED_APPOINTMENT_STATUSES
        and aware(appointment.start) >= now
    )


def active_medications(
    medications: list[Medication], now: datetime
) -> list[Medication]:
    """Active medications, earliest-started first then alphabetical by name."""
    return sorted(
        (med for med in medications if is_active_medication(med, now)),
        key=lambda med: (
            aware(med.start) if med.start else datetime.min.replace(tzinfo=UTC),
            med.name,
        ),
    )


def upcoming_appointments(
    appointments: list[Appointment], now: datetime
) -> list[Appointment]:
    """Upcoming appointments in chronological order."""
    return sorted(
        (appt for appt in appointments if is_upcoming_appointment(appt, now)),
        key=lambda appt: aware(appt.start),
    )
