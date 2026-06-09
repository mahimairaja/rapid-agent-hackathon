"""Default-deny verification gate for the recognition agent.

The gate fails safe: only tools in ``PUBLIC_TOOLS`` may run before the patient is
verified. Every other tool (including all future F2-F5 tools) is denied until
``patient_verified`` is true, with no per-tool registration, so a new
patient-data tool cannot accidentally ship without isolation.
"""

import logging
from typing import Any

from google.adk.tools import ToolContext
from google.adk.tools.base_tool import BaseTool

from src.agent.agent.session_state import is_verified

logger = logging.getLogger(__name__)

# The only tool intentionally allowed to run before identification.
PUBLIC_TOOLS = {"find_patient"}

_REFUSAL = {
    "status": "unverified",
    "message": (
        "I need to confirm who you are before I can share any plan details. "
        "Could you tell me your full name and date of birth, or your patient code?"
    ),
}


def verification_gate(
    tool: BaseTool, args: dict[str, Any], tool_context: ToolContext
) -> dict | None:
    """Block personalized tools until the patient is verified.

    Returning a dict skips the tool and uses the dict as its response; returning
    None lets the tool run.
    """
    if tool.name in PUBLIC_TOOLS:
        return None
    if is_verified(tool_context.state):
        return None
    logger.info("verification_gate blocked unverified tool: %s", tool.name)
    return dict(_REFUSAL)
