from datetime import UTC, datetime
from typing import Annotated

from beanie import Indexed
from pydantic import field_validator

from src.models.base_model import TimestampedDocument


def _utc_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC).replace(microsecond=0)


class Appointment(TimestampedDocument):
    patient_id: Annotated[str, Indexed()]
    kind: str
    start: datetime
    end: datetime | None = None
    provider: str | None = None
    location: str | None = None
    reason: str | None = None
    status: str = "scheduled"
    cal_booking_uid: str | None = None
    follow_up_window_start: datetime | None = None
    follow_up_window_end: datetime | None = None
    follow_up_required: bool | None = None
    booked_at: datetime | None = None

    @field_validator(
        "start",
        "end",
        "follow_up_window_start",
        "follow_up_window_end",
        "booked_at",
        mode="after",
    )
    @classmethod
    def normalize_datetimes_utc(cls, value: datetime | None) -> datetime | None:
        return _utc_datetime(value)

    class Settings:
        name = "appointments"
