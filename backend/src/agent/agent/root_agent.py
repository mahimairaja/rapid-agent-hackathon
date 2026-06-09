"""The Homeward patient-recognition ADK agent (F1).

Builds the root LLM agent with the recognition instruction, the patient tools,
and the default-deny verification gate. Construction is pure in-memory setup: the
FunctionTools query Beanie only at call time, after the FastAPI lifespan has
initialized the database, so importing this module during app construction is
safe.
"""

import os

from google.adk.agents import Agent

from src.agent.prompts.recognition_prompt import RECOGNITION_INSTRUCTION
from src.agent.tools.guards import verification_gate
from src.agent.tools.patient_tools import find_patient, get_my_plan
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


_export_gemini_env()

root_agent = Agent(
    name="recognition_agent",
    model=config.GEMINI_MODEL,
    instruction=RECOGNITION_INSTRUCTION,
    tools=[find_patient, get_my_plan],
    before_tool_callback=verification_gate,
)
