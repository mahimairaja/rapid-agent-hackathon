# 🏥 Rapid Recovery — AI-Powered Post-Discharge Care Agent

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Available-success?style=for-the-badge)](https://rapid-agent-hackathon.vercel.app/)
[![Tech Stack](https://img.shields.io/badge/Tech%20Stack-React%20%7C%20FastAPI%20%7C%20Gemini%20AI-blue?style=for-the-badge)](#)

> **A production-ready healthcare recovery assistant.**  
> Rapid Recovery bridges the gap between hospital discharge and full recovery. Patients interact with an empathetic Gemini AI agent via text or real-time voice to get personalized guidance on medications, recovery milestones, and appointments, while clinicians monitor progress through a professional portal.

---

## 🔗 Links & Demo

- **Hosted Application:** [https://rapid-agent-hackathon.vercel.app/](https://rapid-agent-hackathon.vercel.app/)
- **Instant Demo (No Setup Required):** Click the **["View Live Demo"](https://rapid-agent-hackathon.vercel.app/)** button on the application's login screen. The frontend will load fully synthetic mock data, allowing users to explore the complete patient dashboard and UI features instantly—without needing a running backend!

---

## ✨ Core Features

- **🗣️ Voice & Text AI:** Real-time conversational AI powered by Gemini 2.5 Flash and Gemini Live.
- **💊 Personalized Care:** Interactive medication schedules, recovery milestones, and dynamic care plans.
- **👨‍⚕️ Professional Portal:** A clinician dashboard for monitoring patient progress and escalating risk indicators.
- **🔒 Secure & Scalable:** Built from the ground up with FastAPI, MongoDB Atlas, and an enterprise-grade architecture.

---

## 🛠️ Tech Stack

| Component | Technologies |
|-----------|--------------|
| **Frontend** | React 19, TypeScript, Vite, Vanilla CSS |
| **Backend** | Python 3.11, FastAPI, Beanie ODM |
| **Database** | MongoDB Atlas |
| **AI Agent** | Google ADK, Gemini 2.5 Flash, Gemini Live |
| **Embeddings** | Voyage AI (`voyage-3.5`, 1024-dim), Atlas Vector Search |
| **Package Management** | `uv` (Python), `pnpm` (Node.js) |

---

## 🚀 Quick Start (Local Setup)

If you want to run the project locally, follow these simple steps.

### Prerequisites
- [Python 3.11+](https://python.org)
- [Node.js 18+](https://nodejs.org)
- `uv` (Fast Python package manager): `curl -LsSf https://astral.sh/uv/install.sh | sh`
- `pnpm` (Fast Node package manager): `npm install -g pnpm`

### 1. Clone the Repository
```bash
git clone https://github.com/mahimairaja/rapid-agent-hackathon.git
cd rapid-agent-hackathon
```

### 2. Run the Backend
Open a terminal and execute:
```bash
cd backend

# Copy environment variables
cp .env.example .env

# Open .env and add your MONGODB_URI and GOOGLE_API_KEY
# Note: Other variables can be left as default for local dev.

# Install dependencies and start the backend server
uv sync
uv run uvicorn src.main:app --reload --port 8000
```
*Backend runs at `http://localhost:8000`. API Docs are available at `http://localhost:8000/docs`.*

### 3. Run the Frontend
Open a **new terminal tab** and execute:
```bash
cd frontend

# Install dependencies and start the frontend server
pnpm install
pnpm dev
```
*Frontend runs at `http://localhost:5173`. Open this in your browser.*

---

## 🎲 Optional: Seed Demo Data

To test the backend AI with realistic patient profiles instead of the frontend mock data, seed the MongoDB database:

```bash
cd backend
uv run python scripts/seed_patients.py      # Seeds patients, medications, appointments
uv run python scripts/load_narratives.py    # Seeds care plans (chunked + embedded)
uv run python scripts/ingest_guidelines.py  # Seeds clinical guidelines (chunked + embedded)
uv run python scripts/create_indexes.py     # Creates Atlas Vector Search indexes
```
*Tip: Once seeded, log in and ask the AI about patient code `HW-1001` or search by name and DOB.*

---

## ⚙️ Development Commands & APIs

### Code Quality Commands
```bash
# Backend (from /backend)
uv run ruff check .          # Linting
uv run ruff format .         # Formatting
uv run mypy src              # Type checking
uv run pytest                # Run 145+ unit & integration tests

# Frontend (from /frontend)
pnpm tsc -b                  # TypeScript compile check
pnpm run lint                # ESLint
pnpm run format              # Prettier
pnpm build                   # Production bundle
```

### Key API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service liveness |
| `POST` | `/api/v1/users/login` | Get JWT token |
| `POST` | `/api/v1/agent/chat` | Text AI agent (Gemini) |
| `POST` | `/api/v1/patients/dashboard` | Patient data by code |
| `WS`   | `/api/v1/voice/ws` | Real-time voice WebSocket |

---

## 📂 Project Structure

```text
rapid-agent-hackathon/
├── backend/
│   ├── src/
│   │   ├── agent/          # Google ADK agent, tools (F1-F5), prompts
│   │   ├── api/            # FastAPI routes
│   │   ├── core/           # Security, config, database connections
│   │   ├── models/         # Beanie ODM documents
│   │   └── voice/          # Gemini Live WebSocket integration
│   ├── scripts/            # Data ingestion and seeding pipelines
│   └── tests/              # Comprehensive test suite
└── frontend/
    ├── src/
    │   ├── api/            # API client and mock data fallbacks
    │   ├── components/     # React UI components (Dashboard, Chat, etc.)
    │   └── data/           # Synthetic data for "Live Demo" mode
    └── package.json
```
