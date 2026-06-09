from typing import Annotated

from beanie import Indexed
from pydantic import EmailStr

from src.models.base import TimestampedDocument


class User(TimestampedDocument):
    email: Annotated[EmailStr, Indexed(unique=True)]
    hashed_password: str
    full_name: str | None = None
    is_active: bool = True
    is_superuser: bool = False

    class Settings:
        name = "users"
