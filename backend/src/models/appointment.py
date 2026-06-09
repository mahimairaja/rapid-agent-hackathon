from datetime import datetime
from typing import Annotated

from beanie import Indexed

from src.models.base import TimestampedDocument


class Appointment(TimestampedDocument):
    patient_id: Annotated[str, Indexed()]
    kind: str
    start: datetime
    end: datetime | None = None
    provider: str | None = None
    location: str | None = None
    reason: str | None = None
    status: str = "scheduled"

    class Settings:
        name = "appointments"
