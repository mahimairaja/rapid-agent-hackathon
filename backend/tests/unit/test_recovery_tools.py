"""Unit tests for the F2 recovery tool helpers and guards (no database).

build_plan_search_pipeline and format_context carry the pipeline construction
and result extraction logic; they are pure so they run without a database or
model. The unverified-guard test confirms the tool refuses before verification.
"""

from types import SimpleNamespace

from src.agent.agent.session_state import set_verified
from src.agent.tools import recovery_tools
from src.agent.tools.recovery_tools import (
    answer_recovery_question,
    build_plan_search_pipeline,
    format_context,
)
from src.models import CarePlanChunk

# -- build_plan_search_pipeline ------------------------------------------------


def test_build_plan_search_pipeline_shape():
    pipeline = build_plan_search_pipeline([0.1, 0.2, 0.3], "patient-123")
    assert len(pipeline) == 2
    vs = pipeline[0]["$vectorSearch"]
    assert vs["index"] == "care_plans_vector"
    assert vs["path"] == "embedding"
    assert vs["queryVector"] == [0.1, 0.2, 0.3]
    assert vs["filter"] == {"patient_id": {"$eq": "patient-123"}}


def test_build_plan_search_pipeline_top_k():
    pipeline = build_plan_search_pipeline([0.1], "p1", top_k=6, num_candidates=60)
    vs = pipeline[0]["$vectorSearch"]
    assert vs["limit"] == 6
    assert vs["numCandidates"] == 60


# -- format_context ------------------------------------------------------------


def test_format_context_extracts_fields():
    raw = [
        {
            "text": "Weigh yourself daily.",
            "source_file": "margaret-chen.md",
            "chunk_index": 0,
            "score": 0.9,
        },
        {
            "text": "Limit salt.",
            "source_file": "margaret-chen.md",
            "chunk_index": 1,
            "score": 0.8,
        },
    ]
    result = format_context(raw)
    assert len(result) == 2
    assert result[0] == {
        "text": "Weigh yourself daily.",
        "source_file": "margaret-chen.md",
        "chunk_index": 0,
    }
    assert result[1] == {
        "text": "Limit salt.",
        "source_file": "margaret-chen.md",
        "chunk_index": 1,
    }


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
    res = await answer_recovery_question(
        "what should I eat?", tool_context=_unverified_ctx()
    )
    assert res["status"] == "unverified"


# -- default-deny gate ---------------------------------------------------------


def test_recovery_tools_not_public():
    from src.agent.tools.guards import PUBLIC_TOOLS

    assert {"answer_recovery_question"}.isdisjoint(PUBLIC_TOOLS)


# -- DB-access path (stubbed cursor, real collection getter) --------------------
#
# These exercise the production path through CarePlanChunk.get_pymongo_collection()
# and the async aggregate cursor, which the pure-helper tests never reach. The
# embedding and the cursor are stubbed (no Voyage key, no Atlas vector search),
# but the collection getter is the REAL one: if the tool reverts to the retired
# get_motor_collection() name, the monkeypatch below does not apply, the missing
# method raises AttributeError, the tool returns "error", and these tests fail.


def _verified_ctx(patient_id: str = "pid-margaret"):
    state: dict = {}
    set_verified(state, patient_id=patient_id, name="Test Patient")
    return SimpleNamespace(state=state)


class _FakeCollection:
    def __init__(self, docs: list[dict]):
        self._docs = docs
        self.pipeline: list | None = None

    async def aggregate(self, pipeline):
        # pymongo's async aggregate() is a coroutine that resolves to the cursor.
        self.pipeline = pipeline
        docs = self._docs

        async def _gen():
            for doc in docs:
                yield doc

        return _gen()


def _stub_embedding(monkeypatch):
    monkeypatch.setattr(
        recovery_tools, "embed_texts", lambda texts, input_type: [[0.1] * 1024]
    )


async def test_answer_recovery_question_returns_grounded_context(monkeypatch):
    _stub_embedding(monkeypatch)
    fake = _FakeCollection(
        [{"text": "Take short daily walks.", "source_file": "m.md", "chunk_index": 0}]
    )
    monkeypatch.setattr(
        CarePlanChunk, "get_pymongo_collection", classmethod(lambda cls: fake)
    )

    res = await answer_recovery_question(
        "How much should I walk?", tool_context=_verified_ctx()
    )

    assert res["status"] == "ok"
    assert res["context"][0]["text"] == "Take short daily walks."
    # The vector search must be scoped to the verified patient only.
    assert fake.pipeline[0]["$vectorSearch"]["filter"] == {
        "patient_id": {"$eq": "pid-margaret"}
    }


async def test_answer_recovery_question_no_context(monkeypatch):
    _stub_embedding(monkeypatch)
    monkeypatch.setattr(
        CarePlanChunk,
        "get_pymongo_collection",
        classmethod(lambda cls: _FakeCollection([])),
    )

    res = await answer_recovery_question(
        "anything in my plan about this?", tool_context=_verified_ctx()
    )

    assert res["status"] == "no_context"
