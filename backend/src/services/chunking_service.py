"""Lightweight, dependency-free text chunker for the RAG corpora.

Splits on paragraph boundaries, accumulates to a target size with a small
overlap, and hard-splits any paragraph that is still too large. Sizes are in
characters (~4 chars/token, so ~1800 chars is roughly a 450-token chunk).
"""

DEFAULT_TARGET_CHARS = 1800
DEFAULT_OVERLAP_CHARS = 200


def chunk_text(
    text: str,
    target_chars: int = DEFAULT_TARGET_CHARS,
    overlap_chars: int = DEFAULT_OVERLAP_CHARS,
) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= target_chars:
        return [text]

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        if current and len(current) + len(para) + 2 > target_chars:
            chunks.append(current.strip())
            tail = current[-overlap_chars:] if overlap_chars else ""
            current = f"{tail}\n\n{para}" if tail else para
        else:
            current = f"{current}\n\n{para}" if current else para
    if current.strip():
        chunks.append(current.strip())

    # Hard-split any chunk that is still oversized (e.g. one giant paragraph).
    out: list[str] = []
    limit = int(target_chars * 1.5)
    step = max(1, target_chars - overlap_chars)
    for chunk in chunks:
        if len(chunk) <= limit:
            out.append(chunk)
        else:
            for i in range(0, len(chunk), step):
                piece = chunk[i : i + target_chars].strip()
                if piece:
                    out.append(piece)
    return out
