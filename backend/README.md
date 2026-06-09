# Rapid Agent Hackathon Backend (Homeward)

A FastAPI app with clean layering (API → service → model), dependency injection,
async MongoDB Atlas via the Beanie ODM, JWT auth, an MCP tool surface, and the
M0 "Data Foundation" (synthetic patients + an embedded knowledge corpus for
Atlas Vector Search).

## Stack

- **FastAPI** (+ `fastapi[standard]`) for HTTP and OpenAPI
- **fastapi-mcp** to expose endpoints tagged `mcp-tools` as MCP tools at `/mcp`
- **MongoDB Atlas** via **Beanie** (async ODM on pymongo `AsyncMongoClient`)
- **Voyage AI** embeddings (`voyage-3.5`, 1024-dim) + **Atlas Vector Search**
- **dependency-injector** for wiring config / services
- **PyJWT** + PBKDF2 password hashing for auth
- **loguru** / Rich logging, **asgi-correlation-id**, optional **Sentry**
- Tooling: **uv**, **ruff**, **mypy**, **pytest**

## Layout

```
src/
  main.py            ASGI app factory (AppCreator) — exports `app`
  db/mongo.py        motor-free pymongo AsyncMongoClient + Beanie init
  core/              config, DI container, security (JWT), events, exceptions
  api/endpoints/     health.py (public), users.py (auth + CRUD)
  models/            Beanie documents: User, Patient, Medication, Appointment,
                     CarePlanChunk, GuidelineChunk
  schemas/           Pydantic request/response DTOs
  services/          UsersService, embeddings (Voyage), chunking
  util/              singleton, front-matter parser
scripts/             M0 data pipeline (see below)
data/                synthea CSVs, patient narratives, guidelines, SOURCES.md
tests/               pytest (DB-free unit tests)
```

## Quickstart

```bash
cp .env.example .env          # set MONGODB_URI, VOYAGE_API_KEY, JWT_SECRET_KEY
uv sync                       # install deps into .venv

uv run uvicorn src.main:app --reload
# OpenAPI docs:  http://127.0.0.1:8000/docs
# MCP endpoint:  http://127.0.0.1:8000/mcp
```

`uv run uvicorn main:app` also works (root `main.py` re-exports `app`). Beanie
collections and indexes are created on startup; no migration tool is needed
(MongoDB is schemaless).

## M0 data pipeline

Loads the synthetic Data Foundation into the `homeward` database. Run in order
from the `backend/` directory:

```bash
uv run python scripts/seed_patients.py      # patients / medications / appointments
uv run python scripts/load_narratives.py    # care_plans (chunk + Voyage embed)
uv run python scripts/ingest_guidelines.py  # guidelines (chunk + Voyage embed)
uv run python scripts/create_indexes.py     # Atlas Vector Search indexes
```

All data is fully synthetic; see `data/SOURCES.md` for provenance and licenses.
The scripts are idempotent.

## Auth flow

| Method | Path                          | Access        | MCP tool     |
| ------ | ----------------------------- | ------------- | ------------ |
| POST   | `/api/v1/users/register`      | public        | -            |
| POST   | `/api/v1/users/login`         | public        | -            |
| GET    | `/api/v1/users/me`            | any logged-in | -            |
| GET    | `/api/v1/users`               | admin only    | `list_users` |
| GET    | `/api/v1/users/{id}`          | self or admin | `get_user`   |
| PATCH  | `/api/v1/users/{id}`          | self or admin | -            |
| DELETE | `/api/v1/users/{id}`          | self or admin | -            |
| GET    | `/health`, `/health/detailed` | public        | -            |

Ownership is enforced (you can only read/update/delete your own account); admins
(`is_superuser`) may act on any account and list all users. The public update
schema deliberately omits `is_active` / `is_superuser` to prevent mass-assignment
privilege escalation. User ids are Mongo ObjectId hex strings.

`register` always creates a non-admin user. Promote the first admin out-of-band:
`db.users.updateOne({email: "you@example.com"}, {$set: {is_superuser: true}})`.

## Adding a new resource

Copy the `User` slice: a Beanie `Document` in `models/<x>.py`, DTOs in
`schemas/<x>_schemas.py`, a `<X>Service` in `services/`, a router in
`api/endpoints/<x>.py`, then register the document in `models/__init__.py`
(`DOCUMENT_MODELS`), the service in `core/container.py`, the module in the
container `wiring_config`, and include the router in `api/routes.py`.

## Dev commands

```bash
uv run ruff check .
uv run ruff format .
uv run mypy src
uv run pytest
```

## Docker

```bash
docker build -t backend .
docker run --rm -p 8000:8000 --env-file .env backend
```
