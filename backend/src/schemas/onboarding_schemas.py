"""Schemas for journey onboarding (sample-profile selection)."""

from datetime import datetime

from pydantic import BaseModel, Field


class JourneyOut(BaseModel):
    journey_code: str
    title: str
    icon: str
    condition: str | None = None
    clinician: str | None = None
    sample_name: str
    medication_count: int
    appointment_kinds: list[str] = Field(default_factory=list)


class ClaimRequest(BaseModel):
    journey_code: str = Field(min_length=1)
    display_name: str = Field(min_length=1, max_length=80)
    birth_year: int | None = Field(default=None, ge=1900, le=datetime.now().year)


class ClaimCounts(BaseModel):
    medications: int
    appointments: int
    care_plan_chunks: int


class ClaimResponse(BaseModel):
    patient_id: str
    patient_code: str
    first_name: str
    last_name: str
    journey_code: str
    counts: ClaimCounts
