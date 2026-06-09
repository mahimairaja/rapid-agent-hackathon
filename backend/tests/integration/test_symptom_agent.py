"""Agent-flow tests for F5 through the production wiring (build_recognition_agent).

A scripted stand-in model drives the real triage tool + verification gate, so
these are deterministic and need no Gemini key. They prove the red-flag emergency
message leads the reply and is escalated, and that a routine symptom is recorded.
"""

from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_response import LlmResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from src.agent.agent.root_agent import build_recognition_agent
from src.models import Checkin, Escalation

_APP = "homeward_test"
_MARGARET = {"full_name": "Margaret Chen", "date_of_birth": "1948-03-12"}


def _call(name: str, args: dict) -> LlmResponse:
    part = types.Part(function_call=types.FunctionCall(name=name, args=args))
    return LlmResponse(content=types.Content(role="model", parts=[part]))


def _say(text: str) -> LlmResponse:
    return LlmResponse(
        content=types.Content(role="model", parts=[types.Part(text=text)])
    )


def _responses(llm_request) -> dict:
    seen: dict = {}
    for content in llm_request.contents or []:
        for part in content.parts or []:
            fr = getattr(part, "function_response", None)
            if fr is not None:
                seen[fr.name] = fr.response or {}
    return seen


async def _drive(runner, service, message):
    session = await service.create_session(app_name=_APP, user_id="u", state={})
    content = types.Content(role="user", parts=[types.Part(text=message)])
    reply, calls = "", []
    async for event in runner.run_async(
        user_id="u", session_id=session.id, new_message=content
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
    return reply, calls


class _RedFlagLlm(BaseLlm):
    """Scripted: identify, report a red-flag symptom, relay the emergency text."""

    model: str = "scripted-red-flag"

    @staticmethod
    def supported_models() -> list[str]:
        return ["scripted-red-flag"]

    async def generate_content_async(self, llm_request, stream=False):
        seen = _responses(llm_request)
        if "find_patient" not in seen:
            yield _call("find_patient", _MARGARET)
            return
        if "triage_symptom" not in seen:
            yield _call(
                "triage_symptom",
                {"reported_text": "I have crushing chest pain and can't breathe"},
            )
            return
        # Relay the tool's mandated emergency message verbatim, first.
        yield _say(seen["triage_symptom"].get("emergency_message", ""))


class _RoutineLlm(BaseLlm):
    """Scripted: identify, report a routine symptom, acknowledge."""

    model: str = "scripted-routine"

    @staticmethod
    def supported_models() -> list[str]:
        return ["scripted-routine"]

    async def generate_content_async(self, llm_request, stream=False):
        seen = _responses(llm_request)
        if "find_patient" not in seen:
            yield _call("find_patient", _MARGARET)
            return
        if "triage_symptom" not in seen:
            yield _call("triage_symptom", {"reported_text": "I feel a little tired"})
            return
        yield _say("Thanks, I've noted you're feeling tired. Rest when you can.")


async def test_agent_leads_with_emergency_message_and_escalates(seed_demo):
    service = InMemorySessionService()
    runner = Runner(
        agent=build_recognition_agent(model=_RedFlagLlm()),
        app_name=_APP,
        session_service=service,
    )
    reply, calls = await _drive(runner, service, "I'm Margaret Chen, I have chest pain")
    assert "find_patient" in calls and "triage_symptom" in calls
    assert "911" in reply  # the emergency guidance reached the patient

    escalations = await Escalation.find(
        Escalation.patient_id == "pid-margaret"
    ).to_list()
    assert len(escalations) == 1
    assert escalations[0].level == "urgent"


async def test_agent_records_routine_checkin(seed_demo):
    service = InMemorySessionService()
    runner = Runner(
        agent=build_recognition_agent(model=_RoutineLlm()),
        app_name=_APP,
        session_service=service,
    )
    reply, calls = await _drive(runner, service, "I'm Margaret Chen, I feel tired")
    assert "triage_symptom" in calls
    assert reply

    checkins = await Checkin.find(Checkin.patient_id == "pid-margaret").to_list()
    assert len(checkins) == 1
    assert (
        await Escalation.find(Escalation.patient_id == "pid-margaret").to_list() == []
    )
