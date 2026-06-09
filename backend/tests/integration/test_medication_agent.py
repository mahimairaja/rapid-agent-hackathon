"""Agent-flow tests for F3 through the production wiring (build_recognition_agent).

A scripted stand-in model drives the real tools + verification gate, so these are
deterministic and need no Gemini key. They prove the medication tools are reached
only after identification (the gate) and that the answers come from the tools.
"""

from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_response import LlmResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from src.agent.agent.root_agent import build_recognition_agent
from src.models import Escalation

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


class _MedListLlm(BaseLlm):
    model: str = "scripted-med-list"

    @staticmethod
    def supported_models() -> list[str]:
        return ["scripted-med-list"]

    async def generate_content_async(self, llm_request, stream=False):
        seen = _responses(llm_request)
        if "find_patient" not in seen:
            yield _call("find_patient", _MARGARET)
            return
        if "get_medications" not in seen:
            yield _call("get_medications", {})
            return
        meds = seen["get_medications"].get("medications") or []
        names = ", ".join(m["name"] for m in meds)
        yield _say(f"Your current medications are: {names}.")


class _FlagLlm(BaseLlm):
    model: str = "scripted-flag"

    @staticmethod
    def supported_models() -> list[str]:
        return ["scripted-flag"]

    async def generate_content_async(self, llm_request, stream=False):
        seen = _responses(llm_request)
        if "find_patient" not in seen:
            yield _call("find_patient", _MARGARET)
            return
        if "flag_pharmacist" not in seen:
            yield _call(
                "flag_pharmacist",
                {"question": "Can I take ibuprofen with my lisinopril?"},
            )
            return
        status = seen["flag_pharmacist"].get("status")
        yield _say(f"I've flagged that for your pharmacist (status: {status}).")


async def test_agent_lists_medications_after_identification(seed_demo):
    service = InMemorySessionService()
    runner = Runner(
        agent=build_recognition_agent(model=_MedListLlm()),
        app_name=_APP,
        session_service=service,
    )
    reply, calls = await _drive(runner, service, "I'm Margaret Chen, what do I take?")
    assert "find_patient" in calls and "get_medications" in calls
    assert "Furosemide" in reply


async def test_agent_flags_uncertain_interaction_to_pharmacist(seed_demo):
    service = InMemorySessionService()
    runner = Runner(
        agent=build_recognition_agent(model=_FlagLlm()),
        app_name=_APP,
        session_service=service,
    )
    reply, calls = await _drive(
        runner, service, "I'm Margaret Chen, can I take ibuprofen with my lisinopril?"
    )
    assert "flag_pharmacist" in calls
    assert "flagged" in reply.lower()

    docs = await Escalation.find(Escalation.patient_id == "pid-margaret").to_list()
    assert len(docs) == 1
    assert docs[0].level == "non-urgent"
