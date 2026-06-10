"""Unit tests for the journey onboarding endpoints (stubbed database)."""

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.api.endpoints import onboarding as onboarding_module
from src.api.endpoints.users import get_current_user_record


class FakeFind:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self):
        return self.docs

    async def count(self):
        return len(self.docs)


def _build_app(user) -> FastAPI:
    app = FastAPI()
    app.include_router(onboarding_module.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user_record] = lambda: user
    return app


def _fake_user(**overrides):
    user = SimpleNamespace(
        id="user-1",
        email="a@b.c",
        patient_id=None,
        patient_code=None,
        saved=False,
    )

    async def save():
        user.saved = True

    user.save = save
    for key, value in overrides.items():
        setattr(user, key, value)
    return user


def _sample_patient():
    return SimpleNamespace(
        patient_id="pid-sample",
        patient_code="HW-1001",
        first_name="Margaret",
        last_name="Chen",
        discharge_reason="CHF exacerbation",
        assigned_clinician="Dr. Park",
        cloned_from=None,
    )


async def _client(app):
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


async def test_journeys_lists_seeded_samples(monkeypatch):
    sample = _sample_patient()
    monkeypatch.setattr(
        onboarding_module.Patient, "find", lambda *a, **k: FakeFind([sample])
    )
    monkeypatch.setattr(
        onboarding_module.Medication, "find", lambda *a, **k: FakeFind([1, 2, 3])
    )
    monkeypatch.setattr(
        onboarding_module.Appointment,
        "find",
        lambda *a, **k: FakeFind(
            [SimpleNamespace(kind="Lab"), SimpleNamespace(kind="Cardiology follow-up")]
        ),
    )
    async with await _client(_build_app(_fake_user())) as client:
        resp = await client.get("/api/v1/onboarding/journeys")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["journey_code"] == "HW-1001"
    assert body[0]["title"] == "Heart failure recovery"
    assert body[0]["sample_name"] == "Margaret Chen"
    assert body[0]["medication_count"] == 3
    assert body[0]["appointment_kinds"] == ["Cardiology follow-up", "Lab"]


@pytest.fixture
def claim_env(monkeypatch):
    sample = _sample_patient()

    async def fake_find_one(query, *a, **k):
        if query.get("patient_code") == "HW-1001":
            return sample
        return None

    monkeypatch.setattr(onboarding_module.Patient, "find_one", fake_find_one)

    profile = SimpleNamespace(
        patient=SimpleNamespace(
            patient_id="pid-new",
            patient_code="HW-7K3F",
            first_name="Asha",
            last_name="Rao",
            cloned_from="pid-sample",
        ),
        medication_count=3,
        appointment_count=2,
        chunk_count=1,
    )

    calls = {}

    async def fake_clone(s, *, display_name, birth_year):
        calls["display_name"] = display_name
        calls["birth_year"] = birth_year
        return profile

    monkeypatch.setattr(onboarding_module, "clone_journey", fake_clone)
    return SimpleNamespace(sample=sample, profile=profile, calls=calls)


async def test_claim_clones_and_links_account(claim_env):
    user = _fake_user()
    async with await _client(_build_app(user)) as client:
        resp = await client.post(
            "/api/v1/onboarding/claim",
            json={
                "journey_code": "hw-1001",
                "display_name": "Asha Rao",
                "birth_year": 1990,
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["patient_code"] == "HW-7K3F"
    assert body["counts"] == {
        "medications": 3,
        "appointments": 2,
        "care_plan_chunks": 1,
    }
    # The account link is written after a successful clone.
    assert user.patient_id == "pid-new" and user.patient_code == "HW-7K3F"
    assert user.saved is True
    assert claim_env.calls == {"display_name": "Asha Rao", "birth_year": 1990}


async def test_claim_is_idempotent_for_linked_account(monkeypatch, claim_env):
    existing = SimpleNamespace(
        patient_id="pid-mine",
        patient_code="HW-MINE",
        first_name="Asha",
        last_name="Rao",
        cloned_from="pid-sample",
    )

    async def fake_find_one(query, *a, **k):
        if query.get("patient_id") == "pid-mine":
            return existing
        if query.get("patient_id") == "pid-sample":
            return claim_env.sample
        return None

    monkeypatch.setattr(onboarding_module.Patient, "find_one", fake_find_one)
    monkeypatch.setattr(
        onboarding_module.Medication, "find", lambda *a, **k: FakeFind([1])
    )
    monkeypatch.setattr(
        onboarding_module.Appointment, "find", lambda *a, **k: FakeFind([1])
    )
    monkeypatch.setattr(
        onboarding_module.CarePlanChunk, "find", lambda *a, **k: FakeFind([1, 2])
    )

    user = _fake_user(patient_id="pid-mine", patient_code="HW-MINE")
    async with await _client(_build_app(user)) as client:
        resp = await client.post(
            "/api/v1/onboarding/claim",
            json={"journey_code": "HW-1002", "display_name": "Someone Else"},
        )
    assert resp.status_code == 200
    body = resp.json()
    # The existing profile comes back; no second clone happens.
    assert body["patient_code"] == "HW-MINE"
    assert body["journey_code"] == "HW-1001"
    assert user.saved is False


async def test_claim_unknown_journey_404(claim_env):
    async with await _client(_build_app(_fake_user())) as client:
        resp = await client.post(
            "/api/v1/onboarding/claim",
            json={"journey_code": "HW-9999", "display_name": "Asha"},
        )
    assert resp.status_code == 404


async def test_claim_unseeded_database_409(monkeypatch, claim_env):
    async def nothing(*a, **k):
        return None

    monkeypatch.setattr(onboarding_module.Patient, "find_one", nothing)
    async with await _client(_build_app(_fake_user())) as client:
        resp = await client.post(
            "/api/v1/onboarding/claim",
            json={"journey_code": "HW-1001", "display_name": "Asha"},
        )
    assert resp.status_code == 409
