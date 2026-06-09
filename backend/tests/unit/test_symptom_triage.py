"""Unit tests for the F5 red-flag classifier and the triage tool guard.

``classify_symptom`` is pure (no model, no database), so the full red-flag rule
set is exercised here. The unverified-guard test confirms the tool refuses before
identification.
"""

from types import SimpleNamespace

from src.agent.agent.session_state import set_verified
from src.agent.tools import symptom_tools
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


# -- review fixes: tightened false positives ------------------------------------


def test_stroke_idiom_is_routine_but_self_report_is_red_flag():
    assert classify_symptom("that was a stroke of luck")[0] == "routine"
    status, rule_id, _ = classify_symptom("I think I'm having a stroke")
    assert (status, rule_id) == ("red_flag", "stroke_fast")


def test_drooping_requires_face_context():
    assert classify_symptom("the willows are drooping")[0] == "routine"
    assert classify_symptom("my eyelids feel droopy")[0] == "routine"
    status, rule_id, _ = classify_symptom("the left side of my face is drooping")
    assert (status, rule_id) == ("red_flag", "stroke_fast")


def test_crushing_requires_pain_or_chest_context():
    assert classify_symptom("work is crushing me lately")[0] == "routine"
    assert classify_symptom("I have crushing chest pain")[0] == "red_flag"


def test_cant_move_appointment_is_not_paralysis():
    # The app schedules appointments, so this phrasing must not trigger paralysis.
    assert classify_symptom("I can't move my appointment to next week")[0] == "routine"


# -- review fixes: false negatives now covered ----------------------------------


def test_hyphenated_phrasing_matches():
    status, rule_id, _ = classify_symptom("I'm having trouble-breathing")
    assert (status, rule_id) == ("red_flag", "breathing")


def test_difficulty_breathing_is_red_flag():
    status, rule_id, _ = classify_symptom("I'm having difficulty breathing")
    assert (status, rule_id) == ("red_flag", "breathing")


def test_fainting_is_red_flag():
    status, rule_id, _ = classify_symptom("I keep passing out")
    assert (status, rule_id) == ("red_flag", "loss_of_consciousness")


def test_coughing_up_blood_is_red_flag():
    status, rule_id, _ = classify_symptom("I have been coughing up blood")
    assert (status, rule_id) == ("red_flag", "coughing_blood")


def test_sudden_paralysis_is_red_flag():
    status, rule_id, _ = classify_symptom("I can't move my left arm")
    assert (status, rule_id) == ("red_flag", "paralysis")


# -- review fix: emergency message must survive an escalation write failure ------


class _BoomEscalation:
    def __init__(self, **kwargs):
        pass

    async def insert(self):
        raise RuntimeError("database is down")


async def test_red_flag_returns_emergency_message_even_if_write_fails(monkeypatch):
    monkeypatch.setattr(symptom_tools, "Escalation", _BoomEscalation)
    state: dict = {}
    set_verified(state, patient_id="pid-x", name="Test")

    res = await triage_symptom(
        "I have crushing chest pain", tool_context=SimpleNamespace(state=state)
    )

    assert res["status"] == "red_flag"
    assert "911" in res["emergency_message"]
    assert res["escalated"] is False
