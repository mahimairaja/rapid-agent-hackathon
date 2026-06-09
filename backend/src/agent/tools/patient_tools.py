"""Purpose-built ADK tools for patient recognition and plan loading (F1).

These FunctionTools are the only way the agent reaches patient data; the raw
MongoDB MCP server is never exposed to the model. Isolation (REQ-HW-PLAN-002) is
enforced here in code, not just in the prompt:

- ``get_my_plan`` takes no patient id argument and reads the id only from
  verified session state, so the model cannot request another patient.
- ``find_patient`` refuses to re-identify an already-verified session, so one
  conversation stays bound to one patient.
- An ambiguous match (more than one candidate) returns ``not_found`` and never
  reads out a candidate's details (AC-HW-PLAN-001.3).
"""

import logging
from datetime import UTC, date, datetime

from google.adk.tools import ToolContext

from src.agent.agent.session_state import (
    is_verified,
    patient_name,
    set_verified,
    verified_patient_id,
)
from src.models import Appointment, CarePlanChunk, Patient

logger = logging.getLogger(__name__)

_SNIPPET_CHARS = 300


def _normalize_name(value: str) -> str:
    return " ".join(value.split()).lower()


def _as_date(value: object) -> object:
    """Normalize a datetime to a date so equality holds regardless of storage."""
    if isinstance(value, datetime):
        return value.date()
    return value


def select_patient(
    candidates: list[Patient],
    full_name: str | None = None,
    date_of_birth: date | None = None,
    patient_code: str | None = None,
) -> Patient | None:
    """Return the single matching patient, or None.

    Returns a record only when exactly one candidate matches, so an ambiguous
    match never surfaces another patient's details. Pure (no I/O), so the match
    logic is unit-tested without a database.
    """
    if patient_code:
        code = patient_code.strip().lower()
        matches = [
            c for c in candidates if c.patient_code and c.patient_code.lower() == code
        ]
    elif full_name and date_of_birth is not None:
        name = _normalize_name(full_name)
        matches = [
            c
            for c in candidates
            if _normalize_name(f"{c.first_name} {c.last_name}") == name
            and _as_date(c.birth_date) == date_of_birth
        ]
    else:
        return None
    return matches[0] if len(matches) == 1 else None


def _parse_dob(value: str) -> date | None:
    try:
        return date.fromisoformat(value.strip()[:10])
    except (ValueError, AttributeError):
        return None


async def find_patient(
    full_name: str | None = None,
    date_of_birth: str | None = None,
    patient_code: str | None = None,
    *,
    tool_context: ToolContext,
) -> dict:
    """Identify the patient and load their discharge plan.

    Provide either the patient's full name together with their date of birth as
    YYYY-MM-DD, or their patient code. Returns whether a single matching plan was
    found. Use this once at the start of the conversation before any other tool.
    """
    state = tool_context.state
    if is_verified(state):
        # One patient per session: do not silently switch identity.
        return {"status": "already_verified", "patient_name": patient_name(state)}

    try:
        dob: date | None = None
        if patient_code:
            # Codes are stored upper-cased (see seed), so match case-insensitively
            # by normalizing the input the same way.
            candidates = (
                await Patient.find(Patient.patient_code == patient_code.strip().upper())
                .limit(2)
                .to_list()
            )
        elif full_name and date_of_birth:
            dob = _parse_dob(date_of_birth)
            if dob is None:
                return {"status": "not_found"}
            # No limit: select_patient must see every same-birth-date candidate, so a
            # large same-DOB cohort cannot drop the real patient or hide an ambiguity.
            candidates = await Patient.find(Patient.birth_date == dob).to_list()
        else:
            return {"status": "not_found"}
    except Exception:
        logger.warning("find_patient query failed", exc_info=True)
        return {"status": "error"}

    match = select_patient(
        candidates,
        full_name=None if patient_code else full_name,
        date_of_birth=None if patient_code else dob,
        patient_code=patient_code,
    )
    if match is None:
        return {"status": "not_found"}

    name = f"{match.first_name} {match.last_name}"
    set_verified(state, patient_id=match.patient_id, name=name)
    return {
        "status": "found",
        "patient_name": name,
        "plan_detail": match.discharge_reason,
    }


async def get_my_plan(*, tool_context: ToolContext) -> dict:
    """Load the verified patient's discharge plan summary.

    Use only after the patient has been identified with find_patient. Returns the
    patient's own plan details so you can state a real detail back to them.
    """
    state = tool_context.state
    patient_id = verified_patient_id(state)
    if not patient_id:
        return {
            "status": "unverified",
            "message": "No patient has been identified in this conversation yet.",
        }

    try:
        patient = await Patient.find_one(Patient.patient_id == patient_id)
        if patient is None:
            return {"status": "not_found"}

        plan: dict = {
            "patient_name": f"{patient.first_name} {patient.last_name}",
            "discharge_reason": patient.discharge_reason,
            "assigned_clinician": patient.assigned_clinician,
        }

        # Best-effort extras (do not require Voyage-loaded care plans or a future
        # appointment to exist; discharge_reason is the guaranteed plan detail).
        now = datetime.now(UTC)
        appointments = await Appointment.find(
            Appointment.patient_id == patient_id
        ).to_list()
        future = sorted(
            (a for a in appointments if _aware(a.start) >= now),
            key=lambda a: _aware(a.start),
        )
        if future:
            nxt = future[0]
            plan["next_appointment"] = {
                "kind": nxt.kind,
                "start": nxt.start.isoformat(),
                "provider": nxt.provider,
                "location": nxt.location,
            }

        chunks = await CarePlanChunk.find(
            CarePlanChunk.patient_id == patient_id
        ).to_list()
        if chunks:
            first = min(chunks, key=lambda c: c.chunk_index)
            if first.text:
                plan["care_plan_snippet"] = first.text[:_SNIPPET_CHARS]

        return {"status": "ok", "plan": plan}
    except Exception:
        logger.warning("get_my_plan query failed", exc_info=True)
        return {"status": "error"}


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value
