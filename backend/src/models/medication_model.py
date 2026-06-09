from datetime import datetime
from typing import Annotated

from beanie import Indexed
from pydantic import Field

from src.models.base_model import TimestampedDocument


class Medication(TimestampedDocument):
    patient_id: Annotated[str, Indexed()]
    name: str
    code: str | None = None
    start: datetime | None = None
    stop: datetime | None = None
    reason: str | None = None
    instructions: str | None = None

    # F3 medication-schedule fields (authored; Synthea has no dose times/cautions).
    dosage: str | None = None
    frequency: str | None = None
    # HH:MM clinic-local times; empty means as-needed (PRN).
    schedule_times: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)

    class Settings:
        name = "medications"
