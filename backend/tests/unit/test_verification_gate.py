"""Unit tests for the default-deny gate and state-only tool guards.

No database: the verified branches return before any query runs.
"""

from types import SimpleNamespace

from src.agent.agent.session_state import PATIENT_ID, PATIENT_NAME, PATIENT_VERIFIED
from src.agent.tools.guards import verification_gate
from src.agent.tools.patient_tools import find_patient, get_my_plan


def _tool(name):
    return SimpleNamespace(name=name)


def _ctx(state=None):
    return SimpleNamespace(state=dict(state or {}))


def test_find_patient_is_public_when_unverified():
    assert verification_gate(_tool("find_patient"), {}, _ctx()) is None


def test_personalized_tool_blocked_when_unverified():
    res = verification_gate(_tool("get_my_plan"), {}, _ctx())
    assert res is not None and res["status"] == "unverified"


def test_personalized_tool_allowed_when_verified():
    ctx = _ctx({PATIENT_VERIFIED: True, PATIENT_ID: "p1"})
    assert verification_gate(_tool("get_my_plan"), {}, ctx) is None


def test_unknown_tool_blocked_when_unverified_default_deny():
    # A future F2-F5 tool that nobody remembered to register is denied by default.
    res = verification_gate(_tool("some_future_med_tool"), {}, _ctx())
    assert res is not None and res["status"] == "unverified"


async def test_find_patient_noops_when_already_verified():
    ctx = _ctx(
        {PATIENT_VERIFIED: True, PATIENT_ID: "p1", PATIENT_NAME: "Margaret Chen"}
    )
    res = await find_patient(
        full_name="Someone Else", date_of_birth="1990-01-01", tool_context=ctx
    )
    assert res["status"] == "already_verified"
    assert res["patient_name"] == "Margaret Chen"
    assert ctx.state[PATIENT_ID] == "p1"


async def test_get_my_plan_refuses_when_unverified():
    res = await get_my_plan(tool_context=_ctx())
    assert res["status"] == "unverified"


async def test_find_patient_insufficient_details_returns_not_found():
    res = await find_patient(tool_context=_ctx())
    assert res["status"] == "not_found"


async def test_find_patient_invalid_dob_returns_not_found():
    res = await find_patient(
        full_name="Margaret Chen", date_of_birth="not-a-date", tool_context=_ctx()
    )
    assert res["status"] == "not_found"
