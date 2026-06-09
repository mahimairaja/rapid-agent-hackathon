from src.services.chunking_service import chunk_text


def test_empty_text_returns_no_chunks():
    assert chunk_text("") == []
    assert chunk_text("   \n\n  ") == []


def test_short_text_is_single_chunk():
    assert chunk_text("a short note") == ["a short note"]


def test_long_text_splits_into_multiple_chunks():
    para = "x" * 500
    text = "\n\n".join([para] * 10)  # ~5000 chars
    chunks = chunk_text(text, target_chars=1800, overlap_chars=200)
    assert len(chunks) > 1
    assert all(len(c) <= int(1800 * 1.5) for c in chunks)
    # full content is covered
    assert "".join(chunks).count("x") >= 5000


def test_giant_paragraph_is_hard_split():
    chunks = chunk_text("y" * 6000, target_chars=1800, overlap_chars=200)
    assert len(chunks) > 1
    assert all(len(c) <= int(1800 * 1.5) for c in chunks)
