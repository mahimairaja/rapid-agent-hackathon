"""Read-only access to MongoDB through the official mongodb-mcp-server.

One stdio-backed MCP session per process, started lazily on first use. The
only operation exposed is ``aggregate`` with a caller-supplied (always
pinned, patient-scoped) pipeline; the server runs with MDB_MCP_READ_ONLY so
even a bad pipeline cannot write.
"""

import asyncio
import json
import logging
import os
import shutil
from contextlib import AsyncExitStack
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from src.core.config import config

logger = logging.getLogger(__name__)

_CALL_TIMEOUT_S = 8.0


class McpUnavailableError(RuntimeError):
    """The MCP server could not be reached or the call failed."""


def server_command() -> list[str]:
    """The Docker image preinstalls the server; local dev falls back to npx."""
    if shutil.which("mongodb-mcp-server"):
        return ["mongodb-mcp-server"]
    return ["npx", "-y", "mongodb-mcp-server"]


def parse_tool_text(texts: list[str]) -> list[dict[str, Any]]:
    """Parse mongodb-mcp-server aggregate output text into documents.

    The server returns JSON documents as text content; tolerate either one
    JSON array/object per content item or newline-delimited JSON.
    """
    docs: list[dict[str, Any]] = []
    for text in texts:
        text = text.strip()
        if not text:
            continue
        try:
            loaded = json.loads(text)
        except json.JSONDecodeError:
            loaded = None
        if isinstance(loaded, list):
            docs.extend(d for d in loaded if isinstance(d, dict))
            continue
        if isinstance(loaded, dict):
            docs.append(loaded)
            continue
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                line_doc = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(line_doc, dict):
                docs.append(line_doc)
            elif isinstance(line_doc, list):
                docs.extend(d for d in line_doc if isinstance(d, dict))
    return docs


class _McpRunner:
    """Owns the stdio subprocess + MCP session, restarted once per failure."""

    def __init__(self) -> None:
        self._stack: AsyncExitStack | None = None
        self._session: ClientSession | None = None
        self._lock = asyncio.Lock()

    async def _start(self) -> None:
        if config.MONGODB_URI is None:
            raise McpUnavailableError("MONGODB_URI is not configured")
        command = server_command()
        params = StdioServerParameters(
            command=command[0],
            args=command[1:],
            env={
                **os.environ,
                "MDB_MCP_CONNECTION_STRING": config.MONGODB_URI.get_secret_value(),
                "MDB_MCP_READ_ONLY": "true",
            },
        )
        stack = AsyncExitStack()
        try:
            read, write = await stack.enter_async_context(stdio_client(params))
            session = await stack.enter_async_context(ClientSession(read, write))
            await asyncio.wait_for(session.initialize(), timeout=_CALL_TIMEOUT_S)
        except BaseException:
            await stack.aclose()
            raise
        self._stack = stack
        self._session = session
        logger.info("mongodb-mcp-server session started (%s)", command[0])

    async def close(self) -> None:
        if self._stack is not None:
            try:
                await self._stack.aclose()
            except Exception:
                logger.debug("mcp stack close failed", exc_info=True)
        self._stack = None
        self._session = None

    async def aggregate(
        self, collection: str, pipeline: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        async with self._lock:
            last_error: Exception | None = None
            for attempt in range(2):
                try:
                    if self._session is None:
                        await self._start()
                    assert self._session is not None
                    result = await asyncio.wait_for(
                        self._session.call_tool(
                            "aggregate",
                            {
                                "database": config.MONGODB_DB,
                                "collection": collection,
                                "pipeline": pipeline,
                            },
                        ),
                        timeout=_CALL_TIMEOUT_S,
                    )
                    if getattr(result, "isError", False):
                        texts = [
                            c.text
                            for c in (result.content or [])
                            if getattr(c, "text", None)
                        ]
                        raise McpUnavailableError(
                            f"aggregate error: {' '.join(texts)[:200]}"
                        )
                    texts = [
                        c.text
                        for c in (result.content or [])
                        if getattr(c, "text", None)
                    ]
                    return parse_tool_text(texts)
                except Exception as err:  # noqa: BLE001 - degrade to unavailable
                    last_error = err
                    logger.warning(
                        "mcp aggregate failed (attempt %d): %s", attempt + 1, err
                    )
                    await self.close()
            raise McpUnavailableError(str(last_error))


_runner = _McpRunner()


async def mcp_aggregate(
    collection: str, pipeline: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Run a pinned aggregation through the MongoDB MCP server."""
    return await _runner.aggregate(collection, pipeline)


async def shutdown_mcp() -> None:
    """Close the MCP session and subprocess (app shutdown)."""
    await _runner.close()
