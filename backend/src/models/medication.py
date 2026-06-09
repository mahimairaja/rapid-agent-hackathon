from datetime import datetime
from typing import Annotated

from beanie import Indexed

from src.models.base import TimestampedDocument


class Medication(TimestampedDocument):
    patient_id: Annotated[str, Indexed()]
    name: str
    code: str | None = None
    start: datetime | None = None
    stop: datetime | None = None
    reason: str | None = None
    instructions: str | None = None

    class Settings:
        name = "medications"
