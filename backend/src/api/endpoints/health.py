import time
from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from src.core.config import config
from src.core.database import ping

router = APIRouter(tags=["health"])
START_TIME = time.time()


@router.get("/health")
async def health() -> dict[str, str | int]:
    return {
        "status": "healthy",
        "uptime_seconds": int(time.time() - START_TIME),
        "timestamp": datetime.now(UTC).isoformat(),
        "version": "0.1.0",
    }


@router.get("/health/detailed")
async def health_detailed() -> JSONResponse:
    checks: dict[str, str] = {}

    try:
        await ping()
        checks["mongodb"] = "healthy"
    except Exception as exc:
        # Never leak raw connection/host details to clients in production.
        checks["mongodb"] = f"unhealthy: {exc}" if config.DEBUG else "unhealthy"

    all_healthy = all(value == "healthy" for value in checks.values())
    return JSONResponse(
        status_code=200 if all_healthy else 503,
        content={
            "status": "healthy" if all_healthy else "degraded",
            "checks": checks,
            "uptime_seconds": int(time.time() - START_TIME),
        },
    )
