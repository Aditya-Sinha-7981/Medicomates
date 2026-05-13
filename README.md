# MedAdhere (Medicomates)

**Intelligent medication adherence and care coordination** for patients, clinicians, and family reviewers. Patients confirm doses from a single link in a reminder email (no login on that step). Doctors see structured adherence history and an AI-generated clinical-style summary. Family members can follow a loved one’s dashboard read-only when invited.

This repository is the full-stack implementation: **React (Vite) + Tailwind** frontend, **FastAPI** backend, **Supabase (Postgres + Auth)**, **Resend** for email, **Gemini** (and optional **Ollama**) for OCR and insights, **RxNorm** for drug resolution and interaction hints, and **Cloudinary** for medical document uploads.

---

## Why this project exists

Most adherence tools optimize for one person. MedAdhere is built around **three stakeholders** sharing one source of truth: the patient (low-friction confirmation), the doctor (visibility and summaries between visits), and a designated reviewer (often family) with read-only oversight—without inventing a third account type.

For positioning, problem decomposition, and demo talking points, see [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md).

---

## Core capabilities

| Area | What ships |
|------|------------|
| **Email adherence** | Scheduled reminders; one-time token links; public confirmation landing page |
| **Dashboards** | Patient dashboard (today’s slots, streak, weekly %); doctor list with rolling adherence; reviewer mirror of patient view |
| **Medicines** | CRUD with role checks; supply hints; allergy / interaction **warnings** (confirm-to-save flow) |
| **Connections** | Doctor–patient and patient–reviewer requests, accept/reject |
| **Notes & visits** | Async notes thread; visit timeline derived from clinical actions |
| **OCR** | Prescription image → structured draft (Indian handwriting path + fallbacks) |
| **Documents** | Upload/list/delete with RBAC via Cloudinary |

Authoritative build checklist and database shapes: [`docs/CORE.md`](docs/CORE.md). API shapes: [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md). Roadmap ideas: [`docs/EXTRAS.md`](docs/EXTRAS.md), [`docs/ENHANCEMENTS.md`](docs/ENHANCEMENTS.md). Team onboarding: [`docs/TEAM.md`](docs/TEAM.md).

---

## Repository layout

```
Medicomates/
├── backend/           # FastAPI app, services, scheduler (APScheduler)
├── frontend/          # Vite + React SPA
├── docs/              # Product & engineering reference
├── logs/              # Pitch/evaluation notes, deep-dive narratives (see logs/)
├── mock_api/          # Optional mock server for frontend-only work
└── README.md          # This file
```

---

## Prerequisites

- **Python** 3.11.x (see `.python-version`)
- **Node.js** 18+ (for Vite)
- **Supabase** project (Postgres + Auth; tables per `docs/CORE.md` plus `connection_requests` and any migrations your branch expects)
- Optional: **Resend**, **Gemini**, **Cloudinary**, **Ollama** keys as in env examples

---

## Environment variables

**Backend** — copy `backend/.env.example` to `backend/.env` and fill:

- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service role JWT from Supabase **Legacy** API keys if your SDK expects `eyJ…` format—see `docs/CORE.md` troubleshooting)
- `GEMINI_API_KEY`, `RESEND_API_KEY`, `FROM_EMAIL`, `FRONTEND_URL`, `BACKEND_URL`
- `SCHEDULER_TIMEZONE` (default `Asia/Kolkata`)
- Optional: `CLOUDINARY_*`, `OLLAMA_*`

**Frontend** — copy `frontend/.env.example` to `frontend/.env`:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` pointing at your running backend (e.g. `http://localhost:8000`)

---

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health check: `GET http://localhost:8000/health`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The scheduler starts with the FastAPI lifespan and replays active medicine jobs from the database after restarts.

---

## Security model (high level)

- Authenticated API routes use **Supabase JWT** (`Authorization: Bearer …`); the backend resolves the user and loads `profiles`.
- **RBAC** for patient data is enforced in route handlers (e.g. medicine read/write guards, reviewer checks).
- The **email confirmation** path is intentionally public: it validates a **one-time token** on `adherence_logs`, not a session cookie.

Production hardening (e.g. Row Level Security aligned with your API) is a documented next step in project materials—not a substitute for server-side checks.

---

## Testing

Backend includes targeted tests (e.g. adherence stats, scheduler, dashboard aggregations). From `backend/`:

```bash
pytest
```

Run specific files as needed (see `backend/test_*.py`).

---

## Deployment (typical hackathon / pilot stack)

- **Frontend:** Vercel (or any static host for the Vite build)
- **Backend:** Railway, Fly.io, or similar (persistent process for APScheduler)
- **Database / Auth:** Supabase
- **Email:** Resend (or swap provider in `email_service`)

---

## Contributing & learning

- Start with [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md).
- For a **narrated walkthrough** of modules, pitfalls, and design tradeoffs, see [`logs/CODEBASE_AND_CHALLENGES.md`](logs/CODEBASE_AND_CHALLENGES.md) (written for teammates and AI context).