"""Embed authored discharge narratives into the ``care_plans`` collection.

Each markdown file in ``backend/data/patients/`` has front matter with the
``patient_id`` it belongs to. The body is chunked, embedded with Voyage, and
stored as ``CarePlanChunk`` documents tagged with that patient_id (so F2 can do
plan-scoped retrieval). Idempotent: re-running replaces a patient's chunks.

Run from the backend directory:

    uv run python scripts/load_narratives.py
"""

import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from src.core.database import close_db, init_db  # noqa: E402
from src.models import CarePlanChunk  # noqa: E402
from src.services.chunking_service import chunk_text  # noqa: E402
from src.services.embeddings_service import embed_texts  # noqa: E402
from src.util.frontmatter import parse_front_matter  # noqa: E402

DATA_DIR = BACKEND_DIR / "data" / "patients"


async def load() -> None:
    await init_db()

    files = sorted(DATA_DIR.glob("*.md"))
    plan: list[tuple[str, str, list[str]]] = []  # (filename, patient_id, chunks)
    for path in files:
        meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
        patient_id = meta.get("patient_id")
        if not patient_id:
            print(f"skip {path.name}: no patient_id in front matter")
            continue
        plan.append((path.name, patient_id, chunk_text(body)))

    # Embed every chunk in one batched call (kind to Voyage rate limits).
    all_chunks = [c for _, _, chunks in plan for c in chunks]
    all_vectors = embed_texts(all_chunks, input_type="document")

    cursor = 0
    total_chunks = 0
    for filename, patient_id, chunks in plan:
        vectors = all_vectors[cursor : cursor + len(chunks)]
        cursor += len(chunks)

        # Idempotent: drop this patient's existing care-plan chunks.
        await CarePlanChunk.find(CarePlanChunk.patient_id == patient_id).delete()

        docs = [
            CarePlanChunk(
                patient_id=patient_id,
                source_file=filename,
                chunk_index=i,
                text=text,
                embedding=vector,
            )
            for i, (text, vector) in enumerate(zip(chunks, vectors, strict=True))
        ]
        if docs:
            await CarePlanChunk.insert_many(docs)
        total_chunks += len(docs)
        print(f"{filename}: {len(docs)} chunks -> patient {patient_id}")

    print(f"Loaded {total_chunks} care-plan chunks from {len(files)} narratives.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(load())
