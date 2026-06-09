"""Deterministic red-flag rule set and classifier for F5 symptom triage.

The rules live in code, not model discretion, so a dangerous symptom is matched
the same way every time and can be unit-tested without a model or a database.
``classify_symptom`` is pure: given the patient's reported text it returns either
a red flag (with the matched rule id and the fixed emergency message to relay) or
routine. A red flag always wins over any routine signal in the same report.

The list is demo-scoped and authored, not clinical guidance. Keep all rules here
so the set can be reviewed and tuned in one place.
"""

from dataclasses import dataclass

# Shared closing directive so every emergency message ends the same, clear way.
_CALL = (
    "Please call 911 (or your local emergency number) now, or have someone take "
    "you to the nearest emergency room."
)


@dataclass(frozen=True)
class RedFlagRule:
    """A single red-flag rule.

    ``triggers`` is a tuple of AND-groups. The rule matches when, for at least one
    group, every phrase in that group appears in the normalized text. A group with
    one phrase is a plain keyword match; a multi-phrase group is a combination.
    """

    rule_id: str
    label: str
    message: str
    triggers: tuple[tuple[str, ...], ...]

    def matches(self, normalized_text: str) -> bool:
        return any(
            all(term in normalized_text for term in group) for group in self.triggers
        )


# Phrases are stored apostrophe-free and lowercase to match _normalize() output,
# so "can't breathe" and "cannot breathe" both hit "cant breathe"/"cannot breathe".
RED_FLAG_RULES: tuple[RedFlagRule, ...] = (
    RedFlagRule(
        rule_id="chest_pain",
        label="chest pain",
        message=(
            "Chest pain or pressure can be a sign of a serious heart problem and "
            f"may be a medical emergency. {_CALL} Please do not wait to see if it "
            "passes."
        ),
        triggers=(
            ("chest pain",),
            ("chest pressure",),
            ("chest tightness",),
            ("pain in my chest",),
            ("pressure in my chest",),
            ("tightness in my chest",),
            ("crushing", "pain"),
            ("crushing", "chest"),
        ),
    ),
    RedFlagRule(
        rule_id="stroke_fast",
        label="stroke signs",
        message=(
            "Those can be warning signs of a stroke, which is a medical emergency. "
            f"{_CALL} Getting help fast really matters."
        ),
        triggers=(
            # Require face/mouth context so "drooping willows" or tired eyelids
            # do not fire, while real facial droop still does.
            ("droop", "face"),
            ("droop", "mouth"),
            ("slurred speech",),
            ("slurring",),
            ("trouble speaking",),
            ("cant speak",),
            ("sudden confusion",),
            # Self-reports of a stroke, without matching idioms like
            # "stroke of luck" / "breaststroke".
            ("having a stroke",),
            ("had a stroke",),
            ("stroke symptoms",),
            ("weak", "one side"),
            ("weakness", "one side"),
            ("numb", "one side"),
            ("numbness", "one side"),
        ),
    ),
    RedFlagRule(
        rule_id="breathing",
        label="trouble breathing",
        message=(f"Trouble breathing can be a medical emergency. {_CALL}"),
        triggers=(
            ("cant breathe",),
            ("cannot breathe",),
            ("can not breathe",),
            ("trouble breathing",),
            ("difficulty breathing",),
            ("difficulty in breathing",),
            ("labored breathing",),
            ("struggling to breathe",),
            ("hard to breathe",),
            ("gasping",),
            ("cant catch my breath",),
            ("cannot catch my breath",),
            ("choking",),
            ("short of breath", "severe"),
            ("shortness of breath", "severe"),
            ("short of breath", "at rest"),
            ("shortness of breath", "at rest"),
            ("short of breath", "sudden"),
            ("shortness of breath", "sudden"),
        ),
    ),
    RedFlagRule(
        rule_id="bleeding",
        label="heavy bleeding",
        message=(
            "Heavy bleeding that will not stop is a medical emergency. "
            f"{_CALL} If you can, press firmly on the area while you get help."
        ),
        triggers=(
            ("heavy bleeding",),
            ("bleeding heavily",),
            ("bleeding a lot",),
            ("bleeding badly",),
            ("lots of blood",),
            ("soaking through",),
            ("wont stop bleeding",),
            ("cant stop the bleeding",),
            ("cannot stop the bleeding",),
            ("bleeding", "wont stop"),
            ("blood", "wont stop"),
        ),
    ),
    RedFlagRule(
        rule_id="post_op_fever",
        label="high fever after surgery",
        message=(
            "A high fever after surgery can be a sign of a serious infection. "
            f"Please seek urgent medical care right away. {_CALL}"
        ),
        triggers=(
            ("high fever",),
            ("fever", "surgery"),
            ("fever", "surgical"),
            ("fever", "incision"),
            ("fever", "wound"),
            ("fever", "stitches"),
            ("temperature", "surgery"),
            ("wound", "pus"),
            ("incision", "pus"),
            ("wound", "infected"),
        ),
    ),
    RedFlagRule(
        rule_id="loss_of_consciousness",
        label="fainting or loss of consciousness",
        message=(
            f"Fainting or passing out can be a sign of a serious problem. {_CALL}"
        ),
        triggers=(
            ("passed out",),
            ("passing out",),
            ("about to pass out",),
            ("fainted",),
            ("fainting",),
            ("blacked out",),
            ("lost consciousness",),
            ("unconscious",),
        ),
    ),
    RedFlagRule(
        rule_id="coughing_blood",
        label="coughing or vomiting blood",
        message=(f"Coughing up or vomiting blood can be a medical emergency. {_CALL}"),
        triggers=(
            ("coughing up blood",),
            ("cough up blood",),
            ("coughing blood",),
            ("vomiting blood",),
            ("throwing up blood",),
            ("blood", "vomit"),
        ),
    ),
    RedFlagRule(
        rule_id="paralysis",
        label="sudden weakness or paralysis",
        message=(
            "A sudden inability to move or feel part of your body can be a "
            f"medical emergency. {_CALL}"
        ),
        # Require a body part so unrelated phrases ("can't move my appointment")
        # do not fire.
        triggers=(
            ("paralyzed",),
            ("paralysis",),
            ("cant move", "arm"),
            ("cant move", "leg"),
            ("cant move", "hand"),
            ("cant move", "face"),
            ("cant move", "side"),
            ("cant feel", "arm"),
            ("cant feel", "leg"),
            ("cant feel", "side"),
        ),
    ),
)


def _normalize(text: str) -> str:
    """Lowercase and reduce to alphanumeric words for matching.

    Apostrophes are dropped (so "can't" -> "cant") and every other
    non-alphanumeric character becomes a space, so hyphenated or punctuated
    phrasings like "short-of-breath" or "chest,pain" still match the stored
    phrases.
    """
    lowered = (text or "").lower().replace("'", "").replace("’", "")
    cleaned = "".join(ch if ch.isalnum() else " " for ch in lowered)
    return " ".join(cleaned.split())


def classify_symptom(text: str) -> tuple[str, str | None, str | None]:
    """Classify a reported symptom.

    Returns ``("red_flag", rule_id, emergency_message)`` for the first matching
    red-flag rule (a red flag always wins), or ``("routine", None, None)``.
    """
    normalized = _normalize(text)
    if not normalized:
        return ("routine", None, None)
    for rule in RED_FLAG_RULES:
        if rule.matches(normalized):
            return ("red_flag", rule.rule_id, rule.message)
    return ("routine", None, None)
