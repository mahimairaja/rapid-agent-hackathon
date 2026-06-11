# ---- 1) Builder: resolve and install deps into a venv with uv -------------
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Bring in the uv binary (pinned image)
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies first (cached layer), without the project source
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

# Now copy the source and install the project itself
COPY . .
RUN uv sync --frozen --no-dev

# ---- 2) Runtime: minimal image, just the venv + app -----------------------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH="/app" \
    PATH="/app/.venv/bin:$PATH"

# tini for proper signal handling (tiny footprint)
RUN apt-get update && \
    apt-get install -y --no-install-recommends tini && \
    rm -rf /var/lib/apt/lists/*

# Node.js runtime + the MongoDB MCP server, spawned over stdio by the backend
# (recovery_trends). Preinstalled at build time so Cloud Run never pays a cold
# npx download inside a request.
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm install -g mongodb-mcp-server && \
    apt-get purge -y curl && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash appuser
WORKDIR /app

# Copy the fully-built app (including .venv) from the builder
COPY --from=builder --chown=appuser:appuser /app /app

USER appuser
EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--"]
# Default to a single worker: agent and voice sessions live in an in-process
# InMemorySessionService, so the chat session id and the voice grounding-context
# endpoint only resolve when every request hits the same process. Multiple
# workers split that state and the grounding panel would intermittently read a
# worker that never saw the session. Run one instance for the demo; scaling out
# requires a shared session store first.
CMD exec gunicorn -k uvicorn.workers.UvicornWorker src.main:app \
    --bind "0.0.0.0:${PORT:-8080}" \
    --workers "${WEB_CONCURRENCY:-1}" \
    --timeout 0 \
    --access-logfile - --error-logfile -
