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
from datetime import date, datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from src.core.database import close_db, init_db  # noqa: E402
from src.models import Appointment, Medication, Patient  # noqa: E402

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


async def seed() -> None:
    await init_db()

    patient_rows = _read_csv("patients.csv")
    patient_ids = [r["Id"] for r in patient_rows]

    # Idempotent: clear existing rows for these patients before inserting.
    await Patient.find({"patient_id": {"$in": patient_ids}}).delete()
    await Medication.find({"patient_id": {"$in": patient_ids}}).delete()
    await Appointment.find({"patient_id": {"$in": patient_ids}}).delete()

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
        )
        for r in patient_rows
    ]
    if patients:
        await Patient.insert_many(patients)

    medications = [
        Medication(
            patient_id=r["PATIENT"],
            name=r["DESCRIPTION"],
            code=r.get("CODE") or None,
            start=_parse_dt(r.get("START")),
            stop=_parse_dt(r.get("STOP")),
            reason=r.get("REASONDESCRIPTION") or None,
        )
        for r in _read_csv("medications.csv")
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
        if r.get("START")
    ]
    if appointments:
        await Appointment.insert_many(appointments)

    print(
        f"Seeded {len(patients)} patients, {len(medications)} medications, "
        f"{len(appointments)} appointments."
    )
    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())
