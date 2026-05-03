# MedAdhere — Project Context
### Read this first. Every team member reads this before touching any code.

---

## What We Are Building

A three-sided medication adherence web app for elderly patients, their doctors, and family reviewers.

**The problem:** Elderly patients forget their medicine. Their children worry. Their doctors have no visibility between appointments.

**Our solution:** Patients get HTML reminder emails with a single "Yes I took it" button — no login, no app to open. That click is logged. Doctors get AI-generated summaries of patient adherence patterns. Family members get a read-only view of their loved one's dashboard. All three sides get value from one system.

**Why this wins:** Most reminder apps serve one person. Ours serves three simultaneously. The AI layer is not a chatbot — it's a clinical insight card that gives doctors real behavioral data about their patients. That's a defensible, non-gimmicky use of AI.

**What makes us non-generic — every team member must understand this:**
Two design decisions that judges won't have seen before:
1. **No login to confirm medicine.** Every other app makes elderly users open an app and navigate. We send an email with one button. The UX is designed around who actually uses this product.
2. **The AI talks to the doctor, not the patient.** Every other "AI health app" chatbots the patient. We deliberately chose not to. Our AI augments the clinical relationship — it gives the doctor behavioral insight they can act on. That is a different design philosophy, not just a feature addition. Lead with this in the pitch.

---

## The 4 USPs — Memorise These

| # | USP | What it means |
|---|---|---|
| 1 | **One-click email adherence** | Patient clicks Yes in email, no login required, logged instantly with timestamp |
| 2 | **AI insight card** | Gemini analyzes 30 days of adherence data and generates a 3-4 sentence clinical summary for the doctor |
| 3 | **Full patient history profile** | Any connected doctor sees medicine history, allergies, visit timeline, past prescriptions |
| 4 | **Prescription OCR** | Patient uploads prescription photo → Gemini reads it → form is prefilled → patient confirms |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React + Vite | Patient and doctor dashboards |
| Styling | Tailwind CSS | All styling, no custom CSS files |
| Frontend Deploy | Vercel | Free, instant deploys from GitHub |
| Backend | FastAPI (Python 3.11.9) | API server, scheduler, all logic |
| Backend Deploy | Railway | Free tier, persistent process for scheduler |
| Database + Auth | Supabase (Postgres) | All data storage and user authentication |
| Scheduler | APScheduler (inside FastAPI) | Sends reminder emails at scheduled times |
| Email | Resend API | HTML reminder emails, free tier 3000/month |
| AI — Vision | Gemini 2.0 Flash (multimodal) | Reads prescription images |
| AI — Insights | Gemini 2.0 Flash (text) | Generates adherence insight summaries |

---

## Three User Roles

| Role | Account type | What they can do |
|---|---|---|
| **Patient** | `role: 'patient'` in profiles | Upload prescriptions, set reminder times, view own dashboard, send notes to doctor, add a Reviewer |
| **Doctor** | `role: 'doctor'` in profiles | Connect to patients, view patient profiles and stats, see AI insight cards, update prescriptions, reply to patient notes |
| **Reviewer** | Patient account + connection flag | Read-only view of a specific patient's dashboard. Not a separate account type — just a `patient_reviewer_connections` table entry |

---

## Repository Structure

```
medadhere/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── scheduler.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── api/
│   │   ├── auth.py
│   │   ├── medicines.py
│   │   ├── adherence.py
│   │   ├── notes.py
│   │   ├── connections.py
│   │   ├── dashboard.py
│   │   └── ocr.py
│   ├── services/
│   │   ├── email_service.py
│   │   ├── gemini_service.py
│   │   ├── scheduler_service.py
│   │   └── insight_service.py
│   ├── models/
│   │   └── schemas.py
│   └── utils/
│       ├── token.py
│       ├── visits.py
│       └── supabase_client.py
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── PatientDashboard.jsx
│   │   │   ├── DoctorDashboard.jsx
│   │   │   ├── PatientProfile.jsx
│   │   │   ├── MedicineForm.jsx
│   │   │   ├── ConfirmTaken.jsx
│   │   │   └── Notes.jsx
│   │   ├── components/
│   │   │   ├── AdherenceCalendar.jsx
│   │   │   ├── InsightCard.jsx
│   │   │   ├── VisitTimeline.jsx
│   │   │   ├── MedicineCard.jsx
│   │   │   ├── PatientListCard.jsx
│   │   │   └── NoteThread.jsx
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   └── usePatientData.js
│   │   └── services/
│   │       ├── api.js
│   │       └── supabaseClient.js
│   ├── package.json
│   └── vite.config.js
│
├── mock_api/
│   └── mock_server.py        ← Frontend builds against this. Never needs real backend.
│
└── README.md
```

---

## Environment Variables

### Backend `.env` (never commit — use `.env.example`)
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GEMINI_API_KEY=
RESEND_API_KEY=
FROM_EMAIL=reminders@yourdomain.com
FRONTEND_URL=https://your-app.vercel.app
BACKEND_URL=https://your-app.railway.app
SCHEDULER_TIMEZONE=Asia/Kolkata
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

During development (mock server): `VITE_API_URL=http://localhost:8001`
During development (real backend via ngrok): `VITE_API_URL=https://abc123.ngrok.io`
On Vercel: set `VITE_API_URL` to the Railway backend URL

---

## The One Rule

If you are blocked for more than 30 minutes, message the group immediately.
Do not silently debug for 3 hours. The lead will unblock you within the hour.
A stuck team member for a full day is a day of wasted parallel work.
