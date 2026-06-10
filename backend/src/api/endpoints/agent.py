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
from src.agent.tools.appointment_tools import (
    _available_follow_up_slots,
    _booking_payload,
    _current_follow_up,
    _find_requested_slot,
    _follow_up_window,
    _mirror_booking,
    _parse_iso,
    _slot_payload,
    _zone_info,
)
from src.models import Appointment, CarePlanChunk, Medication, Patient
from src.schemas.agent_schemas import ChatRequest, ChatResponse
from src.schemas.patient_dashboard_schemas import (
    PatientDashboardAppointment,
    PatientDashboardMedication,
    PatientDashboardPatient,
)
from src.schemas.session_booking_schemas import (
    FollowUpWindowOut,
    SessionBookRequest,
    SessionBookResponse,
    SessionSlotsResponse,
)
from src.schemas.session_context_schemas import (
    CarePlanChunkOut,
    CarePlanOut,
    SessionContextResponse,
)
from src.services.calcom_service import CalComError, get_calcom_client
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


async def _session_patient(session_id: str) -> Patient | None:
    patient_id = await verified_patient_id_for(session_id)
    if not patient_id:
        return None
    return await Patient.find_one({"patient_id": patient_id})


def _iso_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


@router.get("/session/{session_id}/slots", response_model=SessionSlotsResponse)
async def session_slots(
    session_id: str, time_zone: str | None = None
) -> SessionSlotsResponse:
    """Available follow-up slots for the calendar widget.

    Same trust model and status vocabulary as the F4 agent tools, whose helpers
    this reuses, so the widget can never book outside the follow-up window.
    """
    patient = await _session_patient(session_id)
    if patient is None:
        return SessionSlotsResponse(status="unverified")
    zone = _zone_info(time_zone)
    if zone is None:
        return SessionSlotsResponse(status="invalid_time_zone")

    window = _follow_up_window(patient)
    if isinstance(window, dict):
        return SessionSlotsResponse(status=window["status"])

    current = await _current_follow_up(patient)
    slots = await _available_follow_up_slots(
        patient,
        zone=zone,
        booking_uid_to_reschedule=current.cal_booking_uid if current else None,
    )
    if isinstance(slots, dict):
        return SessionSlotsResponse(status=slots["status"])

    start, end = window
    return SessionSlotsResponse(
        status="ok",
        window=FollowUpWindowOut(start_iso=_iso_utc(start), end_iso=_iso_utc(end)),
        current_booking=_booking_payload(current, zone) if current else None,
        slots=[_slot_payload(slot, zone) for slot in slots],
    )


@router.post("/session/{session_id}/book", response_model=SessionBookResponse)
async def session_book(
    session_id: str, payload: SessionBookRequest
) -> SessionBookResponse:
    """Book (or reschedule) the follow-up from the calendar widget.

    Books when no current follow-up exists, reschedules otherwise; writes the
    same Appointment mirror the agent tools write, so the agent, dashboard, and
    grounding panel stay consistent.
    """
    patient = await _session_patient(session_id)
    if patient is None:
        return SessionBookResponse(status="unverified")
    zone = _zone_info(payload.time_zone)
    if zone is None:
        return SessionBookResponse(status="invalid_time_zone")
    requested = _parse_iso(payload.start_iso)
    if requested is None:
        return SessionBookResponse(status="invalid_time")

    current = await _current_follow_up(patient)
    slots = await _available_follow_up_slots(
        patient,
        zone=zone,
        booking_uid_to_reschedule=current.cal_booking_uid if current else None,
    )
    if isinstance(slots, dict):
        return SessionBookResponse(status=slots["status"])
    selected = _find_requested_slot(requested, slots)
    if selected is None:
        return SessionBookResponse(status="unavailable")

    try:
        client = get_calcom_client()
        if current is not None and current.cal_booking_uid:
            booking = await client.reschedule_booking(
                current.cal_booking_uid, selected, patient, time_zone=zone.key
            )
        else:
            booking = await client.create_booking(selected, patient, time_zone=zone.key)
    except CalComError:
        logger.warning("calendar widget booking failed", exc_info=True)
        return SessionBookResponse(status="scheduler_unavailable")

    appointment = await _mirror_booking(patient, booking, existing=current)
    return SessionBookResponse(
        status="rescheduled" if current is not None else "booked",
        booking=_booking_payload(appointment, zone),
    )
