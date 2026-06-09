"""Purpose-built ADK tools for the medication schedule and safe-use feature (F3).

Like the F1 tools, these read the verified patient id only from session state (no
patient id argument), so the model cannot target another patient, and the
default-deny gate blocks them until the patient is verified.

- get_medications: the verified patient's active medications, with dosage,
  schedule, instructions, and authored cautions.
- get_next_dose: the next dose datetime for a named medication (clinic timezone),
  or an "as needed" answer for PRN medications.
- flag_pharmacist: records one non-urgent pharmacist escalation for an uncertain
  interaction the assistant should not answer itself.
"""

import logging
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from google.adk.tools import ToolContext

from src.agent.agent.session_state import verified_patient_id
from src.core.config import config
from src.models import Escalation, Medication

logger = logging.getLogger(__name__)

_UNVERIFIED = {
    "status": "unverified",
    "message": "No patient has been identified in this conversation yet.",
}


def _normalize(value: str) -> str:
    return " ".join(value.split()).lower()


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def match_medications(medications: list[Medication], query: str) -> list[Medication]:
    """Return every medication whose name contains the query (case-insensitive).

    Pure helper. The caller interprets the count: one is a hit, zero is not found,
    more than one is ambiguous.
    """
    q = _normalize(query)
    if not q:
        return []
    return [m for m in medications if q in _normalize(m.name)]


def compute_next_dose(schedule_times: list[str], now: datetime) -> datetime | None:
    """Next upcoming dose datetime from HH:MM times, relative to ``now``.

    ``now`` must be timezone-aware (in the clinic timezone). Returns the earliest
    time still ahead today, else the earliest time tomorrow. Empty schedule (PRN)
    returns None. Pure helper, tested against a fixed clock.
    """
    candidates: list[datetime] = []
    for entry in schedule_times:
        parts = entry.split(":")
        if len(parts) != 2:
            continue
        try:
            hour, minute = int(parts[0]), int(parts[1])
            today = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            # Normalize through UTC so a skipped/ambiguous wall-clock time on a DST
            # transition day resolves to a real instant.
            today = today.astimezone(UTC).astimezone(now.tzinfo)
        except ValueError:
            # Skip malformed or out-of-range times (e.g. "25:00").
            continue
        # ">=" so a dose due at exactly now surfaces today, not tomorrow.
        candidates.append(today if today >= now else today + timedelta(days=1))
    return min(candidates) if candidates else None


async def _active_medications(patient_id: str, now: datetime) -> list[Medication]:
    meds = await Medication.find(Medication.patient_id == patient_id).to_list()
    return [
        m
        for m in meds
        if (m.start is None or _aware(m.start) <= now)
        and (m.stop is None or _aware(m.stop) >= now)
    ]


async def get_medications(*, tool_context: ToolContext) -> dict:
    """List the verified patient's current medications.

    Use to tell the patient what they are taking, or to check whether a specific
    medication is on their plan. Returns each medication's name, dosage,
    frequency, schedule, instructions, and common cautions.
    """
    patient_id = verified_patient_id(tool_context.state)
    if not patient_id:
        return dict(_UNVERIFIED)
    try:
        now = datetime.now(ZoneInfo(config.CLINIC_TIMEZONE))
        meds = await _active_medications(patient_id, now)
        return {
            "status": "ok",
            "medications": [
                {
                    "name": m.name,
                    "dosage": m.dosage,
                    "frequency": m.frequency,
                    "schedule_times": m.schedule_times,
                    "instructions": m.instructions,
                    "cautions": m.cautions,
                }
                for m in meds
            ],
        }
    except Exception:
        logger.warning("get_medications query failed", exc_info=True)
        return {"status": "error"}


async def get_next_dose(medication_name: str, *, tool_context: ToolContext) -> dict:
    """Tell the patient when their next dose of a specific medication is due.

    Pass the medication name (or part of it). Returns the next dose time in the
    clinic's local time, or an as-needed answer for medications taken only when
    needed.
    """
    patient_id = verified_patient_id(tool_context.state)
    if not patient_id:
        return dict(_UNVERIFIED)
    try:
        now = datetime.now(ZoneInfo(config.CLINIC_TIMEZONE))
        meds = await _active_medications(patient_id, now)
        matches = match_medications(meds, medication_name)
        if not matches:
            return {"status": "not_found"}
        if len(matches) > 1:
            return {"status": "ambiguous", "candidates": [m.name for m in matches]}

        med = matches[0]
        next_dose = compute_next_dose(med.schedule_times, now)
        if next_dose is None:
            return {
                "status": "as_needed",
                "name": med.name,
                "dosage": med.dosage,
                "frequency": med.frequency,
            }
        return {
            "status": "ok",
            "name": med.name,
            "dosage": med.dosage,
            "next_dose_local": next_dose.strftime("%A at %I:%M %p %Z").strip(),
            "next_dose_iso": next_dose.isoformat(),
        }
    except Exception:
        logger.warning("get_next_dose query failed", exc_info=True)
        return {"status": "error"}


async def flag_pharmacist(question: str, *, tool_context: ToolContext) -> dict:
    """Flag a medication question for the pharmacist as a non-urgent escalation.

    Use when the patient asks about an interaction you are not sure about, instead
    of guessing. Pass the patient's question.
    """
    patient_id = verified_patient_id(tool_context.state)
    if not patient_id:
        return dict(_UNVERIFIED)
    try:
        await Escalation(
            patient_id=patient_id,
            kind="pharmacist_question",
            level="non-urgent",
            message=question,
        ).insert()
        return {"status": "flagged"}
    except Exception:
        logger.warning("flag_pharmacist write failed", exc_info=True)
        return {"status": "error"}
