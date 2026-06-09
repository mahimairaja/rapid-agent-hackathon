import logging

from beanie import init_beanie
from pymongo import AsyncMongoClient

from src.core.config import config
from src.models import DOCUMENT_MODELS

logger = logging.getLogger(__name__)

_client: AsyncMongoClient | None = None


def get_client() -> AsyncMongoClient:
    """Return the shared motor client, creating it on first use."""
    global _client
    if _client is None:
        if config.MONGODB_URI is None:
            raise RuntimeError(
                "MONGODB_URI is not set. Add the Atlas SRV connection string to "
                "the environment (or .env) before connecting to MongoDB."
            )
        _client = AsyncMongoClient(config.MONGODB_URI.get_secret_value())
    return _client


async def init_db() -> None:
    """Initialize Beanie against the configured database and document models."""
    client = get_client()
    await init_beanie(
        database=client[config.MONGODB_DB], document_models=DOCUMENT_MODELS
    )
    logger.info("Beanie initialized on database '%s'", config.MONGODB_DB)


async def close_db() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None
        logger.info("MongoDB client closed")


async def ping() -> None:
    """Round-trip the server to confirm connectivity (used by health checks)."""
    await get_client().admin.command("ping")
