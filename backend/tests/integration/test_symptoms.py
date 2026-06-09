"""DB-backed tests for the F5 triage tool (AC-HW-TRIAGE-001 and 002)."""

from types import SimpleNamespace

from src.agent.agent.session_state import set_verified
from src.agent.tools.symptom_tools import triage_symptom
from src.models import Checkin, Escalation


def _ctx(patient_id: str):
    state: dict = {}
    set_verified(state, patient_id=patient_id, name="Test Patient")
    return SimpleNamespace(state=state)


async def test_red_flag_writes_urgent_escalation(seed_demo):
    res = await triage_symptom(
        "I have crushing chest pain and I can't breathe",
        tool_context=_ctx("pid-margaret"),
    )
    assert res["status"] == "red_flag"
    assert "911" in res["emergency_message"]

    escalations = await Escalation.find(
        Escalation.patient_id == "pid-margaret"
    ).to_list()
    assert len(escalations) == 1
    assert escalations[0].kind == "symptom_red_flag"
    assert escalations[0].level == "urgent"
    assert escalations[0].status == "open"
    assert "chest pain" in escalations[0].message.lower()

    # A red flag is escalated, not filed as a routine check-in.
    checkins = await Checkin.find(Checkin.patient_id == "pid-margaret").to_list()
    assert checkins == []


async def test_routine_writes_checkin_no_escalation(seed_demo):
    res = await triage_symptom(
        "I feel a little tired today", tool_context=_ctx("pid-margaret")
    )
    assert res["status"] == "routine"

    checkins = await Checkin.find(Checkin.patient_id == "pid-margaret").to_list()
    assert len(checkins) == 1
    assert checkins[0].severity == "routine"
    assert "tired" in checkins[0].reported_text.lower()

    escalations = await Escalation.find(
        Escalation.patient_id == "pid-margaret"
    ).to_list()
    assert escalations == []


async def test_record_is_scoped_to_verified_patient(seed_demo):
    await triage_symptom("I feel a bit sore", tool_context=_ctx("pid-margaret"))

    margaret = await Checkin.find(Checkin.patient_id == "pid-margaret").to_list()
    james = await Checkin.find(Checkin.patient_id == "pid-james").to_list()
    assert len(margaret) == 1
    assert james == []


async def test_empty_report_is_rejected(seed_demo):
    res = await triage_symptom("   ", tool_context=_ctx("pid-margaret"))
    assert res["status"] == "empty"
    assert await Checkin.find(Checkin.patient_id == "pid-margaret").to_list() == []


async def test_triage_unverified():
    res = await triage_symptom("chest pain", tool_context=SimpleNamespace(state={}))
    assert res["status"] == "unverified"
