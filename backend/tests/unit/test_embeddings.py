import src.services.embeddings_service as embeddings


class _FakeResult:
    def __init__(self, vectors):
        self.embeddings = vectors


class _FakeClient:
    def __init__(self):
        self.calls = []

    def embed(self, texts, model, input_type, output_dimension):
        self.calls.append((list(texts), model, input_type, output_dimension))
        return _FakeResult([[0.0] * output_dimension for _ in texts])


def test_embed_texts_empty_returns_empty():
    assert embeddings.embed_texts([]) == []


def test_embed_texts_no_key_raises(monkeypatch):
    import pytest

    monkeypatch.setattr(embeddings, "_client", None)
    monkeypatch.setattr(embeddings.config, "VOYAGE_API_KEY", None)
    with pytest.raises(RuntimeError):
        embeddings.embed_texts(["a"])


def test_embed_texts_retries_on_rate_limit(monkeypatch):
    from voyageai.error import RateLimitError

    calls = {"n": 0}

    class _Flaky:
        def embed(self, texts, model, input_type, output_dimension):
            calls["n"] += 1
            if calls["n"] == 1:
                raise RateLimitError("rate limited")
            return _FakeResult([[0.0] * output_dimension for _ in texts])

    monkeypatch.setattr(embeddings, "_get_client", lambda: _Flaky())
    monkeypatch.setattr(embeddings, "_MIN_INTERVAL", 0)
    monkeypatch.setattr(embeddings.time, "sleep", lambda _s: None)

    vectors = embeddings.embed_texts(["a"])
    assert len(vectors) == 1
    assert calls["n"] == 2  # retried once after the rate-limit error


def test_embed_texts_raises_on_cardinality_mismatch(monkeypatch):
    import pytest

    class _Bad:
        def embed(self, texts, model, input_type, output_dimension):
            # Return fewer vectors than inputs to break the 1:1 contract.
            return _FakeResult([[0.0] * output_dimension])

    monkeypatch.setattr(embeddings, "_get_client", lambda: _Bad())
    monkeypatch.setattr(embeddings, "_MIN_INTERVAL", 0)
    with pytest.raises(ValueError):
        embeddings.embed_texts(["a", "b"])


def test_embed_texts_batches_and_shapes(monkeypatch):
    fake = _FakeClient()
    monkeypatch.setattr(embeddings, "_get_client", lambda: fake)
    monkeypatch.setattr(embeddings, "_MAX_BATCH", 2)
    monkeypatch.setattr(embeddings, "_MIN_INTERVAL", 0)  # no throttling in tests

    vectors = embeddings.embed_texts(["a", "b", "c"], input_type="document")

    assert len(vectors) == 3
    assert all(len(v) == embeddings.config.VOYAGE_DIM for v in vectors)
    # 3 items with batch size 2 -> 2 calls
    assert len(fake.calls) == 2
    assert fake.calls[0][2] == "document"
