from datetime import UTC, datetime

from beanie import Document
from pydantic import Field


def utcnow() -> datetime:
    return datetime.now(UTC)


class TimestampedDocument(Document):
    """Base Document carrying UTC created/updated timestamps.

    Not a collection itself; concrete documents subclass it and declare their
    own ``Settings.name``.
    """

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
