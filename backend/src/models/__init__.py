from src.models.appointment import Appointment
from src.models.base import TimestampedDocument
from src.models.care_plan import CarePlanChunk
from src.models.guideline import GuidelineChunk
from src.models.medication import Medication
from src.models.patient import Patient
from src.models.user import User

# Registered with Beanie at startup (src/db/mongo.py).
DOCUMENT_MODELS = [
    User,
    Patient,
    Medication,
    Appointment,
    CarePlanChunk,
    GuidelineChunk,
]

__all__ = [
    "DOCUMENT_MODELS",
    "Appointment",
    "CarePlanChunk",
    "GuidelineChunk",
    "Medication",
    "Patient",
    "TimestampedDocument",
    "User",
]
