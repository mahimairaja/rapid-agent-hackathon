"""Appointment scheduling tools for F4 follow-up booking.

These tools follow the F1/F3 isolation rule: the model never supplies a
patient_id. Every personalized operation reads the verified patient id from
session state and is protected by the default-deny gate.
"""

import logging
from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from google.adk.tools import ToolContext

from src.agent.agent.session_state import client_time_zone, verified_patient_id
from src.core.config import config
from src.models import Appointment, Patient
from src.services.calcom_service import (
    CalBooking,
    CalComError,
    get_calcom_client,
)

logger = logging.getLogger(__name__)

_UNVERIFIED = {
    "status": "unverified",
    "message": "No patient has been identified in this conversation yet.",
}
# Statuses that mean the patient currently holds this follow-up slot, so it must
# not be double-booked. "pending" (awaiting host confirmation) still holds the
# slot and must count here, or a retry would create a duplicate booking;
# "cancelled"/"rejected" release the slot and are intentionally excluded.
_BOOKED_STATUSES = {"scheduled", "upcoming", "accepted", "pending"}
_DEFAULT_SLOT_LIMIT = 3
_DEFAULT_TIME_ZONE = "America/New_York"


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def _utc(value: datetime) -> datetime:
    return _aware(value).astimezone(UTC).replace(microsecond=0)


def _parse_iso(value: str) -> datetime | None:
    try:
        return _aware(datetime.fromisoformat(value.strip().replace("Z", "+00:00")))
    except (ValueError, AttributeError):
        return None


def _normalize(value: str | None) -> str:
    return " ".join((value or "").split()).lower()


# Cal.com's confirmed statuses map to our canonical "scheduled"; any other
# status (e.g. "pending" awaiting host confirmation, "cancelled", "rejected") is
# surfaced as-is so an unconfirmed hold is not mistaken for a booked follow-up.
_CONFIRMED_CAL_STATUSES = {"", "accepted", "scheduled", "upcoming"}


def _local_status(cal_status: str | None) -> str:
    normalized = (cal_status or "").strip().lower()
    return "scheduled" if normalized in _CONFIRMED_CAL_STATUSES else normalized


def _timezone_key(time_zone: str | None = None) -> str:
    configured = (config.CLINIC_TIMEZONE or "").strip() or _DEFAULT_TIME_ZONE
    return (time_zone or configured).strip() or configured


def _zone_info(time_zone: str | None = None) -> ZoneInfo | None:
    try:
        return ZoneInfo(_timezone_key(time_zone))
    except ZoneInfoNotFoundError:
        return None


def _invalid_time_zone(time_zone: str | None) -> dict:
    return {
        "status": "invalid_time_zone",
        "message": f"Unsupported timezone: {time_zone}",
    }


def _tool_zone(
    tool_context: ToolContext, time_zone: str | None = None
) -> ZoneInfo | None:
    return _zone_info(time_zone or client_time_zone(tool_context.state))


def _voice_time(value: datetime, zone: ZoneInfo) -> str:
    local = _aware(value).astimezone(zone)
    day = local.strftime("%A, %B %d").replace(" 0", " ")
    time = local.strftime("%I:%M %p").lstrip("0")
    zone_label = local.tzname() or ""
    return f"{day} at {time} {zone_label}".strip()


def _slot_payload(start: datetime, zone: ZoneInfo) -> dict:
    return {
        "start_iso": _utc(start).isoformat().replace("+00:00", "Z"),
        "start_local": _voice_time(start, zone),
        "time_zone": zone.key,
    }


def filter_slots_to_window(
    slots: list[datetime],
    window_start: datetime,
    window_end: datetime,
) -> list[datetime]:
    """Return slots whose start is inside the follow-up window."""
    start = _utc(window_start)
    end = _utc(window_end)
    return sorted(slot for slot in slots if start <= _utc(slot) <= end)


def _same_instant(left: datetime, right: datetime) -> bool:
    return _utc(left) == _utc(right)


def _find_requested_slot(
    requested: datetime, available: list[datetime]
) -> datetime | None:
    for slot in available:
        if _same_instant(requested, slot):
            return slot
    return None


async def _patient_from_state(tool_context: ToolContext) -> Patient | dict:
    patient_id = verified_patient_id(tool_context.state)
    if not patient_id:
        return dict(_UNVERIFIED)
    patient = await Patient.find_one(Patient.patient_id == patient_id)
    if patient is None:
        return {"status": "not_found"}
    return patient


def _follow_up_window(patient: Patient) -> tuple[datetime, datetime] | dict:
    if patient.follow_up_required is False:
        return {
            "status": "none_required",
            "message": "This discharge plan does not require a follow-up visit.",
        }
    if not patient.follow_up_window_start or not patient.follow_up_window_end:
        return {
            "status": "no_window",
            "message": "This discharge plan does not include a follow-up window.",
        }
    return patient.follow_up_window_start, patient.follow_up_window_end


def _is_follow_up(appointment: Appointment, patient: Patient) -> bool:
    if appointment.status.lower() not in _BOOKED_STATUSES:
        return False
    kind = _normalize(appointment.kind)
    expected = _normalize(patient.follow_up_kind)
    if appointment.cal_booking_uid:
        return True
    if expected and kind == expected:
        return True
    return "follow-up" in kind or "follow up" in kind


async def _current_follow_up(patient: Patient) -> Appointment | None:
    appointments = await Appointment.find(
        Appointment.patient_id == patient.patient_id
    ).to_list()
    future = [
        appt
        for appt in appointments
        if _is_follow_up(appt, patient) and _utc(appt.start) >= _utc(datetime.now(UTC))
    ]
    if not future:
        return None
    return min(future, key=lambda appt: _utc(appt.start))


async def _available_follow_up_slots(
    patient: Patient,
    *,
    zone: ZoneInfo,
    booking_uid_to_reschedule: str | None = None,
) -> list[datetime] | dict:
    window = _follow_up_window(patient)
    if isinstance(window, dict):
        return window
    start, end = window
    try:
        slots = await get_calcom_client().get_available_slots(
            start,
            end,
            time_zone=zone.key,
            booking_uid_to_reschedule=booking_uid_to_reschedule,
        )
    except CalComError:
        logger.warning("Cal.com slot lookup failed", exc_info=True)
        return {
            "status": "scheduler_unavailable",
            "message": "The scheduling system is not available right now.",
        }
    return filter_slots_to_window(slots, start, end)


def _booking_payload(appointment: Appointment, zone: ZoneInfo) -> dict:
    return {
        "kind": appointment.kind,
        "start_iso": _utc(appointment.start).isoformat().replace("+00:00", "Z"),
        "start_local": _voice_time(appointment.start, zone),
        "end_iso": _utc(appointment.end).isoformat().replace("+00:00", "Z")
        if appointment.end
        else None,
        "time_zone": zone.key,
        "provider": appointment.provider,
        "location": appointment.location,
        "status": appointment.status,
        "cal_booking_uid": appointment.cal_booking_uid,
    }


async def _mirror_booking(
    patient: Patient,
    booking: CalBooking,
    *,
    existing: Appointment | None = None,
) -> Appointment:
    now = datetime.now(UTC)
    if existing is None:
        appointment = Appointment(
            patient_id=patient.patient_id,
            kind=patient.follow_up_kind or "Follow-up",
            start=_utc(booking.start),
            end=_utc(booking.end) if booking.end else None,
            provider=patient.assigned_clinician,
            location=booking.location,
            reason="Follow-up visit",
            status=_local_status(booking.status),
            cal_booking_uid=booking.uid,
            follow_up_window_start=_utc(patient.follow_up_window_start)
            if patient.follow_up_window_start
            else None,
            follow_up_window_end=_utc(patient.follow_up_window_end)
            if patient.follow_up_window_end
            else None,
            follow_up_required=patient.follow_up_required,
            booked_at=now,
        )
        await appointment.insert()
        return appointment

    existing.start = _utc(booking.start)
    existing.end = _utc(booking.end) if booking.end else None
    existing.location = booking.location or existing.location
    existing.status = _local_status(booking.status)
    existing.cal_booking_uid = booking.uid
    existing.follow_up_window_start = (
        _utc(patient.follow_up_window_start) if patient.follow_up_window_start else None
    )
    existing.follow_up_window_end = (
        _utc(patient.follow_up_window_end) if patient.follow_up_window_end else None
    )
    existing.follow_up_required = patient.follow_up_required
    existing.booked_at = now
    existing.updated_at = now
    await existing.save()
    return existing


async def list_follow_up_slots(
    max_slots: int = _DEFAULT_SLOT_LIMIT,
    time_zone: str | None = None,
    *,
    tool_context: ToolContext,
) -> dict:
    """List Cal.com follow-up slots inside the verified patient's plan window.

    Optionally pass an IANA time_zone (for example, America/Toronto) for returned
    local display strings. Stored datetimes and start_iso values remain UTC.
    """
    try:
        patient = await _patient_from_state(tool_context)
        if isinstance(patient, dict):
            return patient
        zone = _tool_zone(tool_context, time_zone)
        if zone is None:
            return _invalid_time_zone(time_zone)
        current = await _current_follow_up(patient)
        slots = await _available_follow_up_slots(
            patient,
            zone=zone,
            booking_uid_to_reschedule=current.cal_booking_uid
            if current is not None
            else None,
        )
        if isinstance(slots, dict):
            return slots
        limit = max(1, min(int(max_slots or _DEFAULT_SLOT_LIMIT), 10))
        return {
            "status": "ok",
            "current_booking": _booking_payload(current, zone) if current else None,
            "slots": [_slot_payload(slot, zone) for slot in slots[:limit]],
        }
    except Exception:
        logger.warning("list_follow_up_slots failed", exc_info=True)
        return {"status": "error"}


async def book_follow_up_slot(
    start_iso: str,
    time_zone: str | None = None,
    *,
    tool_context: ToolContext,
) -> dict:
    """Book a Cal.com follow-up slot for the verified patient.

    Pass exactly one start_iso value returned by list_follow_up_slots.
    """
    try:
        patient = await _patient_from_state(tool_context)
        if isinstance(patient, dict):
            return patient
        zone = _tool_zone(tool_context, time_zone)
        if zone is None:
            return _invalid_time_zone(time_zone)
        requested = _parse_iso(start_iso)
        if requested is None:
            return {"status": "invalid_time"}
        current = await _current_follow_up(patient)
        if current is not None:
            return {
                "status": "already_booked",
                "booking": _booking_payload(current, zone),
            }

        slots = await _available_follow_up_slots(patient, zone=zone)
        if isinstance(slots, dict):
            return slots
        selected = _find_requested_slot(requested, slots)
        if selected is None:
            return {"status": "unavailable"}

        # Re-check right before the write to narrow the TOCTOU window: a
        # concurrent turn on another session could have booked this patient's
        # follow-up between the first check above and here.
        current = await _current_follow_up(patient)
        if current is not None:
            return {
                "status": "already_booked",
                "booking": _booking_payload(current, zone),
            }

        try:
            booking = await get_calcom_client().create_booking(
                selected,
                patient,
                time_zone=zone.key,
            )
        except CalComError:
            logger.warning("Cal.com booking failed", exc_info=True)
            return {
                "status": "scheduler_unavailable",
                "message": "The scheduling system is not available right now.",
            }
        appointment = await _mirror_booking(patient, booking)
        return {
            "status": "booked",
            "booking": _booking_payload(appointment, zone),
            "read_back": f"Your follow-up is booked for {_voice_time(appointment.start, zone)}.",
        }
    except Exception:
        logger.warning("book_follow_up_slot failed", exc_info=True)
        return {"status": "error"}


async def get_follow_up_booking(
    time_zone: str | None = None,
    *,
    tool_context: ToolContext,
) -> dict:
    """Return the verified patient's currently booked follow-up visit.

    Optionally pass an IANA time_zone for the local read-back string.
    """
    try:
        patient = await _patient_from_state(tool_context)
        if isinstance(patient, dict):
            return patient
        zone = _tool_zone(tool_context, time_zone)
        if zone is None:
            return _invalid_time_zone(time_zone)
        if patient.follow_up_required is False:
            return {"status": "none_required"}
        current = await _current_follow_up(patient)
        if current is None:
            return {"status": "not_booked"}
        return {"status": "ok", "booking": _booking_payload(current, zone)}
    except Exception:
        logger.warning("get_follow_up_booking failed", exc_info=True)
        return {"status": "error"}


async def reschedule_follow_up(
    start_iso: str,
    time_zone: str | None = None,
    *,
    tool_context: ToolContext,
) -> dict:
    """Move the verified patient's follow-up to another returned Cal.com slot.

    Optionally pass an IANA time_zone for Cal.com attendee context and read-back.
    """
    try:
        patient = await _patient_from_state(tool_context)
        if isinstance(patient, dict):
            return patient
        zone = _tool_zone(tool_context, time_zone)
        if zone is None:
            return _invalid_time_zone(time_zone)
        requested = _parse_iso(start_iso)
        if requested is None:
            return {"status": "invalid_time"}
        current = await _current_follow_up(patient)
        if current is None:
            return {"status": "not_booked"}

        slots = await _available_follow_up_slots(
            patient,
            zone=zone,
            booking_uid_to_reschedule=current.cal_booking_uid,
        )
        if isinstance(slots, dict):
            return slots
        selected = _find_requested_slot(requested, slots)
        if selected is None:
            return {"status": "unavailable"}

        try:
            if current.cal_booking_uid:
                booking = await get_calcom_client().reschedule_booking(
                    current.cal_booking_uid,
                    selected,
                    patient,
                    time_zone=zone.key,
                )
            else:
                booking = await get_calcom_client().create_booking(
                    selected,
                    patient,
                    time_zone=zone.key,
                )
        except CalComError:
            logger.warning("Cal.com reschedule failed", exc_info=True)
            return {
                "status": "scheduler_unavailable",
                "message": "The scheduling system is not available right now.",
            }

        appointment = await _mirror_booking(patient, booking, existing=current)
        return {
            "status": "rescheduled",
            "booking": _booking_payload(appointment, zone),
            "read_back": f"Your follow-up is now booked for {_voice_time(appointment.start, zone)}.",
        }
    except Exception:
        logger.warning("reschedule_follow_up failed", exc_info=True)
        return {"status": "error"}
