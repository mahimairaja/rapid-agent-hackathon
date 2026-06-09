from typing import Annotated

from beanie import Indexed

from src.models.base_model import TimestampedDocument


class Checkin(TimestampedDocument):
    """A routine symptom check-in recorded for a patient (F5).

    Routine symptom reports are written here; red flags are written to the
    ``escalations`` collection instead. ``severity`` leaves room for future
    levels; F5 writes only ``"routine"``.
    """

    patient_id: Annotated[str, Indexed()]
    reported_text: str
    severity: str = "routine"

    class Settings:
        name = "checkins"
