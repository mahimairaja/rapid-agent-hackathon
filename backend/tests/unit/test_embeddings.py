import src.services.embeddings as embeddings


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
