"""Agent-reply tests for the observable recognition behavior (AC-HW-PLAN-001/002).

These drive the SAME wiring production uses (build_recognition_agent: tools +
verification gate), with a scripted stand-in model so they are deterministic and
need no Gemini key. The live test exercises real Gemini and is opt-in
(``@pytest.mark.live``, excluded from the default CI run).
"""

import os

import pytest
from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_response import LlmResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from src.agent.agent.root_agent import build_recognition_agent

_APP = "homeward_test"


def _call(name: str, args: dict) -> LlmResponse:
    part = types.Part(function_call=types.FunctionCall(name=name, args=args))
    return LlmResponse(content=types.Content(role="model", parts=[part]))


def _say(text: str) -> LlmResponse:
    return LlmResponse(
        content=types.Content(role="model", parts=[types.Part(text=text)])
    )


def _responses(llm_request) -> dict:
    """Map of tool name -> its function_response dict seen so far this turn."""
    seen: dict = {}
    for content in llm_request.contents or []:
        for part in content.parts or []:
            fr = getattr(part, "function_response", None)
            if fr is not None:
                seen[fr.name] = fr.response or {}
    return seen


class _IdentifyThenPlanLlm(BaseLlm):
    """Scripted: find_patient -> get_my_plan -> reply built from get_my_plan only."""

    model: str = "scripted-identify-then-plan"

    @staticmethod
    def supported_models() -> list[str]:
        return ["scripted-identify-then-plan"]

    async def generate_content_async(self, llm_request, stream=False):
        seen = _responses(llm_request)
        if "find_patient" not in seen:
            yield _call(
                "find_patient",
                {"full_name": "Margaret Chen", "date_of_birth": "1948-03-12"},
            )
            return
        if "get_my_plan" not in seen:
            yield _call("get_my_plan", {})
            return
        # Build the reply ONLY from get_my_plan's response, so a broken or gated
        # get_my_plan fails the test (find_patient never returns assigned_clinician).
        plan = seen["get_my_plan"].get("plan") or {}
        clinician = plan.get("assigned_clinician") or "unknown clinician"
        reason = plan.get("discharge_reason") or "unknown reason"
        yield _say(
            f"Thanks, Margaret Chen. I've found your discharge plan. Your clinician "
            f"is {clinician} and you were discharged for {reason}."
        )


class _PlanFirstLlm(BaseLlm):
    """Scripted: attempt get_my_plan BEFORE identifying, to hit the gate's deny path."""

    model: str = "scripted-plan-first"

    @staticmethod
    def supported_models() -> list[str]:
        return ["scripted-plan-first"]

    async def generate_content_async(self, llm_request, stream=False):
        seen = _responses(llm_request)
        if "get_my_plan" not in seen:
            yield _call("get_my_plan", {})
            return
        yield _say(
            "I'm sorry, I can't share any plan details until I confirm who you are."
        )


async def _drive(runner, session_service, message, *, session_id=None, user_id="u"):
    if session_id is None:
        session = await session_service.create_session(
            app_name=_APP, user_id=user_id, state={}
        )
        session_id = session.id
    content = types.Content(role="user", parts=[types.Part(text=message)])
    reply = ""
    calls: list[str] = []
    async for event in runner.run_async(
        user_id=user_id, session_id=session_id, new_message=content
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                fc = getattr(part, "function_call", None)
                if fc is not None:
                    calls.append(fc.name)
        if event.is_final_response() and event.content and event.content.parts:
            for part in event.content.parts:
                if getattr(part, "text", None):
                    reply += part.text
    return session_id, reply, calls


async def test_scripted_agent_confirms_name_and_states_detail(seed_demo):
    service = InMemorySessionService()
    runner = Runner(
        agent=build_recognition_agent(model=_IdentifyThenPlanLlm()),
        app_name=_APP,
        session_service=service,
    )
    _, reply, calls = await _drive(runner, service, "I'm Margaret Chen, DOB 1948-03-12")

    # AC-HW-PLAN-001.1: names the patient and acknowledges the plan.
    assert "Margaret" in reply
    assert "plan" in reply.lower()
    # AC-HW-PLAN-001.2: states a real detail that ONLY get_my_plan returns.
    assert "Helen Park" in reply
    assert "find_patient" in calls and "get_my_plan" in calls


async def test_unverified_personalized_tool_blocked_end_to_end(seed_demo):
    service = InMemorySessionService()
    runner = Runner(
        agent=build_recognition_agent(model=_PlanFirstLlm()),
        app_name=_APP,
        session_service=service,
    )
    sid, reply, calls = await _drive(runner, service, "What is my discharge reason?")

    # The gate ran (the model attempted get_my_plan) but no plan detail leaked.
    assert "get_my_plan" in calls
    assert "congestive heart failure" not in reply.lower()
    assert "Margaret" not in reply
    session = await service.get_session(app_name=_APP, user_id="u", session_id=sid)
    assert not session.state.get("patient_verified")


async def test_no_cross_session_carryover(seed_demo):
    # Use ONE service and the SAME fixed user id production uses, so a regression
    # that promoted identity to user-scoped (user:-prefixed) state would leak.
    service = InMemorySessionService()
    user = "patient"

    runner_a = Runner(
        agent=build_recognition_agent(model=_IdentifyThenPlanLlm()),
        app_name=_APP,
        session_service=service,
    )
    sid_a, reply_a, _ = await _drive(
        runner_a, service, "I'm Margaret Chen, DOB 1948-03-12", user_id=user
    )
    assert "Margaret" in reply_a
    session_a = await service.get_session(app_name=_APP, user_id=user, session_id=sid_a)
    assert session_a.state.get("patient_verified") is True
    # Identity must stay session-scoped, never promoted to user-scoped storage.
    assert all(not key.startswith("user:") for key in session_a.state)

    runner_b = Runner(
        agent=build_recognition_agent(model=_PlanFirstLlm()),
        app_name=_APP,
        session_service=service,
    )
    sid_b, reply_b, _ = await _drive(
        runner_b, service, "What is my discharge reason?", user_id=user
    )
    assert sid_b != sid_a
    session_b = await service.get_session(app_name=_APP, user_id=user, session_id=sid_b)
    assert not session_b.state.get("patient_verified")
    assert "Margaret" not in reply_b
    assert "congestive heart failure" not in reply_b.lower()


@pytest.mark.live
@pytest.mark.skipif(
    not os.environ.get("GOOGLE_API_KEY"),
    reason="needs GOOGLE_API_KEY for the live Gemini agent",
)
async def test_live_agent_recognizes_and_states_detail(seed_demo):
    from src.agent.agent.agent_runner import run_turn

    sid, reply1 = await run_turn(
        None, "Hello, I'm Margaret Chen, my date of birth is 1948-03-12."
    )
    _, reply2 = await run_turn(sid, "Why was I in the hospital?")
    combined = f"{reply1} {reply2}".lower()
    assert "margaret" in combined
    assert "heart failure" in combined
