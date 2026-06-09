"""DB-backed tests for the medication tools (AC-HW-MED-001 and 002)."""

from datetime import UTC, datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from src.agent.agent.session_state import set_verified
from src.agent.tools.medication_tools import (
    flag_pharmacist,
    get_medications,
    get_next_dose,
)
from src.core.config import config
from src.models import Escalation, Medication


def _ctx(patient_id):
    state: dict = {}
    set_verified(state, patient_id=patient_id, name="Test Patient")
    return SimpleNamespace(state=state)


async def test_get_medications_lists_active_only(seed_demo):
    res = await get_medications(tool_context=_ctx("pid-margaret"))
    assert res["status"] == "ok"
    names = [m["name"] for m in res["medications"]]
    assert any("Furosemide" in n for n in names)
    assert any("Lisinopril" in n for n in names)
    # The stopped Prednisone is not active and must be excluded.
    assert not any("Prednisone" in n for n in names)


async def test_get_medications_isolation(seed_demo):
    res = await get_medications(tool_context=_ctx("pid-margaret"))
    names = [m["name"] for m in res["medications"]]
    assert not any("Oxycodone" in n for n in names)  # James's medication


async def test_get_medications_includes_dosage_and_cautions(seed_demo):
    res = await get_medications(tool_context=_ctx("pid-margaret"))
    furosemide = next(m for m in res["medications"] if "Furosemide" in m["name"])
    assert furosemide["dosage"] == "40 mg"
    assert furosemide["cautions"]


async def test_get_next_dose_scheduled(seed_demo):
    res = await get_next_dose("furosemide", tool_context=_ctx("pid-margaret"))
    assert res["status"] == "ok"
    assert res["next_dose_local"] and res["next_dose_iso"]
    # The time must be computed in the clinic timezone, not UTC: pin the offset so
    # a regression to datetime.now(UTC) (a multi-hour error) is caught.
    clinic_offset = datetime.now(ZoneInfo(config.CLINIC_TIMEZONE)).utcoffset()
    assert datetime.fromisoformat(res["next_dose_iso"]).utcoffset() == clinic_offset


async def test_get_next_dose_isolation(seed_demo):
    # Margaret asking for James's medication must not resolve it.
    res = await get_next_dose("oxycodone", tool_context=_ctx("pid-margaret"))
    assert res["status"] == "not_found"


async def test_future_start_medication_excluded(seed_demo):
    await Medication(
        patient_id="pid-margaret",
        name="Futuremed 1 MG Oral Tablet",
        dosage="1 mg",
        frequency="once daily",
        schedule_times=["08:00"],
        start=datetime(2099, 1, 1, tzinfo=UTC),
    ).insert()

    listed = await get_medications(tool_context=_ctx("pid-margaret"))
    assert not any("Futuremed" in m["name"] for m in listed["medications"])

    res = await get_next_dose("futuremed", tool_context=_ctx("pid-margaret"))
    assert res["status"] == "not_found"


async def test_get_next_dose_prn(seed_demo):
    res = await get_next_dose("oxycodone", tool_context=_ctx("pid-james"))
    assert res["status"] == "as_needed"
    assert res["frequency"]


async def test_get_next_dose_not_on_plan(seed_demo):
    res = await get_next_dose("acetaminophen", tool_context=_ctx("pid-margaret"))
    assert res["status"] == "not_found"


async def test_get_next_dose_ambiguous(seed_demo):
    res = await get_next_dose("tablet", tool_context=_ctx("pid-margaret"))
    assert res["status"] == "ambiguous"
    assert len(res["candidates"]) >= 2


async def test_medication_tools_unverified():
    res = await get_next_dose("furosemide", tool_context=SimpleNamespace(state={}))
    assert res["status"] == "unverified"


async def test_flag_pharmacist_writes_one_non_urgent_escalation(seed_demo):
    res = await flag_pharmacist(
        "Can I take ibuprofen with my lisinopril?", tool_context=_ctx("pid-margaret")
    )
    assert res["status"] == "flagged"

    docs = await Escalation.find(Escalation.patient_id == "pid-margaret").to_list()
    assert len(docs) == 1
    assert docs[0].kind == "pharmacist_question"
    assert docs[0].level == "non-urgent"
    assert docs[0].status == "open"
