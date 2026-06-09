from datetime import date
from typing import Annotated

from beanie import Indexed
from pymongo import ASCENDING, IndexModel

from src.models.base_model import TimestampedDocument


class Patient(TimestampedDocument):
    patient_id: Annotated[str, Indexed(unique=True)]
    first_name: str
    last_name: str
    birth_date: date | None = None
    gender: str | None = None
    city: str | None = None
    state: str | None = None
    phone: str | None = None
    email: str | None = None

    # F1 plan-recognition fields.
    patient_code: str | None = None
    discharge_reason: str | None = None
    assigned_clinician: str | None = None

    class Settings:
        name = "patients"
        # patient_code is an optional unique identifier (the unambiguous match
        # path). A partial unique index keeps set values unique while allowing any
        # number of patients with no code: a plain sparse index would not, because
        # Beanie persists a missing code as an explicit null and a sparse index
        # still treats null as an indexed value (so a second code-less patient
        # would collide). partialFilterExpression indexes only string codes.
        indexes = [
            IndexModel(
                [("patient_code", ASCENDING)],
                unique=True,
                partialFilterExpression={"patient_code": {"$type": "string"}},
                name="patient_code_unique",
            ),
        ]
