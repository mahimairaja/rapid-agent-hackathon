from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# ---- Request payloads ------------------------------------------------------


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    # Self-service fields only. Privileged fields (is_active, is_superuser) are
    # intentionally NOT here to prevent mass-assignment privilege escalation.
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8)
    full_name: str | None = None


# ---- Responses -------------------------------------------------------------


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str | None = None
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("id", mode="before")
    @classmethod
    def _stringify_object_id(cls, value: object) -> str:
        return str(value)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
