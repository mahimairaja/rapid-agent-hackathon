"""Unit tests for the Cal.com API adapter (no network)."""

import json
import urllib.error
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from pydantic import SecretStr

from src.services import calcom_service as cal
from src.services.calcom_service import (
    CalComAPIError,
    CalComClient,
    CalComConfigError,
)


def _patient(**overrides):
    data = {
        "patient_id": "pid-1",
        "first_name": "Pat",
        "last_name": "One",
        "email": "pat@example.com",
        "phone": "+15550101",
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def test_datetime_and_payload_helpers():
    assert cal._parse_dt("2026-06-10T14:00:00Z") == datetime(
        2026, 6, 10, 14, 0, tzinfo=UTC
    )
    assert cal._parse_dt("2026-06-10T14:00:00").tzinfo == UTC
    assert (
        cal._utc_iso(datetime(2026, 6, 10, 14, 0, 1, 123456, tzinfo=UTC))
        == "2026-06-10T14:00:01Z"
    )

    assert cal._first_booking_data({"data": [{"uid": "u"}]}) == {"uid": "u"}
    assert cal._first_booking_data({"data": []}) == {}
    assert cal._first_booking_data({"data": "bad"}) == {}

    booking = cal._booking_from_payload(
        {
            "data": {
                "uid": "book-1",
                "start": "2026-06-10T14:00:00Z",
                "end": "2026-06-10T14:30:00Z",
                "status": "accepted",
                "location": "Video",
            }
        }
    )
    assert booking.uid == "book-1"
    assert booking.end == datetime(2026, 6, 10, 14, 30, tzinfo=UTC)

    with pytest.raises(CalComAPIError):
        cal._booking_from_payload({"data": {"uid": "missing-start"}})


def test_attendee_fallback_and_slots():
    attendee = cal._attendee(_patient(email=None, phone="555-0101"))
    assert attendee["email"] == "pid-1@example.com"
    assert "phoneNumber" not in attendee

    attendee_tz = cal._attendee(_patient(), time_zone="America/Toronto")
    assert attendee_tz["timeZone"] == "America/Toronto"
    assert attendee_tz["phoneNumber"] == "+15550101"

    slots = cal._slots_from_payload(
        {
            "data": {
                "2026-06-10": [
                    "2026-06-10T15:00:00Z",
                    {"start": "2026-06-10T14:00:00Z"},
                    {"no_start": "skip"},
                ],
                "bad": "skip",
            }
        }
    )
    assert slots == [
        datetime(2026, 6, 10, 14, 0, tzinfo=UTC),
        datetime(2026, 6, 10, 15, 0, tzinfo=UTC),
    ]
    assert cal._slots_from_payload({"data": []}) == []


class RecordingClient(CalComClient):
    def __init__(self):
        super().__init__()
        self.calls = []

    async def _request(self, method, path, *, api_version, params=None, body=None):
        self.calls.append((method, path, api_version, params, body))
        if path == "/v2/slots":
            return {"data": {"2026-06-10": [{"start": "2026-06-10T14:00:00Z"}]}}
        return {
            "data": {
                "uid": "book-1",
                "start": "2026-06-10T14:00:00Z",
                "end": "2026-06-10T14:30:00Z",
            }
        }


async def test_client_methods_build_expected_requests(monkeypatch):
    monkeypatch.setattr(cal.config, "CAL_EVENT_TYPE_SLUG", "follow-up")
    monkeypatch.setattr(cal.config, "CAL_USERNAME", "clinician")
    client = RecordingClient()
    start = datetime(2026, 6, 10, 14, 0, tzinfo=UTC)
    end = datetime(2026, 6, 10, 15, 0, tzinfo=UTC)

    slots = await client.get_available_slots(
        start,
        end,
        time_zone="America/Toronto",
        booking_uid_to_reschedule="old",
    )
    assert slots == [start]
    method, path, version, params, body = client.calls[-1]
    assert (method, path, version, body) == ("GET", "/v2/slots", "2024-09-04", None)
    assert params["eventTypeSlug"] == "follow-up"
    assert params["username"] == "clinician"
    assert params["timeZone"] == "America/Toronto"
    assert params["bookingUidToReschedule"] == "old"

    booking = await client.create_booking(
        start, _patient(), time_zone="America/Toronto"
    )
    assert booking.uid == "book-1"
    _, path, version, _, body = client.calls[-1]
    assert (path, version) == ("/v2/bookings", "2026-02-25")
    assert body["attendee"]["timeZone"] == "America/Toronto"

    fetched = await client.get_booking("book 1")
    assert fetched.uid == "book-1"
    assert client.calls[-1][1] == "/v2/bookings/book%201"

    moved = await client.reschedule_booking("book 1", start, _patient(email=None))
    assert moved.uid == "book-1"
    _, path, _, _, body = client.calls[-1]
    assert path == "/v2/bookings/book%201/reschedule"
    assert body["rescheduledBy"] == "pid-1@example.com"


def test_client_config_validation(monkeypatch):
    client = CalComClient()

    monkeypatch.setattr(cal.config, "CAL_EVENT_TYPE_SLUG", None)
    with pytest.raises(CalComConfigError):
        client._event_type_slug()

    monkeypatch.setattr(cal.config, "CAL_EVENT_TYPE_SLUG", "follow-up")
    assert client._event_type_slug() == "follow-up"

    monkeypatch.setattr(cal.config, "CAL_USERNAME", None)
    with pytest.raises(CalComConfigError):
        client._username()

    monkeypatch.setattr(cal.config, "CAL_USERNAME", "clinician")
    assert client._username() == "clinician"


class FakeResponse:
    def __init__(self, body: str):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return self.body.encode("utf-8")

    def close(self):
        pass


def test_request_sync_success_and_errors(monkeypatch):
    client = CalComClient(timeout_seconds=1)
    monkeypatch.setattr(cal.config, "CAL_API_KEY", SecretStr("cal_test"))
    monkeypatch.setattr(cal.config, "CAL_API_BASE_URL", "https://api.cal.test")

    seen = {}

    def ok_urlopen(request, timeout):
        seen["url"] = request.full_url
        seen["method"] = request.get_method()
        seen["timeout"] = timeout
        seen["auth"] = request.headers["Authorization"]
        return FakeResponse('{"status":"success","data":{"ok":true}}')

    monkeypatch.setattr(cal.urllib.request, "urlopen", ok_urlopen)
    payload = client._request_sync(
        "POST",
        "/v2/test",
        "2026-02-25",
        {"q": "a b"},
        {"x": 1},
    )
    assert payload["data"]["ok"] is True
    assert seen == {
        "url": "https://api.cal.test/v2/test?q=a+b",
        "method": "POST",
        "timeout": 1,
        "auth": "Bearer cal_test",
    }

    monkeypatch.setattr(cal.config, "CAL_API_KEY", None)
    with pytest.raises(CalComConfigError):
        client._request_sync("GET", "/v2/test", "v", None, None)

    monkeypatch.setattr(cal.config, "CAL_API_KEY", SecretStr("cal_test"))

    def http_error(*args, **kwargs):
        raise urllib.error.HTTPError(
            "https://api.cal.test", 400, "bad", {}, FakeResponse("bad request")
        )

    monkeypatch.setattr(cal.urllib.request, "urlopen", http_error)
    with pytest.raises(CalComAPIError) as http_exc:
        client._request_sync("GET", "/v2/test", "v", None, None)
    assert http_exc.value.status_code == 400

    def url_error(*args, **kwargs):
        raise urllib.error.URLError("offline")

    monkeypatch.setattr(cal.urllib.request, "urlopen", url_error)
    with pytest.raises(CalComAPIError) as url_exc:
        client._request_sync("GET", "/v2/test", "v", None, None)
    assert url_exc.value.status_code == 503

    monkeypatch.setattr(
        cal.urllib.request, "urlopen", lambda *a, **k: FakeResponse("{not-json")
    )
    with pytest.raises(CalComAPIError):
        client._request_sync("GET", "/v2/test", "v", None, None)

    monkeypatch.setattr(
        cal.urllib.request,
        "urlopen",
        lambda *a, **k: FakeResponse(json.dumps({"status": "error"})),
    )
    with pytest.raises(CalComAPIError):
        client._request_sync("GET", "/v2/test", "v", None, None)


async def test_async_request_delegates_to_sync(monkeypatch):
    client = CalComClient()

    def fake_sync(method, path, api_version, params, body):
        return {"method": method, "path": path, "api_version": api_version}

    monkeypatch.setattr(client, "_request_sync", fake_sync)
    assert await client._request("GET", "/v2/test", api_version="v") == {
        "method": "GET",
        "path": "/v2/test",
        "api_version": "v",
    }


def test_factory_returns_client():
    assert isinstance(cal.get_calcom_client(), CalComClient)
