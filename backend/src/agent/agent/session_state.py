"""Session-state keys and helpers for the recognition agent.

Identity lives in per-session ADK state with plain keys (no ``user:`` prefix), so
it is never promoted to cross-session user-scoped storage and is discarded when
the conversation ends. Keeping the keys and access helpers in one place means the
tools and the verification gate cannot drift apart on key names.
"""

from typing import Any

PATIENT_ID = "patient_id"
PATIENT_VERIFIED = "patient_verified"
PATIENT_NAME = "patient_name"


def is_verified(state: Any) -> bool:
    """True once a single patient has been confidently identified this session."""
    return bool(state.get(PATIENT_VERIFIED))


def verified_patient_id(state: Any) -> str | None:
    """The verified patient's id, or None if the session is not yet verified."""
    if not is_verified(state):
        return None
    patient_id = state.get(PATIENT_ID)
    return str(patient_id) if patient_id else None


def patient_name(state: Any) -> str | None:
    name = state.get(PATIENT_NAME)
    return str(name) if name else None


def set_verified(state: Any, *, patient_id: str, name: str) -> None:
    """Mark the session as belonging to exactly this patient."""
    state[PATIENT_ID] = patient_id
    state[PATIENT_NAME] = name
    state[PATIENT_VERIFIED] = True
