"""Unit tests for the F2 recovery tool helpers and guards (no database).

build_plan_search_pipeline and format_context carry the pipeline construction
and result extraction logic; they are pure so they run without a database or
model. The unverified-guard test confirms the tool refuses before verification.
"""

from types import SimpleNamespace

from src.agent.tools.recovery_tools import (
    answer_recovery_question,
    build_plan_search_pipeline,
    format_context,
)

# -- build_plan_search_pipeline ------------------------------------------------


def test_build_plan_search_pipeline_shape():
    pipeline = build_plan_search_pipeline(
        [0.1, 0.2, 0.3], "patient-123"
    )
    assert len(pipeline) == 2
    vs = pipeline[0]["$vectorSearch"]
    assert vs["index"] == "care_plans_vector"
    assert vs["path"] == "embedding"
    assert vs["queryVector"] == [0.1, 0.2, 0.3]
    assert vs["filter"] == {"patient_id": {"$eq": "patient-123"}}


def test_build_plan_search_pipeline_top_k():
    pipeline = build_plan_search_pipeline(
        [0.1], "p1", top_k=6, num_candidates=60
    )
    vs = pipeline[0]["$vectorSearch"]
    assert vs["limit"] == 6
    assert vs["numCandidates"] == 60


# -- format_context ------------------------------------------------------------


def test_format_context_extracts_fields():
    raw = [
        {"text": "Weigh yourself daily.", "source_file": "margaret-chen.md", "chunk_index": 0, "score": 0.9},
        {"text": "Limit salt.", "source_file": "margaret-chen.md", "chunk_index": 1, "score": 0.8},
    ]
    result = format_context(raw)
    assert len(result) == 2
    assert result[0] == {"text": "Weigh yourself daily.", "source_file": "margaret-chen.md", "chunk_index": 0}
    assert result[1] == {"text": "Limit salt.", "source_file": "margaret-chen.md", "chunk_index": 1}


def test_format_context_empty_input():
    assert format_context([]) == []


def test_format_context_skips_empty_text():
    raw = [
        {"text": "", "source_file": "a.md", "chunk_index": 0},
        {"text": "Valid.", "source_file": "b.md", "chunk_index": 1},
    ]
    result = format_context(raw)
    assert len(result) == 1
    assert result[0]["text"] == "Valid."


# -- unverified guard ----------------------------------------------------------


def _unverified_ctx():
    return SimpleNamespace(state={})


async def test_answer_recovery_question_unverified_guard():
    res = await answer_recovery_question("what should I eat?", tool_context=_unverified_ctx())
    assert res["status"] == "unverified"


# -- default-deny gate ---------------------------------------------------------


def test_recovery_tools_not_public():
    from src.agent.tools.guards import PUBLIC_TOOLS

    assert {"answer_recovery_question"}.isdisjoint(PUBLIC_TOOLS)
