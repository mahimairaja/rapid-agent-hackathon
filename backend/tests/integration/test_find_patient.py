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


async def test_find_by_patient_code_is_case_insensitive(seed_demo):
    ctx = _ctx()
    res = await find_patient(patient_code="hw-1002", tool_context=ctx)
    assert res["status"] == "found"
    assert res["patient_name"] == "James Okafor"
    assert ctx.state[PATIENT_ID] == "pid-james"


async def test_large_same_dob_cohort_still_identifies_unique_patient(seed_demo):
    # Many patients share Margaret's birth date (distinct names): a capped query
    # could drop her, but the unbounded query must still find the unique match.
    extras = [
        Patient(
            patient_id=f"pid-dob-{i}",
            first_name=f"Person{i}",
            last_name="Sameday",
            birth_date=date(1948, 3, 12),
            patient_code=f"HW-DOB{i}",
        )
        for i in range(8)
    ]
    await Patient.insert_many(extras)

    ctx = _ctx()
    res = await find_patient(
        full_name="Margaret Chen", date_of_birth="1948-03-12", tool_context=ctx
    )
    assert res["status"] == "found"
    assert res["patient_name"] == "Margaret Chen"


async def test_large_same_dob_cohort_with_real_ambiguity_not_found(seed_demo):
    extras = [
        Patient(
            patient_id=f"pid-amb-{i}",
            first_name=f"Other{i}",
            last_name="Person",
            birth_date=date(1948, 3, 12),
            patient_code=f"HW-AMB{i}",
        )
        for i in range(8)
    ]
    extras.append(
        Patient(
            patient_id="pid-twin",
            first_name="Margaret",
            last_name="Chen",
            birth_date=date(1948, 3, 12),
            patient_code="HW-TWIN",
        )
    )
    await Patient.insert_many(extras)

    ctx = _ctx()
    res = await find_patient(
        full_name="Margaret Chen", date_of_birth="1948-03-12", tool_context=ctx
    )
    assert res["status"] == "not_found"
    assert PATIENT_VERIFIED not in ctx.state
    assert set(res.keys()) == {"status"}


async def test_multiple_codeless_patients_are_allowed(seed_demo):
    # The partial unique index must permit any number of patients with no code
    # (a plain sparse index would reject the second null on insert).
    await Patient(
        patient_id="pid-nocode-a",
        first_name="No",
        last_name="CodeA",
        birth_date=date(1960, 1, 1),
    ).insert()
    await Patient(
        patient_id="pid-nocode-b",
        first_name="No",
        last_name="CodeB",
        birth_date=date(1961, 2, 2),
    ).insert()
    assert await Patient.find_one(Patient.patient_id == "pid-nocode-b") is not None


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
