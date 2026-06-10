"""Schemas for the session-scoped follow-up booking endpoints.

These power the cal.com-styled calendar widget in the Appointments tab. The
booking/slot payload dicts come from the F4 helpers (`_booking_payload`,
`_slot_payload`) so the widget, the agent tools, and the database mirror all
speak the same shape; they are passed through as dicts rather than re-modeled.
"""

from typing import Any

from pydantic import BaseModel, Field


class FollowUpWindowOut(BaseModel):
    start_iso: str
    end_iso: str


class SessionSlotsResponse(BaseModel):
    # Same status vocabulary as the F4 tools: ok, unverified, none_required,
    # no_window, scheduler_unavailable, invalid_time_zone.
    status: str
    window: FollowUpWindowOut | None = None
    current_booking: dict[str, Any] | None = None
    slots: list[dict[str, Any]] = Field(default_factory=list)


class SessionBookRequest(BaseModel):
    start_iso: str = Field(min_length=1)
    time_zone: str | None = None


class SessionBookResponse(BaseModel):
    # ok statuses: booked, rescheduled. Failure statuses mirror the tools:
    # unverified, invalid_time, invalid_time_zone, unavailable,
    # scheduler_unavailable, none_required, no_window.
    status: str
    booking: dict[str, Any] | None = None
