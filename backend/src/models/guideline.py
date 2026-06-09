from typing import Annotated

from beanie import Indexed
from pydantic import Field

from src.models.base import TimestampedDocument


class GuidelineChunk(TimestampedDocument):
    """A chunk of a public-domain federal guideline, with its embedding.

    Used by grounded retrieval (F2/F3); the vector index is created separately
    (scripts/create_indexes.py).
    """

    source_id: Annotated[str, Indexed()]
    title: str
    url: str | None = None
    license: str | None = None
    chunk_index: int
    text: str
    embedding: list[float] = Field(default_factory=list)

    class Settings:
        name = "guidelines"
