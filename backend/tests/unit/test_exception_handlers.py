from pymongo.errors import DuplicateKeyError
from starlette.requests import Request

from src.core.exception_handlers import duplicate_key_error_handler


def _request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "PATCH",
            "path": "/api/v1/users/abc",
            "headers": [],
            "query_string": b"",
        }
    )


def test_duplicate_key_handler_returns_400_without_leaking():
    resp = duplicate_key_error_handler(
        _request(), DuplicateKeyError("E11000 duplicate key error: email_1 dup")
    )
    assert resp.status_code == 400
    body = resp.body.decode()
    # Clean message, no raw Mongo internals leaked to the client.
    assert "E11000" not in body
    assert "DuplicatedError" in body
