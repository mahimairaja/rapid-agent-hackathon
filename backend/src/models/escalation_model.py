from typing import Annotated

from beanie import Indexed

from src.models.base_model import TimestampedDocument


class Escalation(TimestampedDocument):
    """A care-team escalation.

    F3 writes only non-urgent ``pharmacist_question`` items (deferring uncertain
    drug interactions). The model is intentionally minimal so F5 (symptom triage /
    red-flag escalation) and F7 (care-team view) can extend the taxonomy without
    redefining it.
    """

    patient_id: Annotated[str, Indexed()]
    kind: str
    level: str
    message: str
    status: str = "open"

    class Settings:
        name = "escalations"
