"""Create Atlas Vector Search indexes for the RAG corpora.

Standard indexes (users.email unique, patient_id, etc.) are created by Beanie at
startup; this script adds the Atlas Vector Search indexes that F2/F3 query:

- care_plans.embedding  (1024-dim, cosine) + patient_id filter for plan-scoped search
- guidelines.embedding  (1024-dim, cosine) + source_id filter

Idempotent: existing indexes are left in place. Polls until each index is
queryable. Run from the backend directory:

    uv run python scripts/create_indexes.py
"""

import asyncio
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from pymongo.operations import SearchIndexModel  # noqa: E402

from src.core.config import config  # noqa: E402
from src.core.database import close_db, get_client  # noqa: E402

# (collection, index_name, fields)
VECTOR_INDEXES = [
    (
        "care_plans",
        "care_plans_vector",
        [
            {
                "type": "vector",
                "path": "embedding",
                "numDimensions": config.VOYAGE_DIM,
                "similarity": "cosine",
            },
            {"type": "filter", "path": "patient_id"},
        ],
    ),
    (
        "guidelines",
        "guidelines_vector",
        [
            {
                "type": "vector",
                "path": "embedding",
                "numDimensions": config.VOYAGE_DIM,
                "similarity": "cosine",
            },
            {"type": "filter", "path": "source_id"},
        ],
    ),
]


async def _existing_index_names(coll) -> set[str]:
    names: set[str] = set()
    async for idx in await coll.list_search_indexes():
        names.add(idx["name"])
    return names


async def _wait_until_queryable(coll, index_name: str, timeout: float = 240.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        async for idx in await coll.list_search_indexes(index_name):
            if idx.get("queryable"):
                print(f"  {index_name}: queryable")
                return
        await asyncio.sleep(5)
    raise RuntimeError(f"{index_name} did not become queryable within {int(timeout)}s")


async def create() -> None:
    db = get_client()[config.MONGODB_DB]

    for coll_name, index_name, fields in VECTOR_INDEXES:
        coll = db[coll_name]
        if index_name in await _existing_index_names(coll):
            print(f"{coll_name}.{index_name}: already exists")
            continue
        model = SearchIndexModel(
            definition={"fields": fields},
            name=index_name,
            type="vectorSearch",
        )
        await coll.create_search_index(model)
        print(f"{coll_name}.{index_name}: created, building...")

    print("Waiting for indexes to become queryable...")
    for coll_name, index_name, _ in VECTOR_INDEXES:
        await _wait_until_queryable(db[coll_name], index_name)

    await close_db()


if __name__ == "__main__":
    asyncio.run(create())
