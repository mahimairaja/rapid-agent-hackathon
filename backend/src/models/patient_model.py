from datetime import UTC, date, datetime
from typing import Annotated

from beanie import Indexed
from pydantic import field_validator
from pymongo import ASCENDING, IndexModel

from src.models.base_model import TimestampedDocument


def _utc_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC).replace(microsecond=0)


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

    patient_code: str | None = None
    discharge_reason: str | None = None
    assigned_clinician: str | None = None

    follow_up_required: bool | None = None
    follow_up_window_start: datetime | None = None
    follow_up_window_end: datetime | None = None
    follow_up_kind: str | None = None

    # Journey onboarding: set on profiles cloned from a seeded sample (the
    # source sample's patient_id). Seeded samples have it unset, which is how
    # the journeys listing excludes clones.
    cloned_from: str | None = None

    @field_validator("follow_up_window_start", "follow_up_window_end", mode="after")
    @classmethod
    def normalize_follow_up_window_utc(cls, value: datetime | None) -> datetime | None:
        return _utc_datetime(value)

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
