"""The Homeward patient-recognition ADK agent (F1).

Builds the root LLM agent with the recognition instruction, the patient tools,
and the default-deny verification gate. Construction is pure in-memory setup: the
FunctionTools query Beanie only at call time, after the FastAPI lifespan has
initialized the database, so importing this module during app construction is
safe.
"""

import os

from google.adk.agents import Agent
from google.adk.models.base_llm import BaseLlm

from src.agent.prompts.appointment_prompt import APPOINTMENT_INSTRUCTION
from src.agent.prompts.medication_prompt import MEDICATION_INSTRUCTION
from src.agent.prompts.recognition_prompt import RECOGNITION_INSTRUCTION
from src.agent.prompts.recovery_prompt import RECOVERY_INSTRUCTION
from src.agent.tools.appointment_tools import (
    book_follow_up_slot,
    get_follow_up_booking,
    list_follow_up_slots,
    reschedule_follow_up,
)
from src.agent.tools.guards import verification_gate
from src.agent.tools.medication_tools import (
    flag_pharmacist,
    get_medications,
    get_next_dose,
)
from src.agent.tools.patient_tools import find_patient, get_my_plan
from src.agent.tools.recovery_tools import answer_recovery_question
from src.core.config import config


def _export_gemini_env() -> None:
    """Expose Gemini credentials to google-genai/ADK, which read os.environ.

    Config stays the single source of truth; we forward it to the environment so
    the SDK actually consumes it. ``setdefault`` lets a real environment variable
    (for example a Cloud Run secret) win if one is already set.
    """
    os.environ.setdefault(
        "GOOGLE_GENAI_USE_VERTEXAI",
        "true" if config.GOOGLE_GENAI_USE_VERTEXAI else "false",
    )
    if config.GOOGLE_API_KEY is not None:
        os.environ.setdefault(
            "GOOGLE_API_KEY", config.GOOGLE_API_KEY.get_secret_value()
        )


def build_recognition_agent(model: BaseLlm | str | None = None) -> Agent:
    """Construct the recognition agent with its tools and verification gate.

    Production calls this with no argument (the Gemini model from config); tests
    pass a scripted ``BaseLlm`` so they exercise the same wiring (tools + gate) as
    production, and dropping the gate here would fail those tests.
    """
    return Agent(
        name="recognition_agent",
        model=model or config.GEMINI_MODEL,
        instruction="\n\n".join(
            [
                RECOGNITION_INSTRUCTION,
                RECOVERY_INSTRUCTION,
                MEDICATION_INSTRUCTION,
                APPOINTMENT_INSTRUCTION,
            ]
        ),
        tools=[
            find_patient,
            get_my_plan,
            answer_recovery_question,
            get_medications,
            get_next_dose,
            flag_pharmacist,
            list_follow_up_slots,
            book_follow_up_slot,
            get_follow_up_booking,
            reschedule_follow_up,
        ],
        before_tool_callback=verification_gate,
    )


_export_gemini_env()

root_agent = build_recognition_agent()
