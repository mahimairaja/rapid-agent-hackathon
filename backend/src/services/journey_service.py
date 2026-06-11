"""Journey onboarding: clone a seeded sample into a personal patient profile.

Hackathon users do not bring real discharge documents, so onboarding offers the
seeded recovery journeys as samples. Claiming one clones the sample's medical
content (patient record, medications, appointments, care-plan knowledge base)
into a NEW patient owned by the claiming account: the user's identity (name,
optional birth year), the sample's medicine. Care-plan chunk text has the
sample patient's name swapped for the user's; embeddings are copied unchanged
because a name swap does not change medical retrieval.

``build_clone`` is pure and dict-based (no Beanie document construction, so it
is unit-tested without an initialized database); ``clone_journey`` wraps it
with the queries, document materialization, and inserts.
"""

import logging
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from src.models import Appointment, CarePlanChunk, Medication, Patient
from src.models.checkin_model import Checkin
from src.models.escalation_model import Escalation

logger = logging.getLogger(__name__)

# The seeded journeys offered as samples, keyed by seeded patient_code. Title
# and icon are presentation-only; everything else is read from the database.
JOURNEY_META: dict[str, dict[str, str]] = {
    "HW-1001": {"title": "Heart failure recovery", "icon": "🫀"},
    "HW-1002": {"title": "Knee replacement recovery", "icon": "🦵"},
    "HW-1003": {"title": "Type 2 diabetes onboarding", "icon": "🩸"},
    "HW-1004": {"title": "COPD recovery", "icon": "🫁"},
}

# Code alphabet avoids lookalikes (0/O, 1/I/L) so spoken codes survive voice.
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 4
_CODE_MAX_ATTEMPTS = 8

# Document fields never copied into a clone.
_BASE_EXCLUDE = {"id", "created_at", "updated_at", "patient_id"}

# Patient medical fields the clone inherits from the sample. Demographics
# (gender, city, state, phone, email, birth_date) are the user's own.
_PATIENT_MEDICAL_FIELDS = (
    "discharge_reason",
    "assigned_clinician",
    "follow_up_required",
    "follow_up_window_start",
    "follow_up_window_end",
    "follow_up_kind",
)


def split_name(display_name: str) -> tuple[str, str]:
    """Split a display name into (first, last).

    A single-word name puts the word in first_name and leaves last_name empty;
    consumers must never index ``last_name[0]`` unguarded.
    """
    parts = display_name.split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def swap_name_in_text(
    text: str,
    *,
    sample_first: str,
    sample_last: str,
    user_first: str,
    user_last: str,
) -> str:
    """Replace the sample patient's name with the user's in narrative text.

    Full name first, then lone first/last-name occurrences. A user without a
    last name falls back to their first name for lone last-name mentions
    ("Mrs. Chen" must never become "Mrs. ").
    """
    user_full = f"{user_first} {user_last}".strip()
    sample_full = f"{sample_first} {sample_last}".strip()
    out = text
    if sample_full:
        out = out.replace(sample_full, user_full)
    if sample_first:
        out = out.replace(sample_first, user_first)
    if sample_last:
        out = out.replace(sample_last, user_last or user_first)
    return out


def make_patient_code(length: int = _CODE_LENGTH) -> str:
    """A fresh random patient code like ``HW-7K3F`` (uniqueness checked by caller)."""
    rng = secrets.SystemRandom()
    return "HW-" + "".join(rng.choice(_CODE_ALPHABET) for _ in range(length))


@dataclass
class ClonePlan:
    """The personalized clone as plain dicts, ready to materialize and insert."""

    patient: dict[str, Any]
    medications: list[dict[str, Any]]
    appointments: list[dict[str, Any]]
    chunks: list[dict[str, Any]]
    checkins: list[dict[str, Any]]
    escalations: list[dict[str, Any]]


def build_clone(
    sample: dict[str, Any],
    medications: list[dict[str, Any]],
    appointments: list[dict[str, Any]],
    chunks: list[dict[str, Any]],
    *,
    display_name: str,
    birth_year: int | None,
    patient_id: str,
    patient_code: str,
    checkins: list[dict[str, Any]] | None = None,
    escalations: list[dict[str, Any]] | None = None,
    claim_time: datetime | None = None,
) -> ClonePlan:
    """Construct the personalized clone documents as dicts. Pure (no I/O).

    Inputs are ``model_dump()``-style dicts of the sample's documents.
    """
    first, last = split_name(display_name)

    patient: dict[str, Any] = {
        "patient_id": patient_id,
        "first_name": first,
        "last_name": last,
        "birth_date": date(birth_year, 1, 1) if birth_year else None,
        "patient_code": patient_code,
        "cloned_from": sample.get("patient_id"),
    }
    for field in _PATIENT_MEDICAL_FIELDS:
        patient[field] = sample.get(field)

    def _strip(doc: dict[str, Any], extra: set[str] | None = None) -> dict[str, Any]:
        drop = _BASE_EXCLUDE | (extra or set())
        return {k: v for k, v in doc.items() if k not in drop}

    cloned_meds = [{**_strip(m), "patient_id": patient_id} for m in medications]
    # cal_booking_uid is dropped: each user books their own follow-up, so a live
    # Cal.com booking on the sample must not be shared by every clone.
    cloned_appts = [
        {**_strip(a, {"cal_booking_uid"}), "patient_id": patient_id}
        for a in appointments
    ]
    cloned_chunks = [
        {
            "patient_id": patient_id,
            "source_file": c.get("source_file", ""),
            "chunk_index": c.get("chunk_index", 0),
            "text": swap_name_in_text(
                c.get("text", ""),
                sample_first=sample.get("first_name", ""),
                sample_last=sample.get("last_name", ""),
                user_first=first,
                user_last=last,
            ),
            "embedding": list(c.get("embedding", [])),
        }
        for c in chunks
    ]
    # Check-in/escalation history rides along, re-dated so the newest entry
    # lands one day before the claim: a fresh account asks "how has my week
    # been?" and gets a real, recent answer.
    history = list(checkins or []) + list(escalations or [])
    delta: timedelta | None = None
    if history and claim_time is not None:
        stamps = [d["created_at"] for d in history if d.get("created_at")]
        if stamps:
            delta = (claim_time - timedelta(days=1)) - max(stamps)

    def _redate(doc: dict[str, Any]) -> dict[str, Any]:
        out = {**_strip(doc), "patient_id": patient_id}
        original = doc.get("created_at")
        if original is not None and delta is not None:
            out["created_at"] = original + delta
        return out

    return ClonePlan(
        patient=patient,
        medications=cloned_meds,
        appointments=cloned_appts,
        chunks=cloned_chunks,
        checkins=[_redate(c) for c in (checkins or [])],
        escalations=[_redate(e) for e in (escalations or [])],
    )


@dataclass
class ClonedProfile:
    """The inserted personalized profile plus its content counts."""

    patient: Patient
    medication_count: int
    appointment_count: int
    chunk_count: int


async def _unused_patient_code() -> str:
    for attempt in range(_CODE_MAX_ATTEMPTS):
        # Widen after repeated collisions (effectively never at demo scale).
        code = make_patient_code(_CODE_LENGTH if attempt < 4 else _CODE_LENGTH + 2)
        existing = await Patient.find_one({"patient_code": code})
        if existing is None:
            return code
    raise RuntimeError("could not allocate a unique patient code")


async def clone_journey(
    sample: Patient, *, display_name: str, birth_year: int | None
) -> ClonedProfile:
    """Clone ``sample`` into a new personalized patient and insert everything."""
    medications = await Medication.find({"patient_id": sample.patient_id}).to_list()
    appointments = await Appointment.find({"patient_id": sample.patient_id}).to_list()
    chunks = await CarePlanChunk.find({"patient_id": sample.patient_id}).to_list()
    checkins = await Checkin.find({"patient_id": sample.patient_id}).to_list()
    escalations = await Escalation.find({"patient_id": sample.patient_id}).to_list()

    plan = build_clone(
        sample.model_dump(),
        [m.model_dump() for m in medications],
        [a.model_dump() for a in appointments],
        [c.model_dump() for c in chunks],
        display_name=display_name,
        birth_year=birth_year,
        patient_id=str(uuid.uuid4()),
        patient_code=await _unused_patient_code(),
        checkins=[c.model_dump() for c in checkins],
        escalations=[e.model_dump() for e in escalations],
        claim_time=datetime.now(UTC),
    )

    patient = Patient(**plan.patient)
    await patient.insert()
    if plan.medications:
        await Medication.insert_many([Medication(**m) for m in plan.medications])
    if plan.appointments:
        await Appointment.insert_many([Appointment(**a) for a in plan.appointments])
    if plan.chunks:
        await CarePlanChunk.insert_many([CarePlanChunk(**c) for c in plan.chunks])
    if plan.checkins:
        await Checkin.insert_many([Checkin(**c) for c in plan.checkins])
    if plan.escalations:
        await Escalation.insert_many([Escalation(**e) for e in plan.escalations])
    logger.info(
        "cloned journey %s -> %s (%d meds, %d appts, %d chunks)",
        sample.patient_code,
        patient.patient_code,
        len(plan.medications),
        len(plan.appointments),
        len(plan.chunks),
    )
    return ClonedProfile(
        patient=patient,
        medication_count=len(plan.medications),
        appointment_count=len(plan.appointments),
        chunk_count=len(plan.chunks),
    )
