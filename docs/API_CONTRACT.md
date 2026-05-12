# API Contract
### The sacred document. Never change anything here without telling all members first.

---

## Base URLs

```
Development (mock):   http://localhost:8001
Development (real):   http://localhost:8000  (or ngrok URL shared by lead)
Production:           https://your-app.railway.app
```

All frontend API calls read from `import.meta.env.VITE_API_URL`. Never hardcode a URL.

---

## Authentication

All protected endpoints require a Bearer token in the Authorization header.

```
Authorization: Bearer <supabase_jwt_token>
```

The token is obtained from Supabase Auth on login and stored in `localStorage` as `auth_token`.
The frontend `api.js` service attaches this header automatically to every request.
Endpoints marked **[PUBLIC]** do not require this header.

---

## Auth Endpoints

### Register
```
POST /api/auth/register
Content-Type: application/json

Body:
{
  "email": "string",
  "password": "string",
  "role": "patient" | "doctor",
  "full_name": "string"
}

Response 200:
{
  "message": "registered",
  "id": "uuid",
  "role": "patient" | "doctor"
}

Response 400:
{
  "error": "Email already registered"
}
```

### Login
```
POST /api/auth/login
Content-Type: application/json

Body:
{
  "email": "string",
  "password": "string"
}

Response 200:
{
  "access_token": "string",
  "role": "patient" | "doctor",
  "id": "uuid",
  "full_name": "string"
}

Response 401:
{
  "error": "Invalid credentials"
}
```

---

## Medicine Endpoints

### Get patient's medicines
```
GET /api/medicines/{patient_id}
[Protected]

Caller must be: that patient, a doctor connected to them, or a reviewer connected to them.

Response 200:
[
  {
    "id": "uuid",
    "name": "Metformin",
    "dosage": "500mg",
    "frequency": "twice daily",
    "reminder_times": ["08:00", "21:00"],
    "start_date": "2025-01-15",
    "end_date": null,
    "notes": "take after food",
    "added_by": "uuid",
    "rxcui": "6809",
    "is_active": true,
    "quantity_on_hand": 30,
    "units_per_day": 2.0,
    "low_supply_threshold_days": 7
  }
]
```

### Add a medicine
```
POST /api/medicines
[Protected]
Content-Type: application/json

Body:
{
  "patient_id": "uuid",
  "name": "string",
  "dosage": "string",
  "frequency": "string",
  "reminder_times": ["HH:MM", "HH:MM"],
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD" | null,
  "notes": "string" | null,
  "doctor_id": "uuid" | null,
  "quantity_on_hand": 30,
  "units_per_day": 2.0,
  "low_supply_threshold_days": 7
}
```

Optional supply fields (all nullable / omit): `quantity_on_hand` (integer pills/units left), `units_per_day` (average consumption per calendar day), `low_supply_threshold_days` (warn when estimated days of supply ≤ this; default 7 when tracking).

Caller must be: that patient, or a doctor connected to that patient (doctor_id must match when set).

Response 200 — saved:
{
  "id": "uuid",
  "message": "Medicine added and reminders scheduled"
}

Response 200 — safety warnings (nothing saved until confirm):
{
  "status": "warnings",
  "warnings": [
    { "type": "allergy" | "unresolved", "message": "string", "severity": "high" | "low" }
  ],
  "interactions": [
    { "drug1": "string", "drug2": "string", "description": "string", "severity": "string" }
  ],
  "medicine_data": { ...same fields as POST body, JSON-serialized dates... },
  "rxcui": "string" | null
}
```

### Confirm add after warnings
```
POST /api/medicines/confirm
[Protected]
Content-Type: application/json

Body: same as POST /api/medicines plus:
  "rxcui": "string" | null,
  "acknowledged_warnings": ["allergy", "interaction"]

Response 200:
{
  "id": "uuid",
  "message": "Medicine added and reminders scheduled"
}
```

### Update a medicine
```
PUT /api/medicines/{medicine_id}
[Protected]
Content-Type: application/json

Body: same shape as POST /api/medicines (all fields optional except patient_id)

Response 200:
{
  "message": "Medicine updated and reminders rescheduled"
}
```

### Delete (deactivate) a medicine
```
DELETE /api/medicines/{medicine_id}
[Protected]

Response 200:
{
  "message": "Medicine deactivated"
}
```

---

## Medical documents (Cloudinary)

Stored metadata in `medical_documents`; file bytes go to Cloudinary. Allowed types: PDF, JPEG, PNG, WebP (images are server-resized/re-encoded with Pillow before upload). Max processed size **20 MB**. Reviewers have **no** access to another patient's documents (`GET /api/documents/patient/{id}` is **doctor-only** and requires an active doctor–patient link).

### Upload
```
POST /api/documents/upload
[Protected]
Content-Type: multipart/form-data

Fields:
  file: (binary) — required
  patient_id: uuid — optional; only **doctors** may set this to upload into a **connected patient's** chart. Patients and doctors omit for self-upload.

Response 200: document object (see list).
```

### List own documents
```
GET /api/documents/me
[Protected]

Response 200: array of:
{
  "id": "uuid",
  "owner_profile_id": "uuid",
  "uploaded_by": "uuid",
  "cloudinary_public_id": "string",
  "secure_url": "https://...",
  "original_filename": "string",
  "mime_type": "string",
  "size_bytes": 12345,
  "resource_type": "image" | "raw",
  "title": "string",
  "notes": "string" | null,
  "created_at": "ISO8601",
  "updated_at": "ISO8601" | null
}
```

### List connected patient's documents (doctor only)
```
GET /api/documents/patient/{patient_id}
[Protected]

Caller: doctor with active `patient_doctor_connections` to `patient_id`. Returns same shape as `/me`.
```

### Update title / notes
```
PATCH /api/documents/{document_id}
[Protected]
Content-Type: application/json

Body:
{ "title": "string (1-200 chars)", "notes": "string" | null }

Allowed: document owner, or doctor linked to the owner patient.
```

### Delete document + Cloudinary asset
```
DELETE /api/documents/{document_id}
[Protected]

Response 200: { "message": "Document deleted." }
```

---

## Adherence Endpoints

### Confirm taken — email click [PUBLIC]
```
GET /api/adherence/confirm?token={token}
[PUBLIC — no auth required, this is clicked from email]

Behaviour:
  - If token valid and unused → marks confirmed_at, sets token_used=true
  - Redirects to: {FRONTEND_URL}/confirm?status=success
  - If token invalid or already used → redirects to: {FRONTEND_URL}/confirm?status=invalid
```

### Get adherence logs
```
GET /api/adherence/{patient_id}?days=30
[Protected]

Response 200:
[
  {
    "id": "uuid",
    "medicine_id": "uuid",
    "medicine_name": "Metformin",
    "scheduled_time": "2025-04-10T08:00:00Z",
    "confirmed_at": "2025-04-10T08:14:32Z" | null,
    "status": "taken" | "missed" | "pending"
  }
]

Note: status is computed by backend:
  confirmed_at is not null → "taken"
  confirmed_at is null AND scheduled_time is in the past → "missed"
  confirmed_at is null AND scheduled_time is in the future → "pending"
```

### Get adherence summary per medicine
```
GET /api/adherence/{patient_id}/summary
[Protected]

Response 200:
[
  {
    "medicine_id": "uuid",
    "medicine_name": "Metformin",
    "taken_count": 26,
    "missed_count": 4,
    "percentage": 87,
    "time_slots": [
      { "time": "08:00", "taken": 28, "missed": 2, "percentage": 93 },
      { "time": "21:00", "taken": 14, "missed": 16, "percentage": 47 }
    ]
  }
]
```

---

## OCR Endpoint

### Extract medicine data from prescription image
```
POST /api/ocr
[Protected]
Content-Type: multipart/form-data

Body:
  image: <file>   (JPG, PNG, or PDF — max 10MB)

Response 200:
[
  {
    "name": "Metformin" | null,
    "dosage": "500mg" | null,
    "frequency": "twice daily" | null,
    "reminder_times": ["08:00", "21:00"] | null,
    "notes": "take after food" | null
  }
]

Note: Any field can be null if Gemini could not read it clearly.
      Frontend must display the form and let the patient confirm before saving.
      NEVER auto-save OCR output directly to the database.
```

---

## Connection Endpoints

### Search for user before request
```
GET /api/connections/search?email={email}&type={type}
[Protected]
type: 'doctor_patient' | 'reviewer'

Response 200:
{
  "user_id": "uuid",
  "full_name": "string",
  "role": "patient"
}
```

### Send connection request
```
POST /api/connections/request
[Protected]
Content-Type: application/json

Body:
{
  "to_email": "string",
  "type": "doctor_patient" | "reviewer"
}

Response 200:
{
  "message": "Request sent.",
  "to_name": "string"
}
```

### Get incoming requests
```
GET /api/connections/requests/incoming
[Protected]

Response 200:
[
  {
    "id": "uuid",
    "type": "doctor_patient" | "reviewer",
    "from_id": "uuid",
    "from_name": "string",
    "from_role": "string",
    "patient_id": "uuid",
    "created_at": "ISO"
  }
]
```

### Get outgoing requests
```
GET /api/connections/requests/outgoing
[Protected]

Response 200:
[
  {
    "id": "uuid",
    "type": "string",
    "to_id": "uuid",
    "to_name": "string",
    "patient_id": "uuid",
    "created_at": "ISO"
  }
]
```

### Accept / Reject request
```
PUT /api/connections/requests/{request_id}/accept
PUT /api/connections/requests/{request_id}/reject
[Protected]

Response 200:
{
  "message": "Request accepted."
}
```

### Get doctor's patient list
```
GET /api/connections/patients/{doctor_id}
[Protected]

Response 200:
[
  {
    "patient_id": "uuid",
    "full_name": "Ramesh Kumar",
    "connected_at": "2025-01-15T00:00:00Z",
    "weekly_adherence_percentage": 87
  }
]
```

### Get patient's connected doctors
```
GET /api/connections/doctors/{patient_id}
[Protected]

Response 200:
[
  {
    "doctor_id": "uuid",
    "full_name": "Dr. Sharma",
    "connected_at": "2025-01-15T00:00:00Z"
  }
]
```

### Get patient's reviewers
```
GET /api/connections/reviewers/{patient_id}
[Protected]

Response 200:
[
  {
    "reviewer_id": "uuid",
    "full_name": "Priya Kumar",
    "connected_at": "2025-03-10T00:00:00Z"
  }
]
```

---

## Dashboard Endpoints

### Patient dashboard data
```
GET /api/dashboard/patient/{patient_id}
[Protected]

Response 200:
{
  "profile": {
    "full_name": "Ramesh Kumar",
    "allergies": "Penicillin"
  },
  "todays_medicines": [
    {
      "medicine_id": "uuid",
      "name": "Metformin",
      "dosage": "500mg",
      "reminder_times": ["08:00", "21:00"],
      "statuses": [
        { "time": "08:00", "status": "taken", "confirmed_at": "2025-04-22T08:14:00Z" },
        { "time": "21:00", "status": "pending", "confirmed_at": null }
      ],
      "quantity_on_hand": 30,
      "units_per_day": 2.0,
      "low_supply_threshold_days": 7,
      "supply_tracked": true,
      "supply_warning": false,
      "supply_restock_message": null,
      "estimated_days_of_supply": 15.0
    }
  ],
  "streak": {
    "current": 12,
    "best": 21
  },
  "weekly_percentage": 89,
  "last_week_percentage": 74
}
```

### Doctor dashboard data
```
GET /api/dashboard/doctor/{doctor_id}
[Protected]

Response 200:
{
  "profile": {
    "full_name": "Dr. Sharma"
  },
  "patients": [
    {
      "patient_id": "uuid",
      "full_name": "Ramesh Kumar",
      "weekly_percentage": 87,
      "needs_attention": false,
      "connected_at": "2025-03-10T00:00:00Z"
    }
  ]
}
```

Note: For each entry in `patients`, `weekly_percentage` is adherence over **scheduled doses in the last 30 days** (rolling window, same field name as historically used by the doctor list UI). `needs_attention` is `true` when that value is below 60.

### AI insight card — generates fresh on every call
```
GET /api/dashboard/insight/{patient_id}
[Protected]

Response 200:
{
  "insight": "Ramesh takes morning doses reliably (87%) but misses evening Metformin frequently (47%). Consider shifting the 9pm reminder to 8pm when he may be more consistent.",
  "generated_at": "2025-04-22T10:30:00Z"
}

Note: This calls Gemini on every request. Show a loading spinner.
      Takes 2-4 seconds. Do not call this on page load for the whole patient list —
      only call it when a doctor opens a specific patient's profile.
```

---

## Notes Endpoints

### Send a note
```
POST /api/notes
[Protected]
Content-Type: application/json

Body:
{
  "patient_id": "uuid",
  "doctor_id": "uuid",
  "message": "string"
}

Response 200:
{
  "message": "Note sent",
  "id": "uuid"
}
```

### Get notes thread
```
GET /api/notes/{patient_id}/{doctor_id}
[Protected]

Response 200:
[
  {
    "id": "uuid",
    "sender_role": "patient" | "doctor",
    "message": "Should I continue after 30 days?",
    "is_read": false,
    "created_at": "2025-04-10T14:30:00Z"
  }
]
```

### Mark notes as read
```
PUT /api/notes/read/{patient_id}/{doctor_id}
[Protected]

Response 200:
{
  "message": "Marked as read"
}
```

---

## Visit Timeline Endpoint

### Get patient's visit history
```
GET /api/visits/{patient_id}
[Protected]

Response 200:
[
  {
    "id": "uuid",
    "doctor_name": "Dr. Sharma",
    "visit_date": "2025-04-10T00:00:00Z",
    "action_type": "prescription_updated",
    "summary": "Added Metformin 500mg twice daily"
  }
]

Note: Ordered most recent first.
      action_type values: prescription_added | prescription_updated | note_added
```

---

## Internal Service Contracts
### (For Backend 2 — these are the functions you call, never touch their internals)

### Gemini Service
```python
# Location: backend/services/gemini_service.py
# Owner: Lead

async def extract_prescription(image_bytes: bytes) -> list[dict]:
    # Returns list of medicine dicts with keys: name, dosage, frequency, reminder_times, notes
    # Any unreadable field is None

async def generate_insight(adherence_summary: str) -> str:
    # Returns 3-4 sentence plain text insight string
    # adherence_summary is built by insight_service.py — you don't build it
```

### Scheduler Service
```python
# Location: backend/services/scheduler_service.py
# Owner: Lead

def schedule_medicine(medicine_id: str, reminder_times: list[str]) -> None:
    # Creates APScheduler cron jobs for each reminder time
    # Call this after inserting a medicine to the database

def unschedule_medicine(medicine_id: str) -> None:
    # Cancels all scheduler jobs for this medicine
    # Call this when medicine is deactivated or times change

def reschedule_medicine(medicine_id: str, new_times: list[str]) -> None:
    # Convenience: calls unschedule then schedule
    # Call this on PUT /api/medicines
```

### Token Utility
```python
# Location: backend/utils/token.py
# Owner: Lead

def generate_token() -> str:
    # Returns a 43-char URL-safe token string

def validate_token(token: str) -> dict | None:
    # Returns adherence_log row dict if valid and unused
    # Returns None if invalid or already used
```

### Visit Logger
```python
# Location: backend/utils/visits.py
# Owner: Lead

def log_visit(patient_id: str, doctor_id: str, action_type: str, summary: str) -> None:
    # Inserts a row into visits table
    # Call this every time a doctor adds/updates a medicine or sends a note
    # action_type: 'prescription_added' | 'prescription_updated' | 'note_added'
```

### Supabase Client
```python
# Location: backend/utils/supabase_client.py
# Owner: Lead

from utils.supabase_client import supabase
# Use this singleton everywhere. Never create a new Supabase client instance yourself.
```

---

## Change Rules

- Any change to this file must be announced in the group chat before committing
- If you add a new endpoint, add it here the same day
- Never rename a response field without telling the frontend members first — they break silently
- Never change the `/api/adherence/confirm` redirect URLs — they are hardcoded in the email template
- Version this file if shapes change: add a comment at top with date and what changed
- The mock server must be updated the same day any endpoint is added or changed
