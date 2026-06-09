"""Ingest public-domain federal guideline texts into the ``guidelines`` collection.

Reads markdown files from ``backend/data/guidelines/`` (each with front matter:
source_id, title, url, license), chunks the body, embeds with Voyage, and stores
``GuidelineChunk`` documents with source attribution. Idempotent per source_id.

Run from the backend directory:

    uv run python scripts/ingest_guidelines.py
"""

import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from src.core.database import close_db, init_db  # noqa: E402
from src.models import GuidelineChunk  # noqa: E402
from src.services.chunking_service import chunk_text  # noqa: E402
from src.services.embeddings_service import embed_texts  # noqa: E402
from src.util.frontmatter import parse_front_matter  # noqa: E402

DATA_DIR = BACKEND_DIR / "data" / "guidelines"


async def ingest() -> None:
    await init_db()

    files = sorted(DATA_DIR.glob("*.md"))
    # (source_id, title, url, license, chunks)
    plan: list[tuple[str, str, str | None, str | None, list[str]]] = []
    for path in files:
        meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
        source_id = meta.get("source_id")
        if not source_id:
            print(f"skip {path.name}: no source_id in front matter")
            continue
        plan.append(
            (
                source_id,
                meta.get("title", path.stem),
                meta.get("url"),
                meta.get("license"),
                chunk_text(body),
            )
        )

    # Embed every chunk in one batched call (kind to Voyage rate limits).
    all_chunks = [c for *_, chunks in plan for c in chunks]
    all_vectors = embed_texts(all_chunks, input_type="document")

    cursor = 0
    total_chunks = 0
    for source_id, title, url, lic, chunks in plan:
        vectors = all_vectors[cursor : cursor + len(chunks)]
        cursor += len(chunks)

        # Idempotent: drop this source's existing chunks.
        await GuidelineChunk.find(GuidelineChunk.source_id == source_id).delete()

        docs = [
            GuidelineChunk(
                source_id=source_id,
                title=title,
                url=url,
                license=lic,
                chunk_index=i,
                text=text,
                embedding=vector,
            )
            for i, (text, vector) in enumerate(zip(chunks, vectors, strict=True))
        ]
        if docs:
            await GuidelineChunk.insert_many(docs)
        total_chunks += len(docs)
        print(f"{source_id}: {len(docs)} chunks")

    print(f"Ingested {total_chunks} guideline chunks from {len(files)} sources.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(ingest())
