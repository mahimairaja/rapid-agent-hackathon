"""DB-backed isolation tests (AC-HW-PLAN-002.1 and 002.2)."""

from types import SimpleNamespace

from src.agent.tools.guards import verification_gate
from src.agent.tools.patient_tools import find_patient, get_my_plan


def _ctx():
    return SimpleNamespace(state={})


async def test_get_my_plan_returns_only_verified_patient(seed_demo):
    ctx_a = _ctx()
    ctx_b = _ctx()
    await find_patient(
        full_name="Margaret Chen", date_of_birth="1948-03-12", tool_context=ctx_a
    )
    await find_patient(patient_code="HW-1002", tool_context=ctx_b)

    plan_a = await get_my_plan(tool_context=ctx_a)
    plan_b = await get_my_plan(tool_context=ctx_b)

    assert plan_a["plan"]["patient_name"] == "Margaret Chen"
    assert plan_b["plan"]["patient_name"] == "James Okafor"
    # Margaret's plan must not contain James's details.
    assert "Okafor" not in str(plan_a)
    assert plan_a["plan"]["discharge_reason"].startswith("Acute exacerbation")


async def test_get_my_plan_includes_best_effort_extras(seed_demo):
    ctx = _ctx()
    await find_patient(
        full_name="Margaret Chen", date_of_birth="1948-03-12", tool_context=ctx
    )
    plan = (await get_my_plan(tool_context=ctx))["plan"]
    assert plan["next_appointment"]["kind"] == "cardiology follow-up"
    assert "congestive heart failure" in plan["care_plan_snippet"].lower()


async def test_new_conversation_has_no_carryover(seed_demo):
    # Conversation 1 verifies Margaret and can read her plan.
    ctx1 = _ctx()
    await find_patient(
        full_name="Margaret Chen", date_of_birth="1948-03-12", tool_context=ctx1
    )
    assert (await get_my_plan(tool_context=ctx1))["status"] == "ok"

    # Conversation 2 is a brand-new session: empty state, nothing carried over.
    ctx2 = _ctx()
    blocked = verification_gate(SimpleNamespace(name="get_my_plan"), {}, ctx2)
    assert blocked is not None and blocked["status"] == "unverified"

    res = await get_my_plan(tool_context=ctx2)
    assert res["status"] == "unverified"
    assert "Margaret" not in str(res)
