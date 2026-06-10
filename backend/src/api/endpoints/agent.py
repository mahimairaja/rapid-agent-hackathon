"""Text-first chat endpoint that drives the recognition agent (F1).

Public for the demo (real authentication and identity proofing are out of scope
per the blueprint). A null ``session_id`` starts a fresh conversation; the
returned id is reused for follow-up turns and dropped to start a new one.

Also exposes the live-session grounding context: the verified patient's plan,
medications, appointments, and care-plan chunks for one voice/chat session, so
the demo's grounding panel can show what answers are generated from.
"""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException

from src.agent.agent.agent_runner import run_turn
from src.models import Appointment, CarePlanChunk, Medication, Patient
from src.schemas.agent_schemas import ChatRequest, ChatResponse
from src.schemas.patient_dashboard_schemas import (
    PatientDashboardAppointment,
    PatientDashboardMedication,
    PatientDashboardPatient,
)
from src.schemas.session_context_schemas import (
    CarePlanChunkOut,
    CarePlanOut,
    SessionContextResponse,
)
from src.services.patient_view import active_medications, upcoming_appointments
from src.voice.session import verified_patient_id_for

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    try:
        session_id, reply = await run_turn(
            payload.session_id,
            payload.message,
            time_zone=payload.time_zone,
        )
    except Exception:
        logger.warning("agent chat turn failed", exc_info=True)
        raise HTTPException(
            status_code=502, detail="The assistant is unavailable right now."
        ) from None
    return ChatResponse(session_id=session_id, reply=reply)


@router.get("/session/{session_id}/context", response_model=SessionContextResponse)
async def session_context(session_id: str) -> SessionContextResponse:
    """Return the verified patient's grounding context for a live session.

    Public for the demo and keyed by the server-minted live session id (only the
    client that opened the socket knows it). An unverified, unknown, or expired
    session returns ``verified=false`` so the panel shows a placeholder.
    """
    patient_id = await verified_patient_id_for(session_id)
    if not patient_id:
        return SessionContextResponse(verified=False)

    patient = await Patient.find_one({"patient_id": patient_id})
    if patient is None:
        return SessionContextResponse(verified=False)

    now = datetime.now(UTC)
    medications = await Medication.find({"patient_id": patient_id}).to_list()
    appointments = await Appointment.find({"patient_id": patient_id}).to_list()
    chunks = await CarePlanChunk.find({"patient_id": patient_id}).to_list()

    return SessionContextResponse(
        verified=True,
        patient=PatientDashboardPatient.model_validate(patient),
        medications=[
            PatientDashboardMedication.model_validate(med)
            for med in active_medications(medications, now)
        ],
        appointments=[
            PatientDashboardAppointment.model_validate(appt)
            for appt in upcoming_appointments(appointments, now)
        ],
        care_plan=CarePlanOut(
            chunks=[
                CarePlanChunkOut(
                    text=chunk.text,
                    source_file=chunk.source_file,
                    chunk_index=chunk.chunk_index,
                )
                for chunk in sorted(chunks, key=lambda c: c.chunk_index)
            ]
        ),
    )
