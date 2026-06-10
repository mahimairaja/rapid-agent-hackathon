"""Response schema for the live-session context endpoint (demo grounding panel).

The grounding panel ("What I know about you") renders the verified patient's
plan, medications, appointments, and care-plan chunks for the conversation's live
session. It reuses the dashboard patient/medication/appointment shapes so the two
patient-data surfaces stay consistent, and adds the care-plan chunk text so the
panel can highlight the exact snippet a grounded answer came from.
"""

from pydantic import BaseModel, Field

from src.schemas.patient_dashboard_schemas import (
    PatientDashboardAppointment,
    PatientDashboardMedication,
    PatientDashboardPatient,
)


class CarePlanChunkOut(BaseModel):
    text: str
    source_file: str
    chunk_index: int


class CarePlanOut(BaseModel):
    chunks: list[CarePlanChunkOut] = Field(default_factory=list)
    summary: str | None = None


class SessionContextResponse(BaseModel):
    """Verified patient context for one live session, or ``verified=false``.

    An unverified (or unknown / expired) session returns ``verified=false`` with
    the patient-data fields left empty, so the panel can show a placeholder.
    """

    verified: bool
    patient: PatientDashboardPatient | None = None
    medications: list[PatientDashboardMedication] = Field(default_factory=list)
    appointments: list[PatientDashboardAppointment] = Field(default_factory=list)
    care_plan: CarePlanOut | None = None
