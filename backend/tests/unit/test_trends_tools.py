"""Unit tests for the recovery_trends tool (F8).

The MongoDB aggregation runs through the MCP layer, which is stubbed here;
these tests cover the gate, pipeline scoping, result shaping, and the
degraded statuses.
"""

from types import SimpleNamespace

import pytest

from src.agent.agent.session_state import PATIENT_ID, PATIENT_VERIFIED
from src.agent.tools import trends_tools
from src.services.mcp_mongodb import McpUnavailableError


def _ctx(verified: bool = True, patient_id: str = "p-1"):
    state = {PATIENT_VERIFIED: verified, PATIENT_ID: patient_id} if verified else {}
    return SimpleNamespace(state=state)


def _stub(monkeypatch, checkins, escalations=None, error=None):
    calls: list[tuple[str, list[dict]]] = []

    async def fake_aggregate(collection, pipeline):
        calls.append((collection, pipeline))
        if error is not None:
            raise error
        if collection == "checkins":
            return checkins
        return escalations or []

    monkeypatch.setattr(trends_tools.mcp_mongodb, "mcp_aggregate", fake_aggregate)
    return calls


@pytest.mark.asyncio
async def test_unverified_session_is_refused(monkeypatch):
    calls = _stub(monkeypatch, [])
    result = await trends_tools.recovery_trends(tool_context=_ctx(verified=False))
    assert result["status"] == "unverified"
    assert calls == []


@pytest.mark.asyncio
async def test_ok_summarizes_daily_rows_and_red_flags(monkeypatch):
    checkins = [
        {"_id": "2026-06-05", "avg_pain": 6.0, "count": 2},
        {"_id": "2026-06-07", "avg_pain": None, "count": 1},
        {"_id": "2026-06-09", "avg_pain": 3.0, "count": 2},
    ]
    escalations = [
        {
            "message": "sudden shortness of breath [breathing_difficulty]",
            "day": "2026-06-06",
            "level": "urgent",
        }
    ]
    calls = _stub(monkeypatch, checkins, escalations)
    result = await trends_tools.recovery_trends(tool_context=_ctx())

    assert result["status"] == "ok"
    assert result["checkin_count"] == 5
    assert result["first_avg_pain"] == 6.0
    assert result["last_avg_pain"] == 3.0
    assert result["daily"][0] == {"date": "2026-06-05", "avg_pain": 6.0, "count": 2}
    assert result["red_flags"] == [
        {"rule_id": "breathing_difficulty", "date": "2026-06-06"}
    ]
    # Both pipelines are pinned and patient-scoped.
    assert [c[0] for c in calls] == ["checkins", "escalations"]
    for _, pipeline in calls:
        assert pipeline[0]["$match"]["patient_id"] == "p-1"
        assert "$gte" in pipeline[0]["$match"]["created_at"]


@pytest.mark.asyncio
async def test_escalation_without_rule_suffix_uses_level(monkeypatch):
    _stub(
        monkeypatch,
        [],
        [{"message": "call from family", "day": "2026-06-08", "level": "routine"}],
    )
    result = await trends_tools.recovery_trends(tool_context=_ctx())
    assert result["status"] == "ok"
    assert result["red_flags"] == [{"rule_id": "routine", "date": "2026-06-08"}]


@pytest.mark.asyncio
async def test_no_data(monkeypatch):
    _stub(monkeypatch, [], [])
    result = await trends_tools.recovery_trends(tool_context=_ctx())
    assert result == {"status": "no_data", "days": 7}


@pytest.mark.asyncio
async def test_unavailable_on_mcp_failure(monkeypatch):
    _stub(monkeypatch, [], error=McpUnavailableError("boom"))
    result = await trends_tools.recovery_trends(tool_context=_ctx())
    assert result == {"status": "unavailable"}


@pytest.mark.asyncio
async def test_days_clamped(monkeypatch):
    _stub(monkeypatch, [], [])
    low = await trends_tools.recovery_trends(0, tool_context=_ctx())
    high = await trends_tools.recovery_trends(90, tool_context=_ctx())
    assert low["days"] == 1
    assert high["days"] == 30
