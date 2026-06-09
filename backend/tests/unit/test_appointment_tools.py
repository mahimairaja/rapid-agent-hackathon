"""Unit tests for F4 appointment helper behavior."""

from datetime import UTC, datetime
from types import SimpleNamespace

from src.agent.tools.appointment_tools import (
    book_follow_up_slot,
    filter_slots_to_window,
    get_follow_up_booking,
    list_follow_up_slots,
    reschedule_follow_up,
)


def test_filter_slots_to_window_keeps_only_in_window_slots():
    window_start = datetime(2026, 6, 10, 9, 0, tzinfo=UTC)
    window_end = datetime(2026, 6, 10, 17, 0, tzinfo=UTC)
    inside = datetime(2026, 6, 10, 10, 0, tzinfo=UTC)
    edge = datetime(2026, 6, 10, 17, 0, tzinfo=UTC)
    outside = datetime(2026, 6, 10, 18, 0, tzinfo=UTC)

    assert filter_slots_to_window(
        [outside, inside, edge], window_start, window_end
    ) == [inside, edge]


def test_appointment_tools_are_not_public():
    from src.agent.tools.guards import PUBLIC_TOOLS

    assert {
        "list_follow_up_slots",
        "book_follow_up_slot",
        "get_follow_up_booking",
        "reschedule_follow_up",
    }.isdisjoint(PUBLIC_TOOLS)


def _unverified_ctx():
    return SimpleNamespace(state={})


async def test_list_follow_up_slots_unverified_guard():
    res = await list_follow_up_slots(tool_context=_unverified_ctx())
    assert res["status"] == "unverified"


async def test_book_follow_up_slot_unverified_guard():
    res = await book_follow_up_slot(
        "2026-06-10T10:00:00Z", tool_context=_unverified_ctx()
    )
    assert res["status"] == "unverified"


async def test_get_follow_up_booking_unverified_guard():
    res = await get_follow_up_booking(tool_context=_unverified_ctx())
    assert res["status"] == "unverified"


async def test_reschedule_follow_up_unverified_guard():
    res = await reschedule_follow_up(
        "2026-06-10T10:00:00Z", tool_context=_unverified_ctx()
    )
    assert res["status"] == "unverified"
