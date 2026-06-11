"""Journey onboarding endpoints: list sample journeys, claim one as a profile.

Listing is public (the gallery renders before any patient exists). Claiming
requires the account token: it clones the selected sample into a personal
patient profile (the user's name, the sample's medical content and knowledge
base) and links it to the account. Claiming is idempotent: an account that
already owns a profile gets it back unchanged.
"""

import logging
import os
import tempfile
import uuid
from datetime import date
from functools import partial

import anyio
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from src.api.endpoints.users import CurrentUser
from src.models import Appointment, CarePlanChunk, Medication, Patient
from src.schemas.onboarding_schemas import (
    ClaimCounts,
    ClaimRequest,
    ClaimResponse,
    JourneyOut,
)
from src.services import document_service
from src.services.chunking_service import chunk_text
from src.services.embeddings_service import embed_texts
from src.services.journey_service import (
    JOURNEY_META,
    _unused_patient_code,
    clone_journey,
    split_name,
)

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


_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_UPLOAD_JOURNEY_CODE = "UPLOAD"


@router.post("/upload", response_model=ClaimResponse)
async def upload_discharge(
    current_user: CurrentUser,
    file: UploadFile = File(...),
    display_name: str = Form(...),
    birth_year: int | None = Form(default=None),
):
    """Build a personal profile and knowledge base from an uploaded PDF.

    The PDF is parsed locally (LiteParse, no cloud), chunked and embedded
    with the same pipeline as the seeded care plans, so Maya answers from
    the patient's own document. No medications or appointments are
    extracted in this version; those tabs start empty for uploads.
    """
    # Idempotent like /claim: an account keeps its first profile.
    if current_user.patient_id:
        existing = await Patient.find_one({"patient_id": current_user.patient_id})
        if existing is not None and existing.patient_code:
            return ClaimResponse(
                patient_id=existing.patient_id,
                patient_code=existing.patient_code,
                first_name=existing.first_name,
                last_name=existing.last_name,
                journey_code=_UPLOAD_JOURNEY_CODE,
                counts=await _counts_for(existing.patient_id),
            )

    name = (file.filename or "").lower()
    if not name.endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Upload a PDF document.")
    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="PDF is larger than 10 MB.")

    tmp_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        text = await anyio.to_thread.run_sync(
            document_service.extract_pdf_text, tmp_path
        )
    except HTTPException:
        raise
    except Exception:
        logger.warning("pdf parse failed", exc_info=True)
        raise HTTPException(
            status_code=422, detail="We could not read that PDF."
        ) from None
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    if len(text) < document_service.MIN_TEXT_CHARS:
        raise HTTPException(
            status_code=422,
            detail=(
                "We could not read enough text from that PDF. "
                "Try a text-based discharge summary."
            ),
        )

    chunks = chunk_text(text)
    embeddings = await anyio.to_thread.run_sync(partial(embed_texts, chunks))

    first, last = split_name(display_name.strip())
    patient = Patient(
        patient_id=str(uuid.uuid4()),
        first_name=first,
        last_name=last,
        birth_date=date(birth_year, 1, 1) if birth_year else None,
        patient_code=await _unused_patient_code(),
        discharge_reason="Personal recovery plan (uploaded)",
    )
    await patient.insert()
    await CarePlanChunk.insert_many(
        [
            CarePlanChunk(
                patient_id=patient.patient_id,
                source_file=file.filename or "upload.pdf",
                chunk_index=i,
                text=chunk,
                embedding=embedding,
            )
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings, strict=True))
        ]
    )

    # Link last, so a failed ingest never strands a dangling account link.
    current_user.patient_id = patient.patient_id
    current_user.patient_code = patient.patient_code
    await current_user.save()

    logger.info(
        "uploaded plan ingested for %s (%d chunks)",
        patient.patient_code,
        len(chunks),
    )
    return ClaimResponse(
        patient_id=patient.patient_id,
        patient_code=patient.patient_code or "",
        first_name=patient.first_name,
        last_name=patient.last_name,
        journey_code=_UPLOAD_JOURNEY_CODE,
        counts=ClaimCounts(medications=0, appointments=0, care_plan_chunks=len(chunks)),
    )
