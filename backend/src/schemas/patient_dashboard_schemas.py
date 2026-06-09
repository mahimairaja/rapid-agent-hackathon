from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PatientDashboardRequest(BaseModel):
    patient_code: str = Field(min_length=1)
    time_zone: str | None = None

    @field_validator("patient_code", mode="after")
    @classmethod
    def normalize_patient_code(cls, value: str) -> str:
        return value.strip().upper()


class PatientDashboardPatient(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: str
    first_name: str
    last_name: str
    birth_date: date | None = None
    gender: str | None = None
    city: str | None = None
    state: str | None = None
    phone: str | None = None
    email: str | None = None
    patient_code: str | None = None
    discharge_reason: str | None = None
    assigned_clinician: str | None = None
    follow_up_required: bool | None = None
    follow_up_window_start: datetime | None = None
    follow_up_window_end: datetime | None = None
    follow_up_kind: str | None = None

    @field_validator("id", mode="before")
    @classmethod
    def stringify_id(cls, value: Any) -> str:
        return str(value)


class PatientDashboardMedication(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: str
    name: str
    code: str | None = None
    dosage: str | None = None
    frequency: str | None = None
    start: datetime | None = None
    stop: datetime | None = None
    reason: str | None = None
    instructions: str | None = None
    schedule_times: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)

    @field_validator("id", mode="before")
    @classmethod
    def stringify_id(cls, value: Any) -> str:
        return str(value)


class PatientDashboardAppointment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: str
    kind: str
    title: str | None = None
    start: datetime
    end: datetime | None = None
    provider: str | None = None
    location: str | None = None
    reason: str | None = None
    status: str
    cal_booking_uid: str | None = None
    follow_up_window_start: datetime | None = None
    follow_up_window_end: datetime | None = None
    follow_up_required: bool | None = None
    booked_at: datetime | None = None

    @field_validator("id", mode="before")
    @classmethod
    def stringify_id(cls, value: Any) -> str:
        return str(value)


class PatientDashboardResponse(BaseModel):
    patient: PatientDashboardPatient
    medications: list[PatientDashboardMedication]
    appointments: list[PatientDashboardAppointment]
