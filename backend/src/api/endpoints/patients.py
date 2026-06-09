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

router = APIRouter(prefix="/patients", tags=["patients"])


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def _is_active_medication(medication: Medication, now: datetime) -> bool:
    return (medication.start is None or _aware(medication.start) <= now) and (
        medication.stop is None or _aware(medication.stop) >= now
    )


def _is_upcoming_appointment(appointment: Appointment, now: datetime) -> bool:
    return (
        appointment.status.lower() not in {"completed", "cancelled"}
        and _aware(appointment.start) >= now
    )


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

    active_medications = sorted(
        (med for med in medications if _is_active_medication(med, now)),
        key=lambda med: (
            _aware(med.start) if med.start else datetime.min.replace(tzinfo=UTC),
            med.name,
        ),
    )
    upcoming_appointments = sorted(
        (appt for appt in appointments if _is_upcoming_appointment(appt, now)),
        key=lambda appt: _aware(appt.start),
    )

    return PatientDashboardResponse(
        patient=PatientDashboardPatient.model_validate(patient),
        medications=[
            PatientDashboardMedication.model_validate(med) for med in active_medications
        ],
        appointments=[
            PatientDashboardAppointment.model_validate(appt)
            for appt in upcoming_appointments
        ],
    )
