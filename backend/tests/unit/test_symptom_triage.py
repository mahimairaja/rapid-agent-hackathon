"""Unit tests for the F5 red-flag classifier and the triage tool guard.

``classify_symptom`` is pure (no model, no database), so the full red-flag rule
set is exercised here. The unverified-guard test confirms the tool refuses before
identification.
"""

from types import SimpleNamespace

from src.agent.tools.redflags import classify_symptom
from src.agent.tools.symptom_tools import triage_symptom

# -- classify_symptom: red flags ------------------------------------------------


def test_chest_pain_is_red_flag():
    status, rule_id, message = classify_symptom("I have bad chest pain")
    assert status == "red_flag"
    assert rule_id == "chest_pain"
    assert "911" in message


def test_chest_pain_near_miss_phrasing():
    status, rule_id, _ = classify_symptom("there is a lot of pressure in my chest")
    assert status == "red_flag"
    assert rule_id == "chest_pain"


def test_stroke_signs_combination():
    status, rule_id, _ = classify_symptom(
        "my face is drooping and I can't get my words out"
    )
    assert status == "red_flag"
    assert rule_id == "stroke_fast"


def test_stroke_one_sided_weakness_combo():
    status, rule_id, _ = classify_symptom("I feel weak on one side of my body")
    assert status == "red_flag"
    assert rule_id == "stroke_fast"


def test_trouble_breathing_is_red_flag():
    status, rule_id, _ = classify_symptom("I can't breathe properly")
    assert status == "red_flag"
    assert rule_id == "breathing"


def test_mild_shortness_of_breath_is_routine():
    # Plain "short of breath" without a severity/at-rest cue stays routine.
    status, _, _ = classify_symptom("I get a little short of breath after walking")
    assert status == "routine"


def test_severe_shortness_of_breath_is_red_flag():
    status, rule_id, _ = classify_symptom("I am severely short of breath")
    assert status == "red_flag"
    assert rule_id == "breathing"


def test_heavy_bleeding_is_red_flag():
    status, rule_id, _ = classify_symptom("my wound is bleeding heavily")
    assert status == "red_flag"
    assert rule_id == "bleeding"


def test_post_op_fever_combination():
    status, rule_id, _ = classify_symptom("I have a fever and my incision is sore")
    assert status == "red_flag"
    assert rule_id == "post_op_fever"


def test_red_flag_wins_over_routine_signal():
    status, rule_id, _ = classify_symptom(
        "I feel tired and a bit down, and I also have chest pain"
    )
    assert status == "red_flag"
    assert rule_id == "chest_pain"


# -- classify_symptom: routine --------------------------------------------------


def test_routine_symptom():
    status, rule_id, message = classify_symptom("I feel tired and a little sore")
    assert status == "routine"
    assert rule_id is None
    assert message is None


def test_blank_is_routine():
    assert classify_symptom("   ") == ("routine", None, None)


# -- triage_symptom guard -------------------------------------------------------


async def test_triage_symptom_unverified_guard():
    res = await triage_symptom(
        "I have chest pain", tool_context=SimpleNamespace(state={})
    )
    assert res["status"] == "unverified"
