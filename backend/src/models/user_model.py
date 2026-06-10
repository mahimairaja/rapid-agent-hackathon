from typing import Annotated

from beanie import Indexed
from pydantic import EmailStr

from src.models.base_model import TimestampedDocument


class User(TimestampedDocument):
    email: Annotated[EmailStr, Indexed(unique=True)]
    hashed_password: str
    full_name: str | None = None
    is_active: bool = True
    is_superuser: bool = False

    # Journey onboarding: the account's personal patient profile, cloned from a
    # sample journey. Set once by POST /onboarding/claim; the patient_code is
    # what the frontend uses to identify the live session deterministically.
    patient_id: str | None = None
    patient_code: str | None = None

    class Settings:
        name = "users"
