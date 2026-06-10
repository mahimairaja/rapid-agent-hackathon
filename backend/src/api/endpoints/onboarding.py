"""Journey onboarding endpoints: list sample journeys, claim one as a profile.

Listing is public (the gallery renders before any patient exists). Claiming
requires the account token: it clones the selected sample into a personal
patient profile (the user's name, the sample's medical content and knowledge
base) and links it to the account. Claiming is idempotent: an account that
already owns a profile gets it back unchanged.
"""

import logging

from fastapi import APIRouter, HTTPException

from src.api.endpoints.users import CurrentUser
from src.models import Appointment, CarePlanChunk, Medication, Patient
from src.schemas.onboarding_schemas import (
    ClaimCounts,
    ClaimRequest,
    ClaimResponse,
    JourneyOut,
)
from src.services.journey_service import JOURNEY_META, clone_journey

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


async def _counts_for(patient_id: str) -> ClaimCounts:
    return ClaimCounts(
        medications=await Medication.find({"patient_id": patient_id}).count(),
        appointments=await Appointment.find({"patient_id": patient_id}).count(),
        care_plan_chunks=await CarePlanChunk.find({"patient_id": patient_id}).count(),
    )


@router.get("/journeys", response_model=list[JourneyOut])
async def list_journeys() -> list[JourneyOut]:
    """The seeded sample journeys, presented as onboarding cards."""
    samples = await Patient.find(
        {"patient_code": {"$in": list(JOURNEY_META)}, "cloned_from": None}
    ).to_list()
    by_code = {p.patient_code: p for p in samples}

    journeys: list[JourneyOut] = []
    # Iterate the meta map so card order is stable regardless of query order.
    for code, meta in JOURNEY_META.items():
        patient = by_code.get(code)
        if patient is None:
            continue
        medication_count = await Medication.find(
            {"patient_id": patient.patient_id}
        ).count()
        appointments = await Appointment.find(
            {"patient_id": patient.patient_id}
        ).to_list()
        kinds = sorted({a.kind for a in appointments if a.kind})
        journeys.append(
            JourneyOut(
                journey_code=code,
                title=meta["title"],
                icon=meta["icon"],
                condition=patient.discharge_reason,
                clinician=patient.assigned_clinician,
                sample_name=f"{patient.first_name} {patient.last_name}".strip(),
                medication_count=medication_count,
                appointment_kinds=kinds,
            )
        )
    return journeys


@router.post("/claim", response_model=ClaimResponse)
async def claim_journey(payload: ClaimRequest, current_user: CurrentUser):
    """Clone the selected journey into the account's personal profile."""
    # Idempotent: an account keeps its first profile.
    if current_user.patient_id:
        existing = await Patient.find_one({"patient_id": current_user.patient_id})
        if existing is not None and existing.patient_code:
            # cloned_from stores the SAMPLE's patient_id; resolve its code.
            source = (
                await Patient.find_one({"patient_id": existing.cloned_from})
                if existing.cloned_from
                else None
            )
            return ClaimResponse(
                patient_id=existing.patient_id,
                patient_code=existing.patient_code,
                first_name=existing.first_name,
                last_name=existing.last_name,
                journey_code=(source.patient_code if source else None)
                or payload.journey_code,
                counts=await _counts_for(existing.patient_id),
            )
        # Dangling link (profile deleted out of band): fall through and re-clone.

    journey_code = payload.journey_code.strip().upper()
    if journey_code not in JOURNEY_META:
        raise HTTPException(status_code=404, detail="Unknown journey")
    sample = await Patient.find_one({"patient_code": journey_code, "cloned_from": None})
    if sample is None:
        raise HTTPException(
            status_code=409,
            detail="Sample journeys are not seeded; run the seed script first.",
        )

    profile = await clone_journey(
        sample,
        display_name=payload.display_name.strip(),
        birth_year=payload.birth_year,
    )

    # Link last, so a failed clone never strands a dangling account link.
    current_user.patient_id = profile.patient.patient_id
    current_user.patient_code = profile.patient.patient_code
    await current_user.save()

    return ClaimResponse(
        patient_id=profile.patient.patient_id,
        patient_code=profile.patient.patient_code or "",
        first_name=profile.patient.first_name,
        last_name=profile.patient.last_name,
        journey_code=journey_code,
        counts=ClaimCounts(
            medications=profile.medication_count,
            appointments=profile.appointment_count,
            care_plan_chunks=profile.chunk_count,
        ),
    )
