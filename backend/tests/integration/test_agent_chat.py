"""Agent-reply tests for the observable recognition behavior (AC-HW-PLAN-001.1/.2).

The scripted-LLM test is deterministic and needs no Gemini key: a stand-in model
drives find_patient then get_my_plan and emits a final reply, so we assert the
agent names the patient and states a real plan detail. The live test exercises
the real Gemini model and is skipped without GOOGLE_API_KEY.
"""

import os

import pytest
from google.adk.agents import Agent
from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_response import LlmResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from src.agent.prompts.recognition_prompt import RECOGNITION_INSTRUCTION
from src.agent.tools.guards import verification_gate
from src.agent.tools.patient_tools import find_patient, get_my_plan


class _ScriptedLlm(BaseLlm):
    """Deterministic stand-in: find_patient -> get_my_plan -> final reply."""

    model: str = "scripted-test-model"

    @staticmethod
    def supported_models() -> list[str]:
        return ["scripted-test-model"]

    async def generate_content_async(self, llm_request, stream=False):
        responded: set[str] = set()
        detail: str | None = None
        for content in llm_request.contents or []:
            for part in content.parts or []:
                fr = getattr(part, "function_response", None)
                if fr is None:
                    continue
                responded.add(fr.name)
                resp = fr.response or {}
                if fr.name == "find_patient":
                    detail = resp.get("plan_detail") or detail
                if fr.name == "get_my_plan":
                    detail = (resp.get("plan") or {}).get("discharge_reason") or detail

        if "find_patient" not in responded:
            call = types.FunctionCall(
                name="find_patient",
                args={"full_name": "Margaret Chen", "date_of_birth": "1948-03-12"},
            )
            yield LlmResponse(
                content=types.Content(
                    role="model", parts=[types.Part(function_call=call)]
                )
            )
            return
        if "get_my_plan" not in responded:
            call = types.FunctionCall(name="get_my_plan", args={})
            yield LlmResponse(
                content=types.Content(
                    role="model", parts=[types.Part(function_call=call)]
                )
            )
            return

        text = (
            f"Thanks, Margaret Chen. I've found your discharge plan. "
            f"You were discharged due to {detail}."
        )
        yield LlmResponse(
            content=types.Content(role="model", parts=[types.Part(text=text)])
        )


async def _drive(runner, session_service, message: str) -> str:
    session = await session_service.create_session(
        app_name="homeward_test", user_id="u", state={}
    )
    content = types.Content(role="user", parts=[types.Part(text=message)])
    reply = ""
    async for event in runner.run_async(
        user_id="u", session_id=session.id, new_message=content
    ):
        if event.is_final_response() and event.content and event.content.parts:
            for part in event.content.parts:
                if getattr(part, "text", None):
                    reply += part.text
    return reply


async def test_scripted_agent_confirms_name_and_states_detail(seed_demo):
    session_service = InMemorySessionService()
    agent = Agent(
        model=_ScriptedLlm(),
        name="recognition_agent_test",
        instruction=RECOGNITION_INSTRUCTION,
        tools=[find_patient, get_my_plan],
        before_tool_callback=verification_gate,
    )
    runner = Runner(
        agent=agent, app_name="homeward_test", session_service=session_service
    )

    reply = await _drive(runner, session_service, "I'm Margaret Chen, DOB 1948-03-12")
    # AC-HW-PLAN-001.1: the reply names the patient and acknowledges the plan.
    assert "Margaret" in reply
    assert "plan" in reply.lower()
    # AC-HW-PLAN-001.2: the reply states a real detail from her own plan.
    assert "congestive heart failure" in reply.lower()


@pytest.mark.skipif(
    not os.environ.get("GOOGLE_API_KEY"),
    reason="needs GOOGLE_API_KEY for the live Gemini agent",
)
async def test_live_agent_recognizes_and_states_detail(seed_demo):
    from src.agent.agent.agent_runner import run_turn

    sid, reply1 = await run_turn(
        None, "Hello, I'm Margaret Chen, date of birth 12 March 1948."
    )
    _, reply2 = await run_turn(sid, "Why was I in the hospital?")
    combined = f"{reply1} {reply2}".lower()
    assert "margaret" in combined
    assert "heart failure" in combined
