"""Unit tests for the pure patient-matching logic (AC-HW-PLAN-001.3).

No database: ``select_patient`` is a pure function over candidate records, so
lightweight stand-ins with the fields it reads are enough.
"""

from datetime import date
from types import SimpleNamespace

from src.agent.tools.patient_tools import select_patient


def _patient(pid, first, last, dob, code=None):
    return SimpleNamespace(
        patient_id=pid,
        first_name=first,
        last_name=last,
        birth_date=dob,
        patient_code=code,
    )


MARGARET = _patient("p1", "Margaret", "Chen", date(1948, 3, 12), "HW-1001")
JAMES = _patient("p2", "James", "Okafor", date(1972, 11, 5), "HW-1002")


def test_exact_name_and_dob_returns_one():
    assert (
        select_patient(
            [MARGARET, JAMES],
            full_name="Margaret Chen",
            date_of_birth=date(1948, 3, 12),
        )
        is MARGARET
    )


def test_name_match_is_case_and_whitespace_insensitive():
    assert (
        select_patient(
            [MARGARET], full_name="  margaret   CHEN ", date_of_birth=date(1948, 3, 12)
        )
        is MARGARET
    )


def test_wrong_dob_returns_none():
    assert (
        select_patient(
            [MARGARET], full_name="Margaret Chen", date_of_birth=date(1950, 1, 1)
        )
        is None
    )


def test_unknown_name_returns_none():
    assert (
        select_patient(
            [MARGARET, JAMES], full_name="Nobody Here", date_of_birth=date(1948, 3, 12)
        )
        is None
    )


def test_ambiguous_same_name_and_dob_returns_none():
    twin = _patient("p3", "Margaret", "Chen", date(1948, 3, 12))
    assert (
        select_patient(
            [MARGARET, twin], full_name="Margaret Chen", date_of_birth=date(1948, 3, 12)
        )
        is None
    )


def test_patient_code_returns_one():
    assert select_patient([MARGARET, JAMES], patient_code="HW-1002") is JAMES


def test_patient_code_is_case_insensitive():
    assert select_patient([JAMES], patient_code="hw-1002") is JAMES


def test_missing_details_returns_none():
    assert select_patient([MARGARET], full_name="Margaret Chen") is None
    assert select_patient([MARGARET]) is None
