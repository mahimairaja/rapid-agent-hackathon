"""Unit tests for the pure medication helpers (no database).

match_medications and compute_next_dose carry the matching and timing logic for
AC-HW-MED-001.1 and 001.3; they are pure so they run without a database or model.
"""

from datetime import datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from src.agent.tools.medication_tools import (
    compute_next_dose,
    flag_pharmacist,
    get_medications,
    get_next_dose,
    match_medications,
)

TZ = ZoneInfo("America/New_York")


def _med(name):
    return SimpleNamespace(name=name)


FUROSEMIDE = _med("Furosemide 40 MG Oral Tablet")
LISINOPRIL = _med("Lisinopril 10 MG Oral Tablet")
METOPROLOL = _med("Metoprolol Succinate 25 MG Extended Release Oral Tablet")


def test_match_substring_returns_single():
    assert match_medications([FUROSEMIDE, LISINOPRIL], "furosemide") == [FUROSEMIDE]


def test_match_is_case_insensitive():
    assert match_medications([METOPROLOL], "METOPROLOL") == [METOPROLOL]


def test_match_unknown_returns_empty():
    assert match_medications([FUROSEMIDE, LISINOPRIL], "tylenol") == []


def test_match_multiple_is_ambiguous():
    res = match_medications([FUROSEMIDE, LISINOPRIL, METOPROLOL], "tablet")
    assert len(res) == 3


def test_match_blank_query_returns_empty():
    assert match_medications([FUROSEMIDE], "   ") == []


def test_next_dose_later_today():
    now = datetime(2026, 6, 9, 10, 0, tzinfo=TZ)
    assert compute_next_dose(["08:00", "18:00"], now) == datetime(
        2026, 6, 9, 18, 0, tzinfo=TZ
    )


def test_next_dose_rolls_to_tomorrow():
    now = datetime(2026, 6, 9, 21, 0, tzinfo=TZ)
    assert compute_next_dose(["08:00"], now) == datetime(2026, 6, 10, 8, 0, tzinfo=TZ)


def test_next_dose_prn_returns_none():
    now = datetime(2026, 6, 9, 10, 0, tzinfo=TZ)
    assert compute_next_dose([], now) is None


def test_next_dose_ignores_malformed_times():
    now = datetime(2026, 6, 9, 10, 0, tzinfo=TZ)
    assert compute_next_dose(["not-a-time"], now) is None
    assert compute_next_dose(["25:00"], now) is None


def test_next_dose_equal_time_surfaces_today():
    now = datetime(2026, 6, 9, 8, 0, tzinfo=TZ)
    assert compute_next_dose(["08:00"], now) == datetime(2026, 6, 9, 8, 0, tzinfo=TZ)


def test_next_dose_picks_earliest_still_ahead_not_list_order():
    now = datetime(2026, 6, 9, 10, 0, tzinfo=TZ)
    # 08:00 is tomorrow, 12:00 is today: result must be today 12:00.
    assert compute_next_dose(["08:00", "12:00"], now) == datetime(
        2026, 6, 9, 12, 0, tzinfo=TZ
    )


def test_next_dose_crosses_spring_forward_keeps_wall_clock():
    now = datetime(2026, 3, 7, 21, 0, tzinfo=TZ)  # evening before spring forward
    nxt = compute_next_dose(["08:00"], now)
    assert nxt == datetime(2026, 3, 8, 8, 0, tzinfo=TZ)
    assert nxt.utcoffset() == timedelta(hours=-4)  # EDT after the transition


def test_medication_tools_are_not_public():
    from src.agent.tools.guards import PUBLIC_TOOLS

    assert {"get_medications", "get_next_dose", "flag_pharmacist"}.isdisjoint(
        PUBLIC_TOOLS
    )


def _unverified_ctx():
    return SimpleNamespace(state={})


async def test_get_medications_unverified_guard():
    res = await get_medications(tool_context=_unverified_ctx())
    assert res["status"] == "unverified"


async def test_get_next_dose_unverified_guard():
    res = await get_next_dose("furosemide", tool_context=_unverified_ctx())
    assert res["status"] == "unverified"


async def test_flag_pharmacist_unverified_guard():
    res = await flag_pharmacist("a question", tool_context=_unverified_ctx())
    assert res["status"] == "unverified"


# ---- Uploaded-plan fallback (no structured medications) ---------------------


def _verified_ctx():
    return SimpleNamespace(state={"patient_verified": True, "patient_id": "p-1"})


_PLAN_CONTEXT = [
    {
        "text": "Medications at discharge: Furosemide 40 mg once daily.",
        "source_file": "upload.pdf",
        "chunk_index": 0,
    }
]


def _patch_fallback(monkeypatch, *, meds, context):
    import src.agent.tools.medication_tools as module

    async def fake_active(patient_id, now):
        return meds

    async def fake_search(patient_id, question):
        return context

    monkeypatch.setattr(module, "_active_medications", fake_active)
    monkeypatch.setattr(module, "search_plan_context", fake_search)


async def test_get_medications_falls_back_to_uploaded_plan(monkeypatch):
    _patch_fallback(monkeypatch, meds=[], context=_PLAN_CONTEXT)
    res = await get_medications(tool_context=_verified_ctx())
    assert res["status"] == "from_care_plan"
    assert res["context"] == _PLAN_CONTEXT
    assert "note" in res


async def test_get_medications_without_plan_stays_ok_empty(monkeypatch):
    _patch_fallback(monkeypatch, meds=[], context=[])
    res = await get_medications(tool_context=_verified_ctx())
    assert res["status"] == "ok"
    assert res["medications"] == []


async def test_get_next_dose_falls_back_to_uploaded_plan(monkeypatch):
    _patch_fallback(monkeypatch, meds=[], context=_PLAN_CONTEXT)
    res = await get_next_dose("furosemide", tool_context=_verified_ctx())
    assert res["status"] == "from_care_plan"
    assert res["medication"] == "furosemide"
    assert res["context"] == _PLAN_CONTEXT


async def test_get_next_dose_structured_miss_skips_fallback(monkeypatch):
    structured = SimpleNamespace(
        name="Lisinopril 10 MG Oral Tablet",
        dosage="10 mg",
        frequency="daily",
        schedule_times=["08:00"],
        start=None,
        stop=None,
    )

    async def fake_active(patient_id, now):
        return [structured]

    async def fail_search(patient_id, question):
        raise AssertionError("fallback must not run when structured meds exist")

    import src.agent.tools.medication_tools as module

    monkeypatch.setattr(module, "_active_medications", fake_active)
    monkeypatch.setattr(module, "search_plan_context", fail_search)
    res = await get_next_dose("furosemide", tool_context=_verified_ctx())
    assert res["status"] == "not_found"
