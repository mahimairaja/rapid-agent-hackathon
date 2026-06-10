# Rapid Recovery — AI-Powered Post-Discharge Care Agent

> A hackathon-grade, production-structured healthcare recovery assistant. Patients interact with a Gemini AI agent by text **or voice** to get personalised guidance on medications, recovery milestones, and appointments after leaving hospital. Clinicians get a parallel professional portal for monitoring and escalation.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **AI Agent** | Google ADK · Gemini 2.5 Flash (text) · Gemini Live (voice) |
| **Backend** | FastAPI · Python 3.11 · Beanie ODM · MongoDB Atlas |
| **Embeddings** | Voyage AI (`voyage-3.5`, 1024-dim) + Atlas Vector Search |
| **Frontend** | Vite · React 19 · TypeScript · Vanilla CSS |
| **Package Managers** | `uv` (Python) · `pnpm` (Node) |

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| `uv` | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| `pnpm` | latest | `npm install -g pnpm` |

---

## Quick Start

### 1 — Clone & enter the repo

```bash
git clone https://github.com/mahimairaja/rapid-agent-hackathon.git
cd rapid-agent-hackathon
```

---

### 2 — Backend setup

```bash
cd backend

# Copy and fill in the environment file
cp .env.example .env
# Edit .env — at minimum set MONGODB_URI and GOOGLE_API_KEY (see below)

# Install all Python dependencies into an isolated .venv
uv sync

# Start the server (auto-reloads on file changes)
uv run uvicorn src.main:app --reload --port 8000
```

The backend will be available at:
- **API:** `http://localhost:8000/api/v1`
- **Swagger docs:** `http://localhost:8000/docs`
- **Health check:** `http://localhost:8000/health`

---

### 3 — Frontend setup

Open a **new terminal tab**:

```bash
cd frontend

# Install Node dependencies
pnpm install

# Start the Vite dev server
pnpm dev
```

The frontend will be available at: **`http://localhost:5173`**

---

### 4 — Environment variables (`.env`)

Create `backend/.env` from the example and set these values:

```dotenv
ENV=dev
PROJECT_NAME=rapid

# MongoDB Atlas SRV connection string
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/

# Google AI Studio key (for Gemini text + Live voice)
GOOGLE_API_KEY=<your-key>
GOOGLE_GENAI_USE_VERTEXAI=false
GEMINI_MODEL=gemini-2.5-flash

# Voyage AI for vector embeddings
VOYAGE_API_KEY=<your-key>

# JWT auth (any long random string in dev)
JWT_SECRET_KEY=<32+ char random string>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# CORS — leave empty to allow all origins in dev
CORS_ORIGINS_STR=

# Optional: Cal.com for real appointment booking
# CAL_API_KEY=
# CAL_USERNAME=
# CAL_EVENT_TYPE_SLUG=
```

---

### 5 — (Optional) Seed patient data

Without seeded data, the AI agent will still work but won't be able to look up real patients. Run these once from `backend/`:

```bash
cd backend

uv run python scripts/seed_patients.py      # patients, medications, appointments
uv run python scripts/load_narratives.py    # care plans (chunked + embedded)
uv run python scripts/ingest_guidelines.py  # clinical guidelines (chunked + embedded)
uv run python scripts/create_indexes.py     # Atlas Vector Search indexes
```

After seeding, patients can be found by code (e.g. `HW-1001`) or by name + date of birth in the AI chat.

---

## Running Both Servers (Summary)

```bash
# Terminal 1 — Backend
cd backend && uv run uvicorn src.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && pnpm dev
```

Open `http://localhost:5173` in your browser.

---

## Demo Access (No Setup Required)

Click **"View Live Demo"** on the login screen to skip authentication entirely. The frontend loads fully synthetic mock data so you can explore every screen without a running backend.

---

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service liveness |
| `GET` | `/health/detailed` | MongoDB connectivity |
| `POST` | `/api/v1/users/register` | Create account |
| `POST` | `/api/v1/users/login` | Get JWT token |
| `GET` | `/api/v1/users/me` | Authenticated user info |
| `POST` | `/api/v1/agent/chat` | Text AI agent (Gemini) |
| `POST` | `/api/v1/patients/dashboard` | Patient data by code |
| `WS` | `/api/v1/voice/ws` | Real-time voice WebSocket |
| `GET` | `/docs` | Swagger / OpenAPI UI |
| `GET` | `/mcp` | MCP tool surface |

---

## Development Commands

```bash
# Backend
uv run ruff check .          # lint
uv run ruff format .         # format
uv run mypy src              # type check
uv run pytest                # run tests (145 unit + integration)

# Frontend
pnpm tsc -b                  # TypeScript compile check
pnpm run lint                # ESLint
pnpm run format              # Prettier
pnpm build                   # Production bundle
```

---

## Project Structure

```
rapid-agent-hackathon/
├── backend/
│   ├── src/
│   │   ├── agent/          # Google ADK agent, tools (F1-F5), prompts
│   │   ├── api/            # FastAPI routers (users, agent, patients, voice)
│   │   ├── core/           # Config, DI container, auth, database, events
│   │   ├── models/         # Beanie documents (Patient, Medication, etc.)
│   │   ├── schemas/        # Pydantic request/response DTOs
│   │   ├── services/       # Business logic (users, embeddings)
│   │   ├── voice/          # Gemini Live WebSocket bridge (F6)
│   │   └── main.py         # ASGI app factory
│   ├── scripts/            # Data seeding pipeline
│   ├── tests/              # Unit + integration tests
│   └── pyproject.toml
└── frontend/
    ├── src/
    │   ├── api/            # Backend client + mock fallbacks
    │   ├── components/     # All React components (22 total)
    │   ├── data/           # Mock data for demo mode
    │   ├── lib/            # Voice WebSocket client
    │   └── types/          # TypeScript interfaces
    └── package.json
```
