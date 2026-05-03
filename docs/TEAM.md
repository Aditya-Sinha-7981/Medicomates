# MedAdhere — Team Breakdown & Collaboration Guide

---

## Team Overview

| Member | Machine | Role |
|---|---|---|
| You (Lead) | MacBook Pro M4 Pro, 24GB | Backend core — Supabase schema, scheduler, Gemini services, token system, deployment |
| Backend 2 | Windows (decent) | Backend plumbing — auth, medicines CRUD, connections, notes, visits API |
| Frontend 1 | Windows (vibe coder) | Patient side — patient dashboard, medicine form, confirm page, adherence calendar |
| Frontend 2 | Windows (vibe coder) | Doctor side — doctor dashboard, patient profile, insight card, notes thread, visit timeline |
| Person 5 | Windows (can do frontend) | PPT + pitch deck + demo script. Overflow: reviewer dashboard UI, confirm-taken page polish |

### Shared backend runtime

Everyone uses **Python 3.11.9** for the FastAPI app (see `.python-version` at repo root). Create a virtual environment per `setup_structure.sh` / `docs/CORE.md`; use exactly 3.11.9 everywhere — do not use 3.12, 3.13, or 3.14 with the pinned dependencies.

---

## The Core Split Logic

You own anything that is hard to debug or kills the entire system if it breaks.
Others own things that are isolated, well-defined, and replaceable.
The MDs are detailed enough that AI (Claude Code / Cursor) can write the code.
Your job is to scaffold correctly and unblock people — not to write every line.

---

## Member 1 — You (Lead, Mac M4)

### You Own
- Supabase table creation — all 6 tables from CORE.md schema
- FastAPI project scaffold — folder structure, `main.py`, `config.py`, `.env.example`, `requirements.txt`
- `utils/supabase_client.py` — singleton, everyone imports this
- `utils/token.py` — generate and validate secure adherence tokens
- `utils/visits.py` — `log_visit()` utility called by Backend 2
- `services/gemini_service.py` — OCR extraction + insight generation, all Gemini calls
- `services/email_service.py` — HTML reminder email template, Resend integration
- `services/scheduler_service.py` — APScheduler setup, `schedule_medicine()`, `unschedule_medicine()`
- `scheduler.py` — APScheduler instance, startup job to re-schedule all active medicines on app boot
- `api/adherence.py` — the `/api/adherence/confirm` endpoint (email click, no auth)
- `api/ocr.py` — image upload → Gemini Vision → returns structured JSON
- `api/dashboard.py` — aggregated dashboard endpoints + insight card trigger
- `mock_api/mock_server.py` — Day 1 priority, unblocks both frontend members immediately
- Backend 2 stub functions — Day 1, 30 minutes, unblocks Backend 2
- Final wiring in `main.py` — register all routers
- Railway deployment — you deploy, you share the URL
- Integration debugging when real frontend hits real backend

### Your `.env`
```
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_KEY=your_service_key
GEMINI_API_KEY=your_key
RESEND_API_KEY=your_key
FROM_EMAIL=reminders@yourdomain.com
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
SCHEDULER_TIMEZONE=Asia/Kolkata
```

### Day 1 Priorities (in order)
1. Create all Supabase tables — 1 hour
2. FastAPI scaffold + `config.py` + `requirements.txt` + `.env.example` — 1 hour
3. `supabase_client.py`, `token.py`, `visits.py` stubs — 30 mins
4. Mock server for frontend members — 2 hours ← **do not skip this**
5. Stub functions for Backend 2 — 30 mins
6. Push to GitHub. Everyone pulls. Everyone is unblocked.

---

## Member 2 — Backend 2 (Decent Windows)

### You Own
- `api/auth.py` — `POST /api/auth/register` and `POST /api/auth/login`
- `api/medicines.py` — full CRUD: GET, POST, PUT, DELETE for medicines
- `api/connections.py` — doctor-patient connection, reviewer connection, list endpoints
- `api/notes.py` — send note, get thread, mark as read
- `models/schemas.py` — all Pydantic request/response models

### How You Work
You never touch Gemini, the scheduler, or the token system.
You only call functions that the Lead has defined. Specifically:

When a medicine is created (`POST /api/medicines`):
```python
# after inserting medicine to supabase, call:
schedule_medicine(medicine_id, reminder_times)
log_visit(patient_id, doctor_id, "prescription_added", f"Added {name} {dosage}")
```

When a medicine is updated (`PUT /api/medicines/{id}`):
```python
reschedule_medicine(medicine_id, new_reminder_times)
log_visit(patient_id, doctor_id, "prescription_updated", f"Updated {name}")
```

When a medicine is deleted (`DELETE /api/medicines/{id}`):
```python
unschedule_medicine(medicine_id)
# then set is_active = false in DB, do NOT hard delete
```

When a doctor sends a note (`POST /api/notes` with sender_role='doctor'):
```python
log_visit(patient_id, doctor_id, "note_added", f"Doctor sent note: {message[:80]}")
```

These functions are defined in `utils/visits.py` and `services/scheduler_service.py`.
Import them. Call them. Don't rewrite them.

### His `.env`
```
SUPABASE_URL=same as lead
SUPABASE_SERVICE_KEY=same as lead
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
```
He does not need Gemini or Resend keys. He never calls those services directly.

### Testing
Use Postman or Thunder Client. Test every endpoint locally before integration day.
The Lead will share a test Supabase project with pre-populated data for testing.

---

## Member 3 — Frontend 1 (Patient Side, Vibe Coder)

### You Own
- `pages/Login.jsx` and `pages/Register.jsx` — shared auth pages
- `pages/PatientDashboard.jsx` — main patient view
- `pages/MedicineForm.jsx` — add/edit medicine with reminder time pickers
- `pages/ConfirmTaken.jsx` — landing page after email button click, reads `?status=` query param
- `components/MedicineCard.jsx` — single medicine with today's taken/missed/pending status
- `components/AdherenceCalendar.jsx` — 30-day grid, green=taken, red=missed, grey=pending
- `hooks/useAuth.js` — login state, token storage, role-based redirect
- `hooks/usePatientData.js` — fetches patient dashboard data

### How You Work Independently
You build against the mock server from Day 1. Run it locally:
```bash
cd mock_api
pip install fastapi uvicorn
uvicorn mock_server:app --reload --port 8001
```
Set `VITE_API_URL=http://localhost:8001` in your frontend `.env`.
When the real backend is ready, the Lead shares an ngrok URL.
You change `VITE_API_URL` to that URL. Nothing else changes.

### What Each Page Should Do

**PatientDashboard.jsx**
- On load: call `GET /api/dashboard/patient/{patient_id}` (patient_id from localStorage after login)
- Show: today's medicines with their statuses, 30-day calendar, streak card, connected doctors list, visit timeline preview (last 3 entries)
- Button: "Add Medicine" → navigate to MedicineForm
- Button: "Send a note" → navigate to Notes page (this page is owned by Frontend 2, just link to it)

**MedicineForm.jsx**
- If patient uploaded a prescription image: call `POST /api/ocr`, prefill fields from response
- All fields editable before saving
- On save: call `POST /api/medicines`
- Show null OCR fields as empty, never show "null" as text

**ConfirmTaken.jsx**
- Reads `?status=success` or `?status=invalid` from URL
- Success: show large green checkmark, medicine name, "Great job! Keep it up."
- Invalid/already used: show friendly message "Looks like this was already confirmed, or the link has expired."
- No login prompt. Ever. This page is always public.

**AdherenceCalendar.jsx**
- Takes `logs` array as prop (from dashboard endpoint)
- 30 squares in a grid, last 30 days
- Green if all medicines taken that day, Red if any missed, Grey if pending/future
- Show date on hover

### Your `.env` (frontend)
```
VITE_API_URL=http://localhost:8001
VITE_SUPABASE_URL=ask lead
VITE_SUPABASE_ANON_KEY=ask lead
```

---

## Member 4 — Frontend 2 (Doctor Side, Vibe Coder)

### You Own
- `pages/DoctorDashboard.jsx` — doctor's main view, patient list
- `pages/PatientProfile.jsx` — doctor's view of a specific patient
- `pages/Notes.jsx` — full notes thread page (used by both patient and doctor)
- `components/InsightCard.jsx` — AI summary card, handles loading state
- `components/VisitTimeline.jsx` — chronological list of visits
- `components/PatientListCard.jsx` — one card per patient in doctor's list
- `components/NoteThread.jsx` — renders the notes thread with sender labels

### What Each Page Should Do

**DoctorDashboard.jsx**
- On load: call `GET /api/dashboard/doctor/{doctor_id}`
- Show: list of patients using PatientListCard, each with name + weekly % + "Needs attention" flag if % < 60
- Clicking a patient navigates to `/patient/{patient_id}`

**PatientProfile.jsx**
- On load: call these in parallel:
  - `GET /api/medicines/{patient_id}`
  - `GET /api/adherence/{patient_id}/summary`
  - `GET /api/visits/{patient_id}`
  - `GET /api/connections/doctors/{patient_id}`
  - `GET /api/notes/{patient_id}/{doctor_id}`
- After those load: call `GET /api/dashboard/insight/{patient_id}` separately (it's slow, show spinner)
- Show: patient name + allergies at top, InsightCard, current medicines list with edit buttons, VisitTimeline, NoteThread
- Button: "+ Add Medicine" → opens MedicineForm in doctor mode (doctor_id passed as `added_by`)

**InsightCard.jsx**
- Props: `patientId`
- On mount: call `GET /api/dashboard/insight/{patientId}`
- While loading: show animated skeleton card with "Analyzing 30 days of data..."
- On load: show the insight text in a styled card with a small Gemini badge
- On error: show "Insight unavailable right now" quietly — never show a raw error

**Notes.jsx**
- Used by both patient and doctor — check role from localStorage
- Load thread: `GET /api/notes/{patient_id}/{doctor_id}`
- Show messages with "You" vs the other person's name
- Send box at bottom: `POST /api/notes`
- Mark as read on page load: `PUT /api/notes/read/{patient_id}/{doctor_id}`

### Same mock server setup as Frontend 1:
```bash
VITE_API_URL=http://localhost:8001
```

---

## Member 5 — PPT + Demo + Overflow Frontend

### Primary Responsibilities
- **Pitch deck** — 8-10 slides covering: problem, our solution, the 4 USPs, tech stack diagram, demo screenshots, team
- **90-second pitch script** — write it, share it with the team, practice it
- **Test data** — create realistic test accounts: 2 patients (one elderly name, one young), 1 doctor, 1 reviewer
- **Demo rehearsal** — run the demo script from CORE.md with the team at least 3 times before demo day
- **Demo day operator** — you run the laptop during the live presentation while lead speaks

### Secondary (Overflow Frontend — if Frontend 1 or 2 are stuck)
- `pages/ConfirmTaken.jsx` — simple public page, good starting task
- Reviewer dashboard — read-only version of PatientDashboard with `readOnly={true}` prop

### The Pitch (memorise this arc)
> "Most reminder apps solve one problem for one person. Ours solves three problems for three people simultaneously.
> For the patient — a simple email, one button, no login. The app learns their habits and suggests better times.
> For the doctor — an AI-generated weekly summary of every patient's adherence. Not raw data. A clinical insight.
> For the family — a daughter in another city can see her father's streak and medicines. No phone calls needed.
> The architecture is fully modular — AI model, email provider, all swappable via config."

---

## Day 1 Unblocking Plan

You (Lead) do these four things before anything else:

### 1. Supabase Setup (1 hour)
Create all 6 tables. Share the project URL and anon key in the group chat.

### 2. Scaffold + Push to GitHub (1 hour)
```
medadhere/
├── backend/
│   ├── main.py          (empty FastAPI app, just registers routers)
│   ├── config.py        (reads .env)
│   ├── requirements.txt
│   ├── .env.example
│   └── [all subfolders with empty __init__.py files]
├── frontend/
│   └── [Vite + React scaffold via: npm create vite@latest frontend -- --template react]
├── mock_api/
│   └── mock_server.py   (see below)
└── README.md
```

### 3. Mock Server (2 hours) — unblocks both frontend members
```python
# mock_api/mock_server.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# AUTH
@app.post("/api/auth/login")
async def mock_login(body: dict):
    return {
        "access_token": "mock_token_123",
        "role": body.get("role", "patient"),
        "id": "mock-patient-uuid-001",
        "full_name": "Ramesh Kumar"
    }

@app.post("/api/auth/register")
async def mock_register(body: dict):
    return {"message": "registered", "id": "mock-uuid-001", "role": body.get("role", "patient")}

# DASHBOARD
@app.get("/api/dashboard/patient/{patient_id}")
async def mock_patient_dashboard(patient_id: str):
    return {
        "profile": {"full_name": "Ramesh Kumar", "allergies": "Penicillin"},
        "todays_medicines": [
            {
                "medicine_id": "med-001",
                "name": "Metformin",
                "dosage": "500mg",
                "reminder_times": ["08:00", "21:00"],
                "statuses": [
                    {"time": "08:00", "status": "taken", "confirmed_at": "2025-04-22T08:14:00Z"},
                    {"time": "21:00", "status": "pending", "confirmed_at": None}
                ]
            }
        ],
        "streak": {"current": 12, "best": 21},
        "weekly_percentage": 89,
        "last_week_percentage": 74
    }

@app.get("/api/dashboard/doctor/{doctor_id}")
async def mock_doctor_dashboard(doctor_id: str):
    return {
        "profile": {"full_name": "Dr. Sharma"},
        "patients": [
            {"patient_id": "mock-patient-uuid-001", "full_name": "Ramesh Kumar", "weekly_percentage": 87, "needs_attention": False},
            {"patient_id": "mock-patient-uuid-002", "full_name": "Sunita Devi", "weekly_percentage": 52, "needs_attention": True}
        ]
    }

@app.get("/api/dashboard/insight/{patient_id}")
async def mock_insight(patient_id: str):
    await asyncio.sleep(2)  # simulate Gemini latency — do not remove
    return {
        "insight": "Ramesh takes morning doses reliably (87%) but misses evening Metformin frequently (47%). Consider shifting the 9pm reminder to 8pm when he may be more consistent.",
        "generated_at": "2025-04-22T10:30:00Z"
    }

# MEDICINES
@app.get("/api/medicines/{patient_id}")
async def mock_medicines(patient_id: str):
    return [
        {"id": "med-001", "name": "Metformin", "dosage": "500mg", "frequency": "twice daily",
         "reminder_times": ["08:00", "21:00"], "start_date": "2025-01-15", "end_date": None,
         "notes": "take after food", "added_by": "doc-001", "is_active": True}
    ]

@app.post("/api/medicines")
async def mock_add_medicine(body: dict):
    return {"id": "med-new-001", "message": "Medicine added and reminders scheduled"}

@app.put("/api/medicines/{medicine_id}")
async def mock_update_medicine(medicine_id: str, body: dict):
    return {"message": "Medicine updated and reminders rescheduled"}

@app.delete("/api/medicines/{medicine_id}")
async def mock_delete_medicine(medicine_id: str):
    return {"message": "Medicine deactivated"}

# ADHERENCE
@app.get("/api/adherence/{patient_id}")
async def mock_adherence(patient_id: str, days: int = 30):
    return [
        {"id": "log-001", "medicine_id": "med-001", "medicine_name": "Metformin",
         "scheduled_time": "2025-04-22T08:00:00Z", "confirmed_at": "2025-04-22T08:14:00Z", "status": "taken"},
        {"id": "log-002", "medicine_id": "med-001", "medicine_name": "Metformin",
         "scheduled_time": "2025-04-21T21:00:00Z", "confirmed_at": None, "status": "missed"}
    ]

@app.get("/api/adherence/{patient_id}/summary")
async def mock_adherence_summary(patient_id: str):
    return [
        {"medicine_id": "med-001", "medicine_name": "Metformin", "taken_count": 26,
         "missed_count": 4, "percentage": 87,
         "time_slots": [
             {"time": "08:00", "taken": 28, "missed": 2, "percentage": 93},
             {"time": "21:00", "taken": 14, "missed": 16, "percentage": 47}
         ]}
    ]

# CONNECTIONS
@app.get("/api/connections/patients/{doctor_id}")
async def mock_doctor_patients(doctor_id: str):
    return [
        {"patient_id": "mock-patient-uuid-001", "full_name": "Ramesh Kumar",
         "connected_at": "2025-01-15T00:00:00Z", "weekly_adherence_percentage": 87}
    ]

@app.get("/api/connections/doctors/{patient_id}")
async def mock_patient_doctors(patient_id: str):
    return [
        {"doctor_id": "doc-001", "full_name": "Dr. Sharma", "connected_at": "2025-01-15T00:00:00Z"}
    ]

@app.post("/api/connections/doctor")
async def mock_connect_doctor(body: dict):
    return {"message": "Connection established"}

@app.post("/api/connections/reviewer")
async def mock_add_reviewer(body: dict):
    return {"message": "Reviewer added", "reviewer_name": "Priya Kumar"}

# NOTES
@app.get("/api/notes/{patient_id}/{doctor_id}")
async def mock_notes(patient_id: str, doctor_id: str):
    return [
        {"id": "note-001", "sender_role": "patient", "message": "Should I continue after 30 days?",
         "is_read": True, "created_at": "2025-04-10T14:30:00Z"},
        {"id": "note-002", "sender_role": "doctor", "message": "Yes, continue until next visit.",
         "is_read": True, "created_at": "2025-04-10T16:00:00Z"}
    ]

@app.post("/api/notes")
async def mock_send_note(body: dict):
    return {"message": "Note sent", "id": "note-new-001"}

@app.put("/api/notes/read/{patient_id}/{doctor_id}")
async def mock_mark_read(patient_id: str, doctor_id: str):
    return {"message": "Marked as read"}

# VISITS
@app.get("/api/visits/{patient_id}")
async def mock_visits(patient_id: str):
    return [
        {"id": "visit-001", "doctor_name": "Dr. Sharma", "visit_date": "2025-04-10T00:00:00Z",
         "action_type": "prescription_updated", "summary": "Added Metformin 500mg twice daily"},
        {"id": "visit-002", "doctor_name": "Dr. Sharma", "visit_date": "2025-03-02T00:00:00Z",
         "action_type": "note_added", "summary": "Patient sent a note: Should I continue..."}
    ]

# OCR
@app.post("/api/ocr")
async def mock_ocr():
    await asyncio.sleep(1)
    return [
        {"name": "Metformin", "dosage": "500mg", "frequency": "twice daily",
         "reminder_times": ["08:00", "21:00"], "notes": "take after food"}
    ]
```

### 4. Stub Functions for Backend 2 (30 minutes)
```python
# services/scheduler_service.py — stub
def schedule_medicine(medicine_id: str, reminder_times: list) -> None:
    print(f"[STUB] Would schedule {medicine_id} at {reminder_times}")

def unschedule_medicine(medicine_id: str) -> None:
    print(f"[STUB] Would unschedule {medicine_id}")

def reschedule_medicine(medicine_id: str, new_times: list) -> None:
    unschedule_medicine(medicine_id)
    schedule_medicine(medicine_id, new_times)

# utils/visits.py — stub
def log_visit(patient_id, doctor_id, action_type, summary):
    print(f"[STUB] Visit: {action_type} — {summary}")
```
Backend 2 imports and calls these from Day 1. You replace the internals when ready. His code never changes.

---

## Serving Your Backend Remotely (ngrok)

Run your FastAPI server on your Mac. Run ngrok in front of it.
Everyone connects to the ngrok URL — different networks, different cities, mobile data.

```bash
brew install ngrok
ngrok http 8000
# Outputs: https://abc123.ngrok.io
# Share this URL in group chat
```

Your Mac must be on when they need to work against the real backend.
During mock server phase, they're fully local — your Mac can be off.

---

## Git Workflow

| Branch | Owner | Merges into |
|---|---|---|
| `main` | Lead | — |
| `backend` | Lead + Backend 2 | `main` |
| `frontend` | Frontend 1 + Frontend 2 + Person 5 | `main` |

Lead owns all merges to `main`. No one pushes to `main` directly.
Sync at minimum after every completed build step.
Do not go 3 days without an integration sync.

**Critical integration day: Build Steps 5-6 (from CORE.md)**
When frontend first connects to real backend — do this together, not async.
Set aside 2 hours. Everyone online at the same time.

---

## Timeline

```
Days 1-2:
  Lead:        Supabase tables, scaffold, mock server, stub functions → push
  Backend 2:   Pull, set up env, build auth.py and schemas.py against stub
  Frontend 1:  Pull, set up env, build Login + Register + PatientDashboard shell against mock
  Frontend 2:  Pull, set up env, build DoctorDashboard shell against mock
  Person 5:    Start pitch deck outline, create test account data

Days 3-5:
  Lead:        gemini_service.py, email_service.py, token.py, scheduler core
  Backend 2:   medicines.py, connections.py
  Frontend 1:  MedicineForm, AdherenceCalendar, ConfirmTaken page
  Frontend 2:  PatientProfile shell, InsightCard (with mock 2s delay), VisitTimeline
  Person 5:    Complete pitch deck, write 90-second script

Days 6-7:
  Lead:        adherence.py (confirm endpoint), dashboard.py, insight_service.py
  Backend 2:   notes.py, visits integration
  Frontend 1:  Polish patient dashboard, streak card
  Frontend 2:  NoteThread, doctor can add medicine flow
  Person 5:    Test data ready, start demo rehearsal

Day 8 — INTEGRATION DAY (everyone online together):
  → Frontend members switch from mock to ngrok URL
  → Backend 2's endpoints connect to Lead's real services
  → Find and fix all mismatches together
  → Do not do this async — sit in a call

Days 9-10:
  Lead:        Scheduler live testing (set a 2-minute reminder, check email arrives)
               Fix any integration bugs
  Backend 2:   Fix any endpoint bugs found on integration day
  Frontend 1:  Fix any data shape mismatches
  Frontend 2:  Fix any data shape mismatches, polish doctor UI
  Person 5:    Run full demo script with team, note all friction points

Days 11-12:
  All:         Bug fixing only. No new features.
               Resend email deliverability test — check spam folder
               Railway deployment + Vercel deployment
               End-to-end test on deployed URLs (not localhost)

Days 13-15:
  All:         Demo prep ONLY.
               Run the CORE.md demo script until everyone could do it in their sleep.
               Person 5 operates the laptop. Lead speaks.
               If something breaks on demo day — skip it, keep moving, finish the story.
```

---

## The One Rule

If someone is blocked for more than 30 minutes, they say so in the group chat immediately.
Lead drops what they are doing and unblocks them within the hour.
Silent blocking for a full day is a day of wasted parallel work.
It has happened before. It will not happen again.
