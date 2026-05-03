# 🏥 Intelligent Medication Adherence & Monitoring System — CORE BUILD
### The non-negotiable foundation. Everything here must work perfectly before touching EXTRAS.md.

---

## 📌 Project Summary

We are building a **three-sided medication adherence web app** for elderly patients, their doctors, and family reviewers. Patients receive HTML reminder emails, confirm with a single click (no login required), and build an adherence history. Doctors get AI-generated insight summaries and a full patient history timeline. Reviewers (family members) get read-only analytics. The system is built around the idea that most reminder apps serve only the patient — ours serves all three sides.

This document covers everything that **must be built and working** before demo day. No shortcuts on anything in this file.

---

## 🏆 Our 4 Core USPs

These are what we pitch. These are what must work flawlessly.

| # | USP | What the judge sees |
|---|---|---|
| 1 | **One-click email adherence** | Patient receives an HTML email, clicks "Yes I took it" — no login, logged instantly |
| 2 | **AI insight card** | Doctor dashboard shows Gemini-generated weekly summary of patient habits |
| 3 | **Full patient history profile** | Any connected doctor sees full medicine history, allergies, past prescriptions, visit timeline |
| 4 | **Prescription OCR → structured data** | Upload prescription image → Gemini reads it → prefilled editable form → saved to DB |

> **Rule:** If any USP is breaking, fix it before adding anything new. A demo with 4 working USPs beats a demo with 8 half-working ones every single time.

---

## 🧑‍🤝‍🧑 User Roles

There are **two account types** in the system. Reviewer is not a separate account — it is a permission flag on a connection.

| Role | What they can do |
|---|---|
| **Patient** | Upload prescriptions, view own dashboard, set reminder times, send notes to doctor, mark another Patient as their Reviewer |
| **Doctor** | Connect to patients, view patient profiles and adherence stats, see AI insight cards, update prescriptions remotely, reply to patient notes |
| **Reviewer** | A Patient account that has been granted read-only access to another Patient's dashboard. No separate signup. Just a `is_reviewer: true` flag on the `patient_connections` table. |

---

## 🗄️ Database Schema (Supabase / Postgres)

Design these tables first. Everything else is built on top of them.

### `profiles`
```sql
id            uuid PRIMARY KEY references auth.users
role          text NOT NULL  -- 'patient' | 'doctor'
full_name     text
phone         text
date_of_birth date
allergies     text           -- free text, e.g. "Penicillin, Sulfa drugs"
created_at    timestamptz DEFAULT now()
```

### `medicines`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
patient_id      uuid references profiles(id)
name            text NOT NULL        -- "Metformin"
dosage          text NOT NULL        -- "500mg"
frequency       text NOT NULL        -- "twice daily"
reminder_times  text[]               -- ["08:00", "21:00"]
start_date      date
end_date        date                 -- null = ongoing
notes           text                 -- "take after food"
added_by        uuid references profiles(id)  -- doctor or patient
is_active       boolean DEFAULT true
created_at      timestamptz DEFAULT now()
```

### `adherence_logs`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
medicine_id     uuid references medicines(id)
patient_id      uuid references profiles(id)
scheduled_time  timestamptz NOT NULL   -- exact time reminder was sent
confirmed_at    timestamptz            -- null = missed, timestamp = taken
token           text UNIQUE NOT NULL   -- secure one-time token in email URL
token_used      boolean DEFAULT false
created_at      timestamptz DEFAULT now()
```

### `patient_doctor_connections`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
patient_id    uuid references profiles(id)
doctor_id     uuid references profiles(id)
connected_at  timestamptz DEFAULT now()
is_active     boolean DEFAULT true
```

### `patient_reviewer_connections`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
patient_id    uuid references profiles(id)
reviewer_id   uuid references profiles(id)  -- another patient's profile id
connected_at  timestamptz DEFAULT now()
```

### `visits`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
patient_id    uuid references profiles(id)
doctor_id     uuid references profiles(id)
visit_date    timestamptz DEFAULT now()
action_type   text   -- 'prescription_added' | 'prescription_updated' | 'note_added'
summary       text   -- "Added Metformin 500mg twice daily"
```

### `notes`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
patient_id    uuid references profiles(id)
doctor_id     uuid references profiles(id)
sender_role   text    -- 'patient' | 'doctor'
message       text NOT NULL
is_read       boolean DEFAULT false
created_at    timestamptz DEFAULT now()
```

> **Rule:** Every time a doctor updates a prescription or adds a note, also insert a row into `visits`. This is how the timeline is built — there is no separate "create visit" action.

---

## 🏗️ Project Folder Structure

```
medadhere/
│
├── backend/
│   ├── main.py                   # FastAPI app entry point
│   ├── config.py                 # Reads .env, exposes settings object
│   ├── scheduler.py              # APScheduler setup — reminder job runs here
│   ├── requirements.txt          # Pinned dependencies
│   ├── .env                      # Never commit
│   ├── .env.example              # Commit this
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py               # POST /api/auth/register, /api/auth/login
│   │   ├── medicines.py          # CRUD for medicines
│   │   ├── adherence.py          # GET confirm endpoint (email click)
│   │   ├── notes.py              # Patient ↔ Doctor notes
│   │   ├── connections.py        # Connect doctor/reviewer to patient
│   │   ├── dashboard.py          # Aggregated data for dashboards
│   │   └── ocr.py                # POST /api/ocr — image → extracted text
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── email_service.py      # Sends HTML reminder emails (Gmail SMTP / Resend)
│   │   ├── gemini_service.py     # All Gemini calls live here (OCR + insights)
│   │   ├── scheduler_service.py  # Logic for scheduling/rescheduling reminders
│   │   └── insight_service.py    # Builds the AI insight card for doctors
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py            # Pydantic models for all request/response bodies
│   │
│   └── utils/
│       ├── __init__.py
│       ├── token.py              # Generate and validate secure adherence tokens
│       └── supabase_client.py    # Supabase client singleton
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── PatientDashboard.jsx
│   │   │   ├── DoctorDashboard.jsx
│   │   │   ├── PatientProfile.jsx      # Doctor's view of a specific patient
│   │   │   ├── MedicineForm.jsx        # Add/edit medicine + reminder times
│   │   │   ├── ConfirmTaken.jsx        # Landing page after email button click
│   │   │   └── Notes.jsx               # Notes thread between patient and doctor
│   │   ├── components/
│   │   │   ├── AdherenceCalendar.jsx   # 30-day grid: green=taken, red=missed, grey=upcoming
│   │   │   ├── InsightCard.jsx         # AI summary card on doctor dashboard
│   │   │   ├── VisitTimeline.jsx       # Chronological visit/prescription history
│   │   │   ├── MedicineCard.jsx        # Single medicine with status for today
│   │   │   ├── PatientListCard.jsx     # Doctor's patient list item
│   │   │   └── NoteThread.jsx          # Async notes display component
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   └── usePatientData.js
│   │   └── services/
│   │       └── api.js                  # All fetch calls in one place
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## ⚙️ Backend — How Each Piece Works

### 1. Auth (Supabase Auth)

Use Supabase Auth directly. On registration, after Supabase creates the user, immediately insert a row into `profiles` with their role.

```python
# api/auth.py
@router.post("/register")
async def register(data: RegisterSchema):
    # 1. Create user in Supabase Auth
    response = supabase.auth.sign_up({"email": data.email, "password": data.password})
    user_id = response.user.id

    # 2. Insert profile
    supabase.table("profiles").insert({
        "id": user_id,
        "role": data.role,         # 'patient' | 'doctor'
        "full_name": data.full_name
    }).execute()

    return {"message": "registered", "id": user_id}
```

---

### 2. Prescription OCR Flow

```
Patient uploads image (JPG/PNG/PDF)
    → POST /api/ocr  (multipart/form-data)
    → Backend converts image to base64
    → Sends to Gemini Vision with extraction prompt
    → Returns structured JSON: { name, dosage, frequency, reminder_times, notes }
    → Frontend prefills MedicineForm.jsx with this data
    → Patient edits if needed, confirms
    → POST /api/medicines  saves to DB
```

**Gemini Vision Prompt:**
```python
# services/gemini_service.py
OCR_PROMPT = """
You are reading an Indian medical prescription. Extract all medicines listed.
For each medicine return a JSON array with this exact structure:
[
  {
    "name": "medicine name",
    "dosage": "e.g. 500mg",
    "frequency": "e.g. twice daily",
    "reminder_times": ["08:00", "21:00"],  // infer from frequency, use sensible defaults
    "notes": "e.g. take after food"
  }
]
Return only the JSON array. No explanation. No markdown.
If you cannot read a field clearly, set it to null.
"""
```

If OCR returns null for any field, that field shows as empty in the form — patient fills it manually. Never silently save a null drug name.

---

### 3. Reminder System (The Heart of the Product)

**How scheduling works:**

When a medicine is saved with `reminder_times: ["08:00", "21:00"]`, the scheduler creates jobs for each time. Every day at that time, for every active medicine with that reminder time, the system:

1. Generates a unique secure token
2. Inserts a row in `adherence_logs` with `confirmed_at = null`
3. Sends an HTML email with a confirmation link containing that token

```python
# services/scheduler_service.py
def schedule_medicine_reminders(medicine_id: str, reminder_times: list[str]):
    for time_str in reminder_times:
        hour, minute = map(int, time_str.split(":"))
        scheduler.add_job(
            send_reminder_for_medicine,
            trigger=CronTrigger(hour=hour, minute=minute),
            args=[medicine_id],
            id=f"reminder_{medicine_id}_{time_str}",
            replace_existing=True
        )

async def send_reminder_for_medicine(medicine_id: str):
    medicine = get_medicine(medicine_id)
    if not medicine or not medicine.is_active:
        return

    token = generate_token()  # see utils/token.py

    # Insert adherence log (unconfirmed)
    supabase.table("adherence_logs").insert({
        "medicine_id": medicine_id,
        "patient_id": medicine.patient_id,
        "scheduled_time": datetime.utcnow().isoformat(),
        "token": token,
        "confirmed_at": None
    }).execute()

    # Send email
    await send_reminder_email(
        to=get_patient_email(medicine.patient_id),
        medicine_name=medicine.name,
        dosage=medicine.dosage,
        token=token
    )
```

**Token generation:**
```python
# utils/token.py
import secrets

def generate_token() -> str:
    return secrets.token_urlsafe(32)   # 43 character URL-safe token

def validate_token(token: str) -> dict | None:
    result = supabase.table("adherence_logs")\
        .select("*")\
        .eq("token", token)\
        .eq("token_used", False)\
        .execute()
    return result.data[0] if result.data else None
```

**Confirmation endpoint (no login required):**
```python
# api/adherence.py
@router.get("/confirm")
async def confirm_taken(token: str):
    log = validate_token(token)
    if not log:
        # Redirect to a simple "already confirmed or invalid" page
        return RedirectResponse(url=f"{FRONTEND_URL}/confirm?status=invalid")

    # Mark as confirmed
    supabase.table("adherence_logs").update({
        "confirmed_at": datetime.utcnow().isoformat(),
        "token_used": True
    }).eq("id", log["id"]).execute()

    return RedirectResponse(url=f"{FRONTEND_URL}/confirm?status=success&medicine={log['medicine_id']}")
```

`ConfirmTaken.jsx` reads the query param and shows a friendly success/error screen. No login wall. Ever.

---

### 4. HTML Reminder Email

```python
# services/email_service.py
def build_reminder_email(medicine_name: str, dosage: str, token: str) -> str:
    confirm_url = f"{BACKEND_URL}/api/adherence/confirm?token={token}"
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
      <div style="max-width: 480px; margin: auto; background: white; border-radius: 12px; padding: 32px;">
        <h2 style="color: #1a73e8;">💊 Medicine Reminder</h2>
        <p style="font-size: 18px;">Time to take your <strong>{medicine_name} {dosage}</strong></p>
        <a href="{confirm_url}"
           style="display:inline-block; margin-top:20px; padding: 16px 32px;
                  background:#1a73e8; color:white; border-radius:8px;
                  text-decoration:none; font-size:18px;">
          ✅ Yes, I took it
        </a>
        <p style="color:#999; margin-top:24px; font-size:13px;">
          If you did not take it, ignore this email. It will be marked as missed automatically.
        </p>
      </div>
    </body>
    </html>
    """
```

Use **Resend** (free tier: 3000 emails/month, 100/day) over Gmail SMTP. Resend has a proper Python SDK, doesn't get flagged as spam, and setup takes 10 minutes. Gmail SMTP requires app password setup and gets rate limited.

---

### 5. AI Insight Card

This runs **on demand** when a doctor opens a patient's profile. Not on a schedule. Not stored. Generated fresh each time.

```python
# services/insight_service.py
async def generate_insight(patient_id: str) -> str:
    # Fetch last 30 days of adherence logs
    logs = supabase.table("adherence_logs")\
        .select("*, medicines(name, dosage, reminder_times)")\
        .eq("patient_id", patient_id)\
        .gte("scheduled_time", thirty_days_ago())\
        .execute().data

    # Build structured summary for Gemini
    summary = build_adherence_summary(logs)  # groups by medicine, calculates % taken

    prompt = f"""
    You are a clinical assistant helping a doctor understand a patient's medication adherence.
    Based on the following 30-day adherence data, write a brief 3-4 sentence insight summary.
    Focus on: overall adherence rate, any time-of-day patterns in missed doses, and one actionable suggestion.
    Do NOT give medical advice. Do NOT suggest starting or stopping medicines.
    Write in plain English. Be concise.

    Adherence data:
    {summary}
    """

    response = gemini_model.generate_content(prompt)
    return response.text
```

**What `build_adherence_summary` produces (fed to Gemini):**
```
Metformin 500mg (twice daily):
  - Morning (08:00): 26/30 taken (87%)
  - Evening (21:00): 14/30 taken (47%)

Amlodipine 5mg (once daily):
  - Morning (09:00): 28/30 taken (93%)
```

This structured format makes Gemini's output accurate and consistent.

---

### 6. Doctor-Patient Notes

Simple async message thread. No websockets. Just a table.

```python
# api/notes.py
@router.post("/notes")
async def send_note(data: NoteSchema, current_user: dict = Depends(get_current_user)):
    supabase.table("notes").insert({
        "patient_id": data.patient_id,
        "doctor_id": data.doctor_id,
        "sender_role": current_user["role"],
        "message": data.message
    }).execute()

    # If patient sending to doctor — also create a visit entry
    if current_user["role"] == "patient":
        supabase.table("visits").insert({
            "patient_id": data.patient_id,
            "doctor_id": data.doctor_id,
            "action_type": "note_added",
            "summary": f"Patient sent a note: {data.message[:80]}..."
        }).execute()

    return {"status": "sent"}

@router.get("/notes/{patient_id}/{doctor_id}")
async def get_notes(patient_id: str, doctor_id: str):
    result = supabase.table("notes")\
        .select("*")\
        .eq("patient_id", patient_id)\
        .eq("doctor_id", doctor_id)\
        .order("created_at")\
        .execute()
    return result.data
```

---

### 7. Visit Timeline

Every significant action auto-creates a visit entry. The frontend just fetches and renders them chronologically.

| Action | Who triggers it | `action_type` |
|---|---|---|
| Doctor adds medicine | Doctor | `prescription_added` |
| Doctor edits medicine | Doctor | `prescription_updated` |
| Doctor sends a note | Doctor | `note_added` |
| Patient sends a note | Patient | `note_added` |

```python
# utils/visits.py
def log_visit(patient_id: str, doctor_id: str, action_type: str, summary: str):
    supabase.table("visits").insert({
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "action_type": action_type,
        "summary": summary
    }).execute()
```

Call this from wherever the action happens. Never forget to call it — this is the patient's medical history.

---

## 🖥️ Frontend — Dashboards

### Patient Dashboard
```
┌──────────────────────────────────────────────┐
│  Good morning, Ramesh 👋                      │
│  Today: 2 medicines due                       │
├──────────────────────────────────────────────┤
│  💊 Metformin 500mg     ✅ Taken at 8:14am    │
│  💊 Amlodipine 5mg      ⏳ Due at 9:00pm      │
├──────────────────────────────────────────────┤
│  [30-day Adherence Calendar]                 │
│  ■ ■ ■ □ ■ ■ ■ ■ □ □ ■ ■ ...                │
│  Green = taken | Red = missed                │
├──────────────────────────────────────────────┤
│  My Doctors                                  │
│  Dr. Sharma — connected since Jan 2025       │
│  Dr. Patel  — connected since Mar 2025       │
├──────────────────────────────────────────────┤
│  Visit History                               │
│  Apr 10 — Dr. Sharma — Updated prescription  │
│  Mar 2  — Dr. Sharma — Added note            │
│  Feb 15 — Dr. Patel  — Initial prescription  │
├──────────────────────────────────────────────┤
│  [📩 Send a note to my doctor]               │
└──────────────────────────────────────────────┘
```

### Doctor Dashboard
```
┌──────────────────────────────────────────────┐
│  Dr. Sharma's Dashboard                      │
├──────────────────────────────────────────────┤
│  My Patients                                 │
│  ┌────────────────────────────────────────┐  │
│  │ Ramesh Kumar    87% this week  [View]  │  │
│  │ Sunita Devi     52% this week  [View]  │  │
│  │ Mohan Singh     94% this week  [View]  │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### Doctor → Patient Profile View
```
┌──────────────────────────────────────────────┐
│  Ramesh Kumar, 68 | Allergies: Penicillin    │
├──────────────────────────────────────────────┤
│  🤖 AI Insight (last 30 days)                │
│  ┌────────────────────────────────────────┐  │
│  │ Ramesh takes morning doses reliably    │  │
│  │ (87%) but misses evening Metformin     │  │
│  │ frequently (47%). Consider shifting    │  │
│  │ the 9pm reminder to 8pm when he may   │  │
│  │ be more consistent.                   │  │
│  └────────────────────────────────────────┘  │
├──────────────────────────────────────────────┤
│  Current Medicines        [+ Add Medicine]   │
│  Metformin 500mg — twice daily               │
│  Amlodipine 5mg  — once daily                │
├──────────────────────────────────────────────┤
│  Visit Timeline                              │
│  Apr 10 — prescription_updated               │
│  Mar 2  — note_added                         │
├──────────────────────────────────────────────┤
│  Notes Thread                                │
│  Patient: "Should I continue after 30 days?" │
│  You: "Yes, continue until next visit."      │
│  [Reply...]                                  │
└──────────────────────────────────────────────┘
```

---

## 🌐 API Contract (Full)

### Auth
```
POST   /api/auth/register        body: {email, password, role, full_name}
POST   /api/auth/login           body: {email, password}
```

### Medicines
```
GET    /api/medicines/{patient_id}          returns all active medicines
POST   /api/medicines                       body: MedicineSchema — creates + schedules reminders
PUT    /api/medicines/{id}                  body: MedicineSchema — updates + reschedules
DELETE /api/medicines/{id}                  soft delete (is_active = false), cancels scheduler job
```

### Adherence
```
GET    /api/adherence/confirm?token=xxx     no auth — email click lands here
GET    /api/adherence/{patient_id}          returns logs for last 30 days
GET    /api/adherence/{patient_id}/summary  returns {medicine_id, taken_count, missed_count, percentage}
```

### OCR
```
POST   /api/ocr                             multipart: {image: file}
                                            returns: [{name, dosage, frequency, reminder_times, notes}]
```

### Connections
```
POST   /api/connections/doctor              body: {patient_id, doctor_id}
POST   /api/connections/reviewer            body: {patient_id, reviewer_id}
GET    /api/connections/patients/{doctor_id}  returns doctor's patient list with weekly % stats
GET    /api/connections/doctors/{patient_id}  returns patient's connected doctors
```

### Dashboard
```
GET    /api/dashboard/patient/{patient_id}  returns today's medicines + status + streak
GET    /api/dashboard/doctor/{doctor_id}    returns patient list with adherence summaries
GET    /api/dashboard/insight/{patient_id}  triggers Gemini insight generation, returns text
```

### Notes & Visits
```
POST   /api/notes                           body: {patient_id, doctor_id, message}
GET    /api/notes/{patient_id}/{doctor_id}  returns full thread
GET    /api/visits/{patient_id}             returns chronological visit history
```

---

## 🔌 Environment Variables

```
# Supabase
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_KEY=your_service_key      # use service key on backend, not anon key

# Gemini
GEMINI_API_KEY=your_key_here

# Email (Resend — recommended over Gmail SMTP)
RESEND_API_KEY=your_key_here
FROM_EMAIL=reminders@yourdomain.com        # or use Resend's onboarding address for dev

# App URLs
FRONTEND_URL=https://your-app.vercel.app
BACKEND_URL=https://your-app.railway.app

# Scheduler
SCHEDULER_TIMEZONE=Asia/Kolkata            # IST — always set this explicitly
```

---

## 📦 Dependencies

**Backend (`requirements.txt`):**
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
python-multipart==0.0.9
python-dotenv==1.0.1
supabase==2.4.2
apscheduler==3.10.4
google-generativeai==0.7.2
resend==0.7.0
httpx==0.27.0
aiofiles==23.2.1
pydantic==2.7.0
pydantic-settings==2.2.1
pillow==10.3.0              # image processing before sending to Gemini
```

**Frontend (`package.json` key deps):**
```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "tailwindcss": "^3.4.0",
    "date-fns": "^3.6.0"
  }
}
```

---

## 🪟 Cross-Platform Rules (Mac + Windows)

| Rule | Why |
|---|---|
| Use `pathlib.Path` for ALL file paths | Windows uses `\`, Mac uses `/` |
| Everyone uses **Python 3.11.9** exactly | Same interpreter on Mac and Windows; avoids subtle dependency conflicts |
| Everyone uses a **virtual environment** | No global pip installs |
| `requirements.txt` has **pinned versions** | Same env everywhere |
| Set `SCHEDULER_TIMEZONE=Asia/Kolkata` explicitly | Default UTC will send reminders at wrong times in India |
| Never hardcode `localhost` URLs | Always read from `.env` |
| Image uploads: always convert to JPEG before Gemini | PNG transparency causes issues on some platforms |

---

## 🏗️ Build Order (Follow This Exactly)

Do not skip ahead. Each step must work before moving to the next.

```
Step 1: Supabase setup
        → Create all tables from the schema above
        → Enable Row Level Security (RLS) — but disable it during dev for speed
        → Test with Supabase dashboard that inserts/selects work
        DONE WHEN: You can manually insert a profile and read it back

Step 2: Auth works end to end
        → Register as patient, register as doctor
        → Login returns a token, token is stored in localStorage
        → Protected routes redirect to login if no token
        DONE WHEN: Two accounts exist, both can log in, roles are correct in profiles table

Step 3: Medicine creation (text only, no OCR yet)
        → Patient can add a medicine with name, dosage, frequency, reminder times
        → Saved to DB correctly
        → Scheduler picks it up and a job is created
        DONE WHEN: You can see the scheduled job in APScheduler's job list

Step 4: Reminder email sends correctly
        → Manually trigger send_reminder_for_medicine() in Python shell
        → Email arrives in inbox
        → Email looks good (HTML renders correctly)
        → Token is in the confirm URL
        DONE WHEN: Email received, token visible in URL

Step 5: Confirmation flow works (no login)
        → Click the button in the email
        → Redirected to ConfirmTaken.jsx with success screen
        → adherence_logs row now has confirmed_at timestamp
        → token_used = true
        DONE WHEN: DB row updated after clicking email

Step 6: Patient dashboard renders correctly
        → Shows today's medicines with taken/missed/pending status
        → 30-day calendar renders (can be dummy data at this point)
        DONE WHEN: Dashboard looks right with real data from DB

Step 7: Doctor-patient connection
        → Doctor can search for a patient by email and connect
        → Patient sees doctor in "My Doctors" list
        → Doctor sees patient in their patient list
        DONE WHEN: Both sides see the connection

Step 8: Doctor patient profile view
        → Doctor clicks a patient and sees their medicines, adherence %, visit timeline
        → Doctor can add a medicine (auto-logs a visit entry)
        → Notes thread works (send and receive)
        DONE WHEN: Doctor adds a medicine, it appears on patient dashboard, visit timeline updates

Step 9: OCR flow
        → Patient uploads prescription image
        → Gemini extracts medicines, form is prefilled
        → Patient edits and saves
        DONE WHEN: Real prescription photo → correct prefilled form

Step 10: AI Insight Card
        → Doctor opens patient profile → insight card loads with Gemini summary
        → Summary is coherent and based on real adherence data
        DONE WHEN: Card shows accurate insight, not hallucinated data

Step 11: Reviewer connection
        → Patient can add another patient as reviewer by email
        → Reviewer logs in and can see the patient's dashboard (read-only)
        DONE WHEN: Reviewer account sees correct data, cannot edit anything

Step 12: UI polish
        → Clean layout, readable fonts (large enough for elderly users)
        → Mobile-friendly (elderly users may use phones)
        → No broken states, no empty screens without a helpful message
        DONE WHEN: You'd be proud to screen-record this
```

---

## 🎤 Demo Day Script

Practice this exact flow. Aim for under 4 minutes.

1. Open app as **patient (Ramesh)**. Show the dashboard — medicines for today, one taken (green), one pending.
2. Open the reminder email on phone/second tab. Click "Yes I took it." Show the dashboard update instantly (or refresh).
3. Switch to **doctor (Dr. Sharma)**. Show Ramesh in patient list with his weekly %.
4. Open Ramesh's profile. Point to the **AI Insight Card** — read it aloud. "Our system analyzed 30 days of data and noticed he misses evening doses. It suggests adjusting the reminder time."
5. Doctor adds a new medicine for Ramesh. Show visit timeline update automatically.
6. Show the **notes thread** — Ramesh asked a question, doctor replies. No app needed, no phone call.
7. Log in as **reviewer (Ramesh's daughter)**. Show she can see his dashboard, his calendar, his stats. "Her father is 87% adherent this week."
8. Go back to patient and show the **prescription OCR** — upload a photo, form prefills, patient confirms.

**Total demo: ~4 minutes.** Every click must work. Rehearse the email click especially — it's your most impressive moment.

---

## ⚠️ Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Railway goes down on demo day | Export a video of the working demo the night before. Always have backup. |
| Resend email lands in spam | Use a custom domain email, test deliverability 2 days before demo |
| APScheduler jobs lost on Railway restart | On app startup, re-schedule all active medicines from DB. Always. |
| Gemini OCR gets drug name wrong | Patient always sees prefilled form and must confirm before saving. Never auto-save OCR output. |
| Gemini insight card slow to load | Show a loading spinner. Pre-generate and cache the insight when doctor connects to patient, refresh daily. |
| Token reuse attack | `token_used = true` after first click. Second click shows "already confirmed" page. |
| Supabase RLS blocks queries | Disable RLS during development. Enable and test RLS rules in the last 3 days before demo. |
| Reminder fires at wrong time (UTC vs IST) | Set `SCHEDULER_TIMEZONE=Asia/Kolkata` from day one. Test with a 2-minute reminder in dev. |
| Wrong Python version | Project requires exactly Python 3.11.9 via pyenv. Run `pyenv install 3.11.9` then `pyenv local 3.11.9` inside the backend folder. Verify with `python --version` before creating venv. |
| Supabase SDK expects legacy JWT keys | In Supabase dashboard go to Project Settings → API → scroll to Legacy API keys — copy the service_role key (eyJ... format) into `backend/.env` as `SUPABASE_SERVICE_KEY` and the anon key into `frontend/.env` as `VITE_SUPABASE_ANON_KEY`. The new sb_secret_ format will throw Invalid API key error. |
