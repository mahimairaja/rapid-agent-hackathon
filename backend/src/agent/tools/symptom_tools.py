"""Symptom triage tool for F5.

Follows the F1/F3/F4 isolation rule: the model never supplies a patient_id. The
tool reads the verified patient id from session state and is protected by the
default-deny gate. A red flag is matched deterministically by ``classify_symptom``
and the urgent escalation is written by the tool itself, so the care-team alert is
guaranteed even if the model rephrases the spoken reply.
"""

import logging

from google.adk.tools import ToolContext

from src.agent.agent.session_state import verified_patient_id
from src.agent.tools.redflags import classify_symptom
from src.models import Checkin, Escalation

logger = logging.getLogger(__name__)

_UNVERIFIED = {
    "status": "unverified",
    "message": "No patient has been identified in this conversation yet.",
}


async def triage_symptom(reported_text: str, *, tool_context: ToolContext) -> dict:
    """Record a reported symptom and flag red-flag emergencies for the patient.

    Pass the patient's own words. A routine symptom is recorded as a check-in. A
    defined red-flag symptom is recorded as an urgent escalation and the returned
    ``emergency_message`` must be delivered to the patient first and verbatim.
    """
    patient_id = verified_patient_id(tool_context.state)
    if not patient_id:
        return dict(_UNVERIFIED)

    text = (reported_text or "").strip()
    if not text:
        return {"status": "empty"}

    try:
        status, rule_id, message = classify_symptom(text)
        if status == "red_flag":
            await Escalation(
                patient_id=patient_id,
                kind="symptom_red_flag",
                level="urgent",
                message=f"{text} [{rule_id}]",
            ).insert()
            return {
                "status": "red_flag",
                "rule_id": rule_id,
                "emergency_message": message,
            }
        await Checkin(
            patient_id=patient_id,
            reported_text=text,
            severity="routine",
        ).insert()
        return {"status": "routine"}
    except Exception:
        logger.warning("triage_symptom failed", exc_info=True)
        return {"status": "error"}
