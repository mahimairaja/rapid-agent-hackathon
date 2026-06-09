import time
from datetime import UTC, datetime

from fastapi import APIRouter

from src.db.mongo import ping

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
async def health_detailed() -> dict[str, object]:
    checks: dict[str, str] = {}

    try:
        await ping()
        checks["mongodb"] = "healthy"
    except Exception as exc:
        checks["mongodb"] = f"unhealthy: {exc}"

    all_healthy = all(value == "healthy" for value in checks.values())
    return {
        "status": "healthy" if all_healthy else "degraded",
        "checks": checks,
        "uptime_seconds": int(time.time() - START_TIME),
    }
