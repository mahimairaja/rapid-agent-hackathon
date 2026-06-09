from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, description="The patient's message.")
    session_id: str | None = Field(
        default=None,
        description="Server-issued session id; omit to start a new conversation.",
    )


class ChatResponse(BaseModel):
    session_id: str
    reply: str
