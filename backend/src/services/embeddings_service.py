"""Voyage AI embedding client wrapper.

Used by the M0 ingest scripts and, later, by F2/F3 retrieval. Returns 1024-dim
vectors (configurable) suitable for the Atlas Vector Search indexes.

Batches by estimated token count and throttles/retries so it works on Voyage's
free tier (3 requests/min, 10K tokens/min). Add a payment method to lift the
limits; the code automatically goes faster once the API allows it.
"""

import logging
import time

import voyageai
from voyageai.error import RateLimitError

from src.core.config import config

logger = logging.getLogger(__name__)

_MAX_BATCH = 128  # Voyage per-request item cap
_MAX_TOKENS_PER_REQUEST = 9000  # stay under the free-tier 10K TPM
_MIN_INTERVAL = 21.0  # seconds between requests (free-tier 3 RPM)
_MAX_RETRIES = 6

_client: voyageai.Client | None = None
_last_request_ts = 0.0


def _get_client() -> voyageai.Client:
    global _client
    if _client is None:
        if config.VOYAGE_API_KEY is None:
            raise RuntimeError(
                "VOYAGE_API_KEY is not set. Add it to the environment (or .env) "
                "before generating embeddings."
            )
        _client = voyageai.Client(api_key=config.VOYAGE_API_KEY.get_secret_value())
    return _client


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _batch(texts: list[str]) -> list[list[str]]:
    batches: list[list[str]] = []
    current: list[str] = []
    current_tokens = 0
    for text in texts:
        tokens = _estimate_tokens(text)
        if current and (
            len(current) >= _MAX_BATCH
            or current_tokens + tokens > _MAX_TOKENS_PER_REQUEST
        ):
            batches.append(current)
            current, current_tokens = [], 0
        current.append(text)
        current_tokens += tokens
    if current:
        batches.append(current)
    return batches


def _embed_one(client: voyageai.Client, batch: list[str], input_type: str):
    global _last_request_ts
    delay = 30.0
    for attempt in range(_MAX_RETRIES):
        if _last_request_ts and _MIN_INTERVAL:
            wait = _MIN_INTERVAL - (time.monotonic() - _last_request_ts)
            if wait > 0:
                time.sleep(wait)
        try:
            _last_request_ts = time.monotonic()
            result = client.embed(
                batch,
                model=config.VOYAGE_MODEL,
                input_type=input_type,
                output_dimension=config.VOYAGE_DIM,
            )
            return result.embeddings
        except RateLimitError:
            if attempt == _MAX_RETRIES - 1:
                raise
            logger.warning("Voyage rate limit hit; backing off %.0fs", delay)
            time.sleep(delay)
            delay = min(delay * 1.5, 90.0)
    return []


def embed_texts(texts: list[str], input_type: str = "document") -> list[list[float]]:
    """Embed texts, batching by token budget and throttling for rate limits.

    input_type: "document" when embedding corpus chunks, "query" at search time.
    """
    if not texts:
        return []
    client = _get_client()
    vectors: list[list[float]] = []
    for batch in _batch(texts):
        vectors.extend(_embed_one(client, batch, input_type))
    return vectors
