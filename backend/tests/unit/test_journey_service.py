"""Unit tests for the journey clone service (pure dict layer, no database)."""

from datetime import UTC, date, datetime, timedelta

from src.services.journey_service import (
    JOURNEY_META,
    build_clone,
    make_patient_code,
    split_name,
    swap_name_in_text,
)

NOW = datetime(2026, 6, 10, 12, 0, tzinfo=UTC)


def _sample() -> dict:
    return {
        "id": "doc-1",
        "created_at": NOW,
        "updated_at": NOW,
        "patient_id": "pid-sample",
        "first_name": "Margaret",
        "last_name": "Chen",
        "birth_date": date(1948, 3, 12),
        "gender": "F",
        "city": "Boston",
        "patient_code": "HW-1001",
        "discharge_reason": "CHF exacerbation",
        "assigned_clinician": "Dr. Helen Park (Cardiology)",
        "follow_up_required": True,
        "follow_up_window_start": NOW + timedelta(days=4),
        "follow_up_window_end": NOW + timedelta(days=8),
        "follow_up_kind": "Cardiology follow-up",
    }


# -- split_name -------------------------------------------------------------


def test_split_name_two_words():
    assert split_name("Mahimai Raja") == ("Mahimai", "Raja")


def test_split_name_single_word_leaves_last_empty():
    assert split_name("Mahimai") == ("Mahimai", "")


def test_split_name_extra_whitespace_and_middle_names():
    assert split_name("  Mary  Jane  Watson ") == ("Mary", "Jane Watson")


def test_split_name_empty():
    assert split_name("   ") == ("", "")


# -- swap_name_in_text --------------------------------------------------------


def test_swap_full_first_and_last_names():
    text = "Margaret Chen is recovering. Margaret should rest. Mrs. Chen walks."
    out = swap_name_in_text(
        text,
        sample_first="Margaret",
        sample_last="Chen",
        user_first="Asha",
        user_last="Rao",
    )
    assert out == "Asha Rao is recovering. Asha should rest. Mrs. Rao walks."


def test_swap_with_single_word_user_name_never_blanks_last_name():
    out = swap_name_in_text(
        "Mrs. Chen and Margaret Chen.",
        sample_first="Margaret",
        sample_last="Chen",
        user_first="Asha",
        user_last="",
    )
    assert out == "Mrs. Asha and Asha."


# -- make_patient_code ---------------------------------------------------------


def test_make_patient_code_format():
    code = make_patient_code()
    assert code.startswith("HW-") and len(code) == 7
    assert all(c in "ABCDEFGHJKMNPQRSTUVWXYZ23456789" for c in code[3:])
    # Never collides with the seeded journey codes (digits 0/1 are excluded).
    assert code not in JOURNEY_META


# -- build_clone -----------------------------------------------------------------


def _inputs():
    sample = _sample()
    meds = [
        {
            "id": "doc-m1",
            "created_at": NOW,
            "updated_at": NOW,
            "patient_id": "pid-sample",
            "name": "Furosemide",
            "dosage": "40 mg",
            "schedule_times": ["08:00"],
            "cautions": ["Stand up slowly"],
        }
    ]
    appts = [
        {
            "id": "doc-a1",
            "created_at": NOW,
            "updated_at": NOW,
            "patient_id": "pid-sample",
            "kind": "Cardiology follow-up",
            "start": NOW + timedelta(days=5),
            "status": "scheduled",
            "cal_booking_uid": "cal-shared-123",
        }
    ]
    chunks = [
        {
            "patient_id": "pid-sample",
            "source_file": "plan.md",
            "chunk_index": 0,
            "text": "Margaret Chen is a 78-year-old. Margaret should weigh daily.",
            "embedding": [0.25, -0.5, 0.75],
        }
    ]
    return sample, meds, appts, chunks


def test_build_clone_personalizes_identity_and_copies_medicine():
    sample, meds, appts, chunks = _inputs()
    plan = build_clone(
        sample,
        meds,
        appts,
        chunks,
        display_name="Asha Rao",
        birth_year=1990,
        patient_id="pid-new",
        patient_code="HW-7K3F",
    )
    p = plan.patient
    assert (p["first_name"], p["last_name"]) == ("Asha", "Rao")
    assert p["birth_date"] == date(1990, 1, 1)
    assert p["patient_code"] == "HW-7K3F" and p["patient_id"] == "pid-new"
    assert p["cloned_from"] == "pid-sample"
    # Medical content copied; demographics are the user's own (not the sample's).
    assert p["discharge_reason"] == sample["discharge_reason"]
    assert p["follow_up_window_end"] == sample["follow_up_window_end"]
    assert "gender" not in p and "city" not in p


def test_build_clone_rewrites_chunks_and_keeps_embeddings():
    sample, meds, appts, chunks = _inputs()
    plan = build_clone(
        sample,
        meds,
        appts,
        chunks,
        display_name="Asha Rao",
        birth_year=None,
        patient_id="pid-new",
        patient_code="HW-7K3F",
    )
    chunk = plan.chunks[0]
    assert chunk["patient_id"] == "pid-new"
    assert "Margaret" not in chunk["text"] and "Asha Rao" in chunk["text"]
    # Embeddings are copied byte-identical: a name swap is not re-embedded.
    assert chunk["embedding"] == [0.25, -0.5, 0.75]
    assert (chunk["source_file"], chunk["chunk_index"]) == ("plan.md", 0)


def test_build_clone_drops_cal_booking_uid_and_reassigns_ownership():
    sample, meds, appts, chunks = _inputs()
    plan = build_clone(
        sample,
        meds,
        appts,
        chunks,
        display_name="Asha",
        birth_year=None,
        patient_id="pid-new",
        patient_code="HW-7K3F",
    )
    med = plan.medications[0]
    assert med["patient_id"] == "pid-new"
    # Source document identity fields are never copied.
    assert "id" not in med and "created_at" not in med
    appt = plan.appointments[0]
    assert appt["patient_id"] == "pid-new"
    # The sample's live Cal.com booking must not be shared by clones.
    assert "cal_booking_uid" not in appt
    assert appt["kind"] == "Cardiology follow-up"
