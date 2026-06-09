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

RUN useradd --create-home --shell /bin/bash appuser
WORKDIR /app

# Copy the fully-built app (including .venv) from the builder
COPY --from=builder --chown=appuser:appuser /app /app

USER appuser
EXPOSE 8080

# gunicorn (uvicorn worker) serving the real ASGI app at src.main:app.
# Shell form so ${PORT}/${WEB_CONCURRENCY} expand — Cloud Run injects PORT (default 8080).
# --timeout 0 disables gunicorn's worker timeout (Cloud Run enforces request timeouts;
# avoids killing workers during CPU-throttled cold starts).
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD exec gunicorn -k uvicorn.workers.UvicornWorker src.main:app \
    --bind "0.0.0.0:${PORT:-8080}" \
    --workers "${WEB_CONCURRENCY:-2}" \
    --timeout 0 \
    --access-logfile - --error-logfile -
