from src.models.appointment_model import Appointment
from src.models.base_model import TimestampedDocument
from src.models.care_plan_model import CarePlanChunk
from src.models.checkin_model import Checkin
from src.models.escalation_model import Escalation
from src.models.guideline_model import GuidelineChunk
from src.models.medication_model import Medication
from src.models.patient_model import Patient
from src.models.user_model import User

# Registered with Beanie at startup (src/core/database.py).
DOCUMENT_MODELS = [
    User,
    Patient,
    Medication,
    Appointment,
    CarePlanChunk,
    GuidelineChunk,
    Escalation,
    Checkin,
]

__all__ = [
    "DOCUMENT_MODELS",
    "Appointment",
    "CarePlanChunk",
    "Checkin",
    "Escalation",
    "GuidelineChunk",
    "Medication",
    "Patient",
    "TimestampedDocument",
    "User",
]
