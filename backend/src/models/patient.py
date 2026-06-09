from datetime import date
from typing import Annotated

from beanie import Indexed

from src.models.base import TimestampedDocument


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

    class Settings:
        name = "patients"
