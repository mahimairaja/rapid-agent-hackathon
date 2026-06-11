"""Seed synthetic patients, medications, and appointments into MongoDB Atlas.

Reads Synthea-shaped CSVs from ``backend/data/synthea/`` and upserts them into
the ``patients``, ``medications``, and ``appointments`` collections. Idempotent:
re-running replaces the rows for the seeded patients.

Run from the backend directory:

    uv run python scripts/seed_patients.py
"""

import asyncio
import csv
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from src.core.database import close_db, init_db  # noqa: E402
from src.models import (  # noqa: E402
    Appointment,
    Checkin,
    Escalation,
    Medication,
    Patient,
)

DATA_DIR = BACKEND_DIR / "data" / "synthea"


def _read_csv(name: str) -> list[dict[str, str]]:
    path = DATA_DIR / name
    with path.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value[:10])


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _parse_bool(value: str | None) -> bool | None:
    if value is None or value == "":
        return None
    return value.strip().lower() in {"1", "true", "yes", "y"}


def _split(value: str | None, sep: str) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(sep) if part.strip()]


_HISTORY_NOTES = {
    "heart": [
        "Feeling puffy around the ankles in the evening.",
        "Weighed myself like the plan says, about the same as yesterday.",
        "Slept better with the extra pillow.",
        "Short walk around the block went fine.",
        "Less swelling today and breathing feels easier.",
        "Good day overall, stayed on the fluid limit.",
    ],
    "knee": [
        "Knee is stiff in the morning but loosens up.",
        "Did the physio exercises twice today.",
        "Managed the stairs once with the rail.",
        "Swelling is down after icing.",
        "Walked further than yesterday with the walker.",
        "Best day so far, barely needed the second pill.",
    ],
    "default": [
        "Feeling a bit tired today.",
        "Kept up with the plan, nothing new to report.",
        "Slightly better than yesterday.",
        "Appetite is back to normal.",
        "Did my exercises and rested after.",
        "Feeling steadily better.",
    ],
}


def _build_history(
    patient_rows: list[dict[str, str]],
) -> tuple[list[Checkin], list[Escalation]]:
    """Curated week of routine check-ins (pain trending down) per patient."""
    now = datetime.now(UTC)
    pains = [7, 6, 5, 4, 3, 3]
    checkins: list[Checkin] = []
    escalations: list[Escalation] = []
    for row in patient_rows:
        reason = (row.get("DISCHARGE_REASON") or "").lower()
        if "heart" in reason or "chf" in reason:
            notes = _HISTORY_NOTES["heart"]
        elif "knee" in reason:
            notes = _HISTORY_NOTES["knee"]
        else:
            notes = _HISTORY_NOTES["default"]
        for i, (pain, note) in enumerate(zip(pains, notes, strict=True)):
            day_offset = 7 - i  # days -7 .. -2; day -1 stays free post-clone
            checkins.append(
                Checkin(
                    patient_id=row["Id"],
                    reported_text=(
                        f"Symptom check-in: my pain level is {pain}/10. {note}"
                    ),
                    severity="routine",
                    created_at=now - timedelta(days=day_offset, hours=i % 3),
                )
            )
        if "heart" in reason or "chf" in reason:
            escalations.append(
                Escalation(
                    patient_id=row["Id"],
                    kind="symptom_red_flag",
                    level="urgent",
                    message=(
                        "Symptom check-in: sudden shortness of breath at rest "
                        "[breathing]"
                    ),
                    created_at=now - timedelta(days=4, hours=2),
                )
            )
    return checkins, escalations


async def seed() -> None:
    await init_db()
    try:
        patient_rows = _read_csv("patients.csv")
        patient_ids = [r["Id"] for r in patient_rows]
        target = set(patient_ids)

        # Idempotent: clear existing rows for these patients before inserting.
        await Patient.find({"patient_id": {"$in": patient_ids}}).delete()
        await Medication.find({"patient_id": {"$in": patient_ids}}).delete()
        await Appointment.find({"patient_id": {"$in": patient_ids}}).delete()
        await Checkin.find({"patient_id": {"$in": patient_ids}}).delete()
        await Escalation.find({"patient_id": {"$in": patient_ids}}).delete()

        patients = [
            Patient(
                patient_id=r["Id"],
                first_name=r["FIRST"],
                last_name=r["LAST"],
                birth_date=_parse_date(r.get("BIRTHDATE")),
                gender=r.get("GENDER") or None,
                city=r.get("CITY") or None,
                state=r.get("STATE") or None,
                phone=r.get("PHONE") or None,
                email=r.get("EMAIL") or None,
                patient_code=(r.get("PATIENT_CODE") or "").strip().upper() or None,
                discharge_reason=r.get("DISCHARGE_REASON") or None,
                assigned_clinician=r.get("ASSIGNED_CLINICIAN") or None,
                follow_up_required=_parse_bool(r.get("FOLLOW_UP_REQUIRED")),
                follow_up_window_start=_parse_dt(r.get("FOLLOW_UP_WINDOW_START")),
                follow_up_window_end=_parse_dt(r.get("FOLLOW_UP_WINDOW_END")),
                follow_up_kind=r.get("FOLLOW_UP_KIND") or None,
            )
            for r in patient_rows
        ]
        if patients:
            await Patient.insert_many(patients)

        # Only seed meds/appointments for the patients we cleared above, so the
        # delete and insert scopes match and re-runs stay idempotent.
        medications = [
            Medication(
                patient_id=r["PATIENT"],
                name=r["DESCRIPTION"],
                code=r.get("CODE") or None,
                start=_parse_dt(r.get("START")),
                stop=_parse_dt(r.get("STOP")),
                reason=r.get("REASONDESCRIPTION") or None,
                dosage=r.get("DOSAGE") or None,
                frequency=r.get("FREQUENCY") or None,
                schedule_times=_split(r.get("SCHEDULE_TIMES"), ";"),
                cautions=_split(r.get("CAUTIONS"), "|"),
            )
            for r in _read_csv("medications.csv")
            if r["PATIENT"] in target
        ]
        if medications:
            await Medication.insert_many(medications)

        # Appointment.start is required; skip rows without a START value.
        appointments = [
            Appointment(
                patient_id=r["PATIENT"],
                kind=r["KIND"],
                start=_parse_dt(r["START"]),
                end=_parse_dt(r.get("END")),
                provider=r.get("PROVIDER") or None,
                location=r.get("LOCATION") or None,
                reason=r.get("REASON") or None,
                status=r.get("STATUS") or "scheduled",
            )
            for r in _read_csv("appointments.csv")
            if r["PATIENT"] in target and r.get("START")
        ]
        if appointments:
            await Appointment.insert_many(appointments)

        # A week of check-in history per sample patient, so "how has my week
        # been?" has something real to aggregate (cloned and re-dated for new
        # accounts by the journey claim).
        checkins, escalations = _build_history(patient_rows)
        if checkins:
            await Checkin.insert_many(checkins)
        if escalations:
            await Escalation.insert_many(escalations)

        print(
            f"Seeded {len(patients)} patients, {len(medications)} medications, "
            f"{len(appointments)} appointments, {len(checkins)} checkins, "
            f"{len(escalations)} escalations."
        )
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(seed())
