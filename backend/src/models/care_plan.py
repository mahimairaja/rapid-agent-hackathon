from typing import Annotated

from beanie import Indexed
from pydantic import Field

from src.models.base import TimestampedDocument


class CarePlanChunk(TimestampedDocument):
    """A chunk of a patient's authored discharge narrative, with its embedding.

    Plan-scoped retrieval (F2) filters by ``patient_id``; the vector index is
    created separately (scripts/create_indexes.py).
    """

    patient_id: Annotated[str, Indexed()]
    source_file: str
    chunk_index: int
    text: str
    embedding: list[float] = Field(default_factory=list)

    class Settings:
        name = "care_plans"
