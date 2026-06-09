"""Purpose-built ADK tool for grounded recovery answers (F2).

The patient's own discharge plan (``CarePlanChunk`` documents) is the single
source of truth. The tool embeds the patient's question with Voyage, runs an
Atlas Vector Search scoped to the verified patient's chunks, and returns the
matching context so the LLM can compose a grounded answer. If the plan does not
cover the question, the tool signals ``no_context`` and the prompt instructs the
agent to say so honestly.

Like the F1/F3/F4 tools, this reads the verified patient id only from session
state (no patient id argument), so the model cannot target another patient, and
the default-deny gate blocks it until the patient is verified.
"""

import asyncio
import logging
from typing import Any

from google.adk.tools import ToolContext

from src.agent.agent.session_state import verified_patient_id
from src.models import CarePlanChunk
from src.services.embeddings_service import embed_texts

logger = logging.getLogger(__name__)

_UNVERIFIED = {
    "status": "unverified",
    "message": "No patient has been identified in this conversation yet.",
}

_INDEX_NAME = "care_plans_vector"
_EMBEDDING_PATH = "embedding"
_DEFAULT_TOP_K = 4
_DEFAULT_NUM_CANDIDATES = 40


def build_plan_search_pipeline(
    embedding: list[float],
    patient_id: str,
    *,
    index_name: str = _INDEX_NAME,
    top_k: int = _DEFAULT_TOP_K,
    num_candidates: int = _DEFAULT_NUM_CANDIDATES,
) -> list[dict[str, Any]]:
    """Construct the ``$vectorSearch`` aggregation pipeline for plan retrieval.

    Pure helper so the pipeline shape can be unit-tested without a database.
    """
    return [
        {
            "$vectorSearch": {
                "index": index_name,
                "path": _EMBEDDING_PATH,
                "queryVector": embedding,
                "numCandidates": num_candidates,
                "limit": top_k,
                "filter": {"patient_id": {"$eq": patient_id}},
            },
        },
        {
            "$project": {
                "_id": 0,
                "text": 1,
                "source_file": 1,
                "chunk_index": 1,
                "score": {"$meta": "vectorSearchScore"},
            },
        },
    ]


def format_context(raw_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Extract the fields the LLM needs from raw aggregation results.

    Pure helper for unit testing.
    """
    return [
        {
            "text": doc.get("text", ""),
            "source_file": doc.get("source_file", ""),
            "chunk_index": doc.get("chunk_index", 0),
        }
        for doc in raw_results
        if doc.get("text")
    ]


async def answer_recovery_question(
    question: str, *, tool_context: ToolContext
) -> dict:
    """Answer a recovery question using the verified patient's discharge plan.

    Pass the patient's question. Returns matching excerpts from their plan so
    you can compose a grounded answer. If the plan does not cover the topic, the
    status will be "no_context" — tell the patient honestly.
    """
    patient_id = verified_patient_id(tool_context.state)
    if not patient_id:
        return dict(_UNVERIFIED)

    try:
        # Voyage embed_texts is synchronous; run in a thread to avoid blocking
        # the event loop.
        vectors = await asyncio.to_thread(
            embed_texts, [question], "query"
        )
        if not vectors or not vectors[0]:
            logger.warning("embedding returned empty for recovery question")
            return {"status": "error"}

        embedding = vectors[0]
        pipeline = build_plan_search_pipeline(embedding, patient_id)

        collection = CarePlanChunk.get_motor_collection()
        raw: list[dict[str, Any]] = []
        async for doc in collection.aggregate(pipeline):
            raw.append(doc)

        context = format_context(raw)
        if not context:
            return {"status": "no_context"}

        return {
            "status": "ok",
            "question": question,
            "context": context,
        }
    except Exception:
        logger.warning("answer_recovery_question failed", exc_info=True)
        return {"status": "error"}
