"""Integration test harness: a real MongoDB, seeded with demo patients.

Requires ``MONGODB_URI`` in the environment (tests skip cleanly without it). Uses
a dedicated test database (``MONGODB_TEST_DB``, default ``homeward_test``), never
the app's ``homeward`` database, and wipes the collections before and after each
test. Care plans are inserted directly with empty embeddings, so no Voyage key is
needed.
"""

import os
from datetime import UTC, date, datetime

import pytest
import pytest_asyncio
from beanie import init_beanie
from pymongo import AsyncMongoClient

from src.core.config import config  # noqa: F401  (ensures .env is loaded)
from src.models import (
    DOCUMENT_MODELS,
    Appointment,
    CarePlanChunk,
    Medication,
    Patient,
)

_COLLECTIONS = (
    "patients",
    "medications",
    "appointments",
    "care_plans",
    "guidelines",
    "users",
    "escalations",
    "checkins",
)


@pytest_asyncio.fixture
async def db():
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        pytest.skip("MONGODB_URI not set; skipping DB-backed integration tests")
    test_db = os.environ.get("MONGODB_TEST_DB", "homeward_test")
    client = AsyncMongoClient(uri)
    database = client[test_db]
    # allow_index_dropping reconciles a stale index definition (e.g. an older
    # sparse patient_code index) so the suite runs on a reused test database.
    await init_beanie(
        database=database,
        document_models=DOCUMENT_MODELS,
        allow_index_dropping=True,
    )
    for name in _COLLECTIONS:
        await database[name].delete_many({})
    try:
        yield database
    finally:
        for name in _COLLECTIONS:
            await database[name].delete_many({})
        await client.close()


@pytest_asyncio.fixture
async def seed_demo(db):
    """Two distinct patients, plus a care-plan chunk and a future appointment."""
    margaret = Patient(
        patient_id="pid-margaret",
        first_name="Margaret",
        last_name="Chen",
        birth_date=date(1948, 3, 12),
        email="margaret.chen@example.com",
        patient_code="HW-1001",
        discharge_reason="Acute exacerbation of chronic congestive heart failure",
        assigned_clinician="Dr. Helen Park (Cardiology)",
        follow_up_required=True,
        follow_up_window_start=datetime(2099, 1, 1, 8, 0, tzinfo=UTC),
        follow_up_window_end=datetime(2099, 1, 3, 17, 0, tzinfo=UTC),
        follow_up_kind="cardiology follow-up",
    )
    james = Patient(
        patient_id="pid-james",
        first_name="James",
        last_name="Okafor",
        birth_date=date(1972, 11, 5),
        email="james.okafor@example.com",
        patient_code="HW-1002",
        discharge_reason="Elective right total knee replacement",
        assigned_clinician="Dr. Marcus Reed (Orthopedics)",
        follow_up_required=False,
    )
    await Patient.insert_many([margaret, james])

    await CarePlanChunk(
        patient_id="pid-margaret",
        source_file="margaret.md",
        chunk_index=0,
        text="Discharge summary: congestive heart failure care plan.",
    ).insert()
    await Appointment(
        patient_id="pid-margaret",
        kind="cardiology follow-up",
        start=datetime(2099, 1, 1, 9, 0, tzinfo=UTC),
        provider="Dr. Helen Park",
    ).insert()

    # Margaret: two active scheduled tablets (so "tablet" is ambiguous) plus one
    # stopped medication (must be excluded from the active list).
    await Medication.insert_many(
        [
            Medication(
                patient_id="pid-margaret",
                name="Furosemide 40 MG Oral Tablet",
                dosage="40 mg",
                frequency="once daily in the morning",
                schedule_times=["08:00"],
                cautions=["Take earlier in the day to limit nighttime urination"],
            ),
            Medication(
                patient_id="pid-margaret",
                name="Lisinopril 10 MG Oral Tablet",
                dosage="10 mg",
                frequency="once daily",
                schedule_times=["08:00"],
                cautions=["Avoid potassium-containing salt substitutes"],
            ),
            Medication(
                patient_id="pid-margaret",
                name="Prednisone 20 MG Oral Tablet",
                dosage="20 mg",
                frequency="once daily",
                schedule_times=["08:00"],
                stop=datetime(2020, 1, 1, tzinfo=UTC),
            ),
        ]
    )
    # James: an as-needed (PRN) medication, also used for cross-patient isolation.
    await Medication(
        patient_id="pid-james",
        name="Oxycodone 5 MG Oral Tablet",
        dosage="5 mg",
        frequency="as needed for pain",
        schedule_times=[],
        cautions=["Do not drink alcohol"],
    ).insert()

    return {"margaret": margaret, "james": james}
