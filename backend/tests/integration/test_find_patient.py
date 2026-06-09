"""DB-backed tests for find_patient (AC-HW-PLAN-001.1/.2 data path, 001.3)."""

from datetime import date
from types import SimpleNamespace

from src.agent.agent.session_state import PATIENT_ID, PATIENT_VERIFIED
from src.agent.tools.patient_tools import find_patient
from src.models import Patient


def _ctx():
    return SimpleNamespace(state={})


async def test_find_by_name_and_dob_sets_state(seed_demo):
    ctx = _ctx()
    res = await find_patient(
        full_name="Margaret Chen", date_of_birth="1948-03-12", tool_context=ctx
    )
    assert res["status"] == "found"
    assert res["patient_name"] == "Margaret Chen"
    assert (
        res["plan_detail"] == "Acute exacerbation of chronic congestive heart failure"
    )
    assert ctx.state[PATIENT_VERIFIED] is True
    assert ctx.state[PATIENT_ID] == "pid-margaret"


async def test_find_by_patient_code(seed_demo):
    ctx = _ctx()
    res = await find_patient(patient_code="HW-1002", tool_context=ctx)
    assert res["status"] == "found"
    assert res["patient_name"] == "James Okafor"
    assert ctx.state[PATIENT_ID] == "pid-james"


async def test_wrong_details_not_found_and_no_state(seed_demo):
    ctx = _ctx()
    res = await find_patient(
        full_name="Margaret Chen", date_of_birth="1990-01-01", tool_context=ctx
    )
    assert res["status"] == "not_found"
    assert PATIENT_VERIFIED not in ctx.state


async def test_ambiguous_match_not_found_and_no_leak(seed_demo):
    # A second patient sharing Margaret's exact name and date of birth.
    await Patient(
        patient_id="pid-twin",
        first_name="Margaret",
        last_name="Chen",
        birth_date=date(1948, 3, 12),
        patient_code="HW-9999",
        discharge_reason="A different condition",
    ).insert()

    ctx = _ctx()
    res = await find_patient(
        full_name="Margaret Chen", date_of_birth="1948-03-12", tool_context=ctx
    )
    assert res["status"] == "not_found"
    assert PATIENT_VERIFIED not in ctx.state
    # No candidate name or plan detail may leak on an ambiguous match.
    assert set(res.keys()) == {"status"}
