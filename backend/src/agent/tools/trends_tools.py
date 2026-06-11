"""Recovery trends over the patient's check-ins, served through MCP (F8).

The aggregation itself runs inside MongoDB via the official
mongodb-mcp-server (read-only): this tool only pins the pipeline, scopes it
to the verified patient, and summarizes the result rows. The model never
writes a pipeline and never sees another patient's data.
"""

import logging
import re
from datetime import UTC, datetime, timedelta

from google.adk.tools import ToolContext

from src.agent.agent.session_state import verified_patient_id
from src.services import mcp_mongodb
from src.services.mcp_mongodb import McpUnavailableError

logger = logging.getLogger(__name__)

_UNVERIFIED = {
    "status": "unverified",
    "message": (
        "I need to confirm who you are before I can share any plan details. "
        "Could you tell me your full name and date of birth, or your patient code?"
    ),
}

# F5 writes escalations as "{text} [{rule_id}]"; pull the rule id back out.
_RULE_SUFFIX = re.compile(r"\[([a-z0-9_]+)\]\s*$")


def _checkin_pipeline(patient_id: str, cutoff_iso: str) -> list[dict]:
    """Daily check-in buckets with average pain parsed in-pipeline."""
    return [
        {
            "$match": {
                "patient_id": patient_id,
                "created_at": {"$gte": {"$date": cutoff_iso}},
            }
        },
        {
            "$project": {
                "_id": 0,
                "day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "pain": {
                    "$toInt": {
                        "$arrayElemAt": [
                            {
                                "$getField": {
                                    "field": "captures",
                                    "input": {
                                        "$regexFind": {
                                            "input": "$reported_text",
                                            "regex": r"pain level is (\d+)/10",
                                        }
                                    },
                                }
                            },
                            0,
                        ]
                    }
                },
            }
        },
        {
            "$group": {
                "_id": "$day",
                "avg_pain": {"$avg": "$pain"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]


def _escalation_pipeline(patient_id: str, cutoff_iso: str) -> list[dict]:
    return [
        {
            "$match": {
                "patient_id": patient_id,
                "created_at": {"$gte": {"$date": cutoff_iso}},
            }
        },
        {
            "$project": {
                "_id": 0,
                "message": 1,
                "level": 1,
                "day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            }
        },
        {"$sort": {"day": 1}},
    ]


async def recovery_trends(days: int = 7, *, tool_context: ToolContext) -> dict:
    """Summarize the patient's recent check-ins and any red flags.

    Use when the patient asks how they are doing, how their week or recovery
    has been going, or about their progress. Returns daily check-in counts,
    average reported pain per day, the pain trend endpoints, and any
    red-flag escalations in the window.
    """
    patient_id = verified_patient_id(tool_context.state)
    if not patient_id:
        return dict(_UNVERIFIED)
    days = max(1, min(int(days), 30))
    cutoff = datetime.now(UTC) - timedelta(days=days)
    cutoff_iso = cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        daily_rows = await mcp_mongodb.mcp_aggregate(
            "checkins", _checkin_pipeline(patient_id, cutoff_iso)
        )
        escalation_rows = await mcp_mongodb.mcp_aggregate(
            "escalations", _escalation_pipeline(patient_id, cutoff_iso)
        )
    except McpUnavailableError:
        logger.warning("recovery_trends: mcp unavailable", exc_info=True)
        return {"status": "unavailable"}

    daily = [
        {
            "date": row.get("_id"),
            "avg_pain": row.get("avg_pain"),
            "count": row.get("count", 0),
        }
        for row in daily_rows
        if row.get("_id")
    ]
    pains = [d["avg_pain"] for d in daily if d["avg_pain"] is not None]
    red_flags = []
    for row in escalation_rows:
        match = _RULE_SUFFIX.search(row.get("message", "") or "")
        red_flags.append(
            {
                "rule_id": match.group(1) if match else (row.get("level") or "flag"),
                "date": row.get("day"),
            }
        )
    checkin_count = sum(d["count"] for d in daily)
    if checkin_count == 0 and not red_flags:
        return {"status": "no_data", "days": days}
    return {
        "status": "ok",
        "days": days,
        "checkin_count": checkin_count,
        "daily": daily,
        "first_avg_pain": pains[0] if pains else None,
        "last_avg_pain": pains[-1] if pains else None,
        "red_flags": red_flags,
    }
