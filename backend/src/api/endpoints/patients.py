from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends

from src.core.exceptions import NotFoundError
from src.core.security import get_current_user
from src.models import Appointment, Medication, Patient
from src.schemas.patient_dashboard_schemas import (
    PatientDashboardAppointment,
    PatientDashboardMedication,
    PatientDashboardPatient,
    PatientDashboardRequest,
    PatientDashboardResponse,
)
from src.services.patient_view import active_medications, upcoming_appointments

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("/dashboard", response_model=PatientDashboardResponse)
async def get_patient_dashboard(
    payload: PatientDashboardRequest,
    _current_user_id: Annotated[str, Depends(get_current_user)],
) -> PatientDashboardResponse:
    patient = await Patient.find_one({"patient_code": payload.patient_code})
    if patient is None:
        raise NotFoundError(detail="Patient code not found")

    now = datetime.now(UTC)
    medications = await Medication.find({"patient_id": patient.patient_id}).to_list()
    appointments = await Appointment.find({"patient_id": patient.patient_id}).to_list()

    return PatientDashboardResponse(
        patient=PatientDashboardPatient.model_validate(patient),
        medications=[
            PatientDashboardMedication.model_validate(med)
            for med in active_medications(medications, now)
        ],
        appointments=[
            PatientDashboardAppointment.model_validate(appt)
            for appt in upcoming_appointments(appointments, now)
        ],
    )
