"""Small Cal.com API v2 client for F4 appointment scheduling.

The ADK tools use this client server-side only; the Cal.com API key is never
returned to the frontend or to the model. The implementation uses stdlib HTTP
so F4 does not add a production dependency.
"""

import asyncio
import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, cast

from src.core.config import config
from src.models import Patient

# Cal.com sits behind Cloudflare, which blocks the stdlib default
# ("Python-urllib/x.y") User-Agent with a 1010 "Access denied" 403. Send an
# explicit application User-Agent so requests are allowed through.
_USER_AGENT = "Homeward/1.0 (Rapid Agent F4 scheduler)"


class CalComError(RuntimeError):
    """Base class for Cal.com integration failures."""


class CalComConfigError(CalComError):
    """Raised when required Cal.com settings are missing."""


class CalComAPIError(CalComError):
    """Raised when Cal.com returns an error response."""

    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class CalBooking:
    uid: str
    start: datetime
    end: datetime | None = None
    status: str | None = None
    location: str | None = None


def _parse_dt(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _utc_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return (
        value.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    )


def _first_booking_data(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    if isinstance(data, list):
        data = data[0] if data else {}
    return data if isinstance(data, dict) else {}


def _booking_from_payload(payload: dict[str, Any]) -> CalBooking:
    data = _first_booking_data(payload)
    uid = data.get("uid")
    start = data.get("start")
    if not uid or not start:
        raise CalComAPIError(502, "Cal.com booking response did not include uid/start")
    return CalBooking(
        uid=str(uid),
        start=_parse_dt(str(start)),
        end=_parse_dt(str(data["end"])) if data.get("end") else None,
        status=str(data["status"]) if data.get("status") else None,
        location=str(data["location"]) if data.get("location") else None,
    )


class CalComClient:
    def __init__(self, timeout_seconds: float = 10.0):
        self.timeout_seconds = timeout_seconds

    async def get_available_slots(
        self,
        start: datetime,
        end: datetime,
        *,
        time_zone: str | None = None,
        booking_uid_to_reschedule: str | None = None,
    ) -> list[datetime]:
        params: dict[str, str] = {
            "eventTypeSlug": self._event_type_slug(),
            "username": self._username(),
            "start": _utc_iso(start),
            "end": _utc_iso(end),
            "timeZone": time_zone or config.CLINIC_TIMEZONE,
        }
        if booking_uid_to_reschedule:
            params["bookingUidToReschedule"] = booking_uid_to_reschedule
        payload = await self._request(
            "GET",
            "/v2/slots",
            api_version=config.CAL_SLOTS_API_VERSION,
            params=params,
        )
        return _slots_from_payload(payload)

    async def create_booking(
        self,
        start: datetime,
        patient: Patient,
        *,
        time_zone: str | None = None,
    ) -> CalBooking:
        body = {
            "start": _utc_iso(start),
            "attendee": _attendee(patient, time_zone=time_zone),
            "eventTypeSlug": self._event_type_slug(),
            "username": self._username(),
            "metadata": {
                "patient_id": patient.patient_id,
                "source": "rapid-agent-f4",
            },
        }
        payload = await self._request(
            "POST",
            "/v2/bookings",
            api_version=config.CAL_BOOKINGS_API_VERSION,
            body=body,
        )
        return _booking_from_payload(payload)

    async def get_booking(self, booking_uid: str) -> CalBooking:
        payload = await self._request(
            "GET",
            f"/v2/bookings/{urllib.parse.quote(booking_uid, safe='')}",
            api_version=config.CAL_BOOKINGS_API_VERSION,
        )
        return _booking_from_payload(payload)

    async def reschedule_booking(
        self,
        booking_uid: str,
        start: datetime,
        patient: Patient,
        *,
        time_zone: str | None = None,
    ) -> CalBooking:
        body = {
            "start": _utc_iso(start),
            "rescheduledBy": patient.email or _fallback_email(patient),
            "reschedulingReason": "Patient requested follow-up reschedule by voice",
        }
        payload = await self._request(
            "POST",
            f"/v2/bookings/{urllib.parse.quote(booking_uid, safe='')}/reschedule",
            api_version=config.CAL_BOOKINGS_API_VERSION,
            body=body,
        )
        return _booking_from_payload(payload)

    async def _request(
        self,
        method: str,
        path: str,
        *,
        api_version: str,
        params: dict[str, str] | None = None,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await asyncio.to_thread(
            self._request_sync,
            method,
            path,
            api_version,
            params,
            body,
        )

    def _request_sync(
        self,
        method: str,
        path: str,
        api_version: str,
        params: dict[str, str] | None,
        body: dict[str, Any] | None,
    ) -> dict[str, Any]:
        api_key = config.CAL_API_KEY
        if api_key is None:
            raise CalComConfigError("CAL_API_KEY is not configured")

        base = config.CAL_API_BASE_URL.rstrip("/")
        query = f"?{urllib.parse.urlencode(params)}" if params else ""
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {
            "Authorization": f"Bearer {api_key.get_secret_value()}",
            "cal-api-version": api_version,
            "Accept": "application/json",
            "User-Agent": _USER_AGENT,
        }
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(
            f"{base}{path}{query}",
            data=data,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(
                request, timeout=self.timeout_seconds
            ) as response:
                raw = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="replace")
            raise CalComAPIError(exc.code, message) from exc
        except urllib.error.URLError as exc:
            raise CalComAPIError(503, str(exc.reason)) from exc

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise CalComAPIError(502, "Cal.com returned invalid JSON") from exc
        if payload.get("status") == "error":
            raise CalComAPIError(502, json.dumps(payload))
        return cast(dict[str, Any], payload)

    def _event_type_slug(self) -> str:
        if not config.CAL_EVENT_TYPE_SLUG:
            raise CalComConfigError("CAL_EVENT_TYPE_SLUG is not configured")
        return config.CAL_EVENT_TYPE_SLUG

    def _username(self) -> str:
        if not config.CAL_USERNAME:
            raise CalComConfigError("CAL_USERNAME is not configured")
        return config.CAL_USERNAME


def _attendee(patient: Patient, *, time_zone: str | None = None) -> dict[str, str]:
    attendee = {
        "name": f"{patient.first_name} {patient.last_name}",
        "email": patient.email or _fallback_email(patient),
        "timeZone": time_zone or config.CLINIC_TIMEZONE,
        "language": "en",
    }
    if patient.phone and patient.phone.startswith("+"):
        attendee["phoneNumber"] = patient.phone
    return attendee


def _fallback_email(patient: Patient) -> str:
    safe_id = "".join(ch if ch.isalnum() else "-" for ch in patient.patient_id).lower()
    return f"{safe_id}@example.com"


def _slots_from_payload(payload: dict[str, Any]) -> list[datetime]:
    data = payload.get("data")
    if not isinstance(data, dict):
        return []

    slots: list[datetime] = []
    for day_slots in data.values():
        if not isinstance(day_slots, list):
            continue
        for item in day_slots:
            if isinstance(item, str):
                slots.append(_parse_dt(item))
            elif isinstance(item, dict) and item.get("start"):
                slots.append(_parse_dt(str(item["start"])))
    return sorted(slots)


def get_calcom_client() -> CalComClient:
    return CalComClient()
