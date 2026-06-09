import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.core.logging_conf import configure_logging
from src.db.mongo import close_db, init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    await init_db()
    logger.info("Startup event completed")

    yield

    await close_db()
    logger.info("Shutdown event completed")
