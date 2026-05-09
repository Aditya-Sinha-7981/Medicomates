# **MEDICOMATES - Complete Project Code Flow Analysis**

## **I. PROJECT OVERVIEW**

**What is it?** A three-sided medication adherence platform for elderly patients, doctors, and family reviewers.

**The Core Problem:** Elderly patients forget their medicines. Doctors have no visibility between appointments. Families worry.

**The Solution:** 
- Patients receive **HTML reminder emails** with a single "Yes I took it" button (no login required)
- Doctors see **AI-generated adherence summaries** and full patient history timelines
- Reviewers (family) see a **read-only dashboard** of their loved one's adherence

**4 Key USPs:**
1. One-click email adherence (no login required)
2. AI insight cards for doctors (Gemini-powered summaries)
3. Full patient history profile (medicines, allergies, timeline)
4. Prescription OCR → auto-prefilled medicine forms

---

## **II. TECH STACK**

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React (Vite) | Patient & doctor dashboards |
| **Backend** | FastAPI (Python 3.11) | REST API + scheduler |
| **Database** | Supabase (Postgres) | All data + auth |
| **Authentication** | Supabase Auth | JWT-based, no custom auth |
| **Scheduler** | APScheduler | Daily medicine reminders (cron jobs) |
| **Email** | Resend API | HTML reminder emails |
| **AI - OCR** | Gemini 2.0 Flash | Prescription image extraction |
| **AI - Insights** | Gemini 2.0 Flash | Adherence summaries for doctors |

---

## **III. DATABASE SCHEMA**

```
┌─────────────────────────────────────────────────────┐
│                   CORE TABLES                        │
└─────────────────────────────────────────────────────┘

profiles (users)
├── id (PK, references auth.users)
├── role ('patient' | 'doctor')
├── full_name
├── phone
├── date_of_birth
├── allergies (free text)
└── created_at

medicines (prescriptions)
├── id (PK)
├── patient_id (FK → profiles)
├── name ("Metformin")
├── dosage ("500mg")
├── frequency ("twice daily")
├── reminder_times (["08:00", "21:00"])
├── start_date, end_date
├── notes ("take after food")
├── added_by (FK → profiles, doctor or patient)
├── is_active (boolean)
└── created_at

adherence_logs (dose tracking)
├── id (PK)
├── medicine_id (FK → medicines)
├── patient_id (FK → profiles)
├── scheduled_time (ISO datetime of when reminder sent)
├── confirmed_at (NULL until patient confirms)
├── token (unique, one-time, secure URL token)
├── token_used (boolean, prevents double-click)
└── created_at

patient_doctor_connections (relationships)
├── id (PK)
├── patient_id (FK)
├── doctor_id (FK)
├── connected_at
└── is_active

patient_reviewer_connections (read-only relationships)
├── id (PK)
├── patient_id (FK)
├── reviewer_id (FK → another patient profile)
└── connected_at

visits (timeline of all events)
├── id (PK)
├── patient_id (FK)
├── doctor_id (FK)
├── visit_date
├── action_type ('prescription_added' | 'prescription_updated' | 'note_added')
├── summary (e.g., "Added Metformin 500mg twice daily")
└── created_at

notes (async communication)
├── id (PK)
├── patient_id (FK)
├── doctor_id (FK)
├── sender_role ('patient' | 'doctor')
├── message
├── is_read (boolean)
└── created_at
```

---

## **IV. BACKEND ARCHITECTURE & REQUEST FLOW**

### **File Structure**
```
backend/
├── main.py                         ← FastAPI app entry
├── config.py                       ← Reads .env settings
├── scheduler.py                    ← APScheduler setup
├── api/                            ← All route handlers
│   ├── auth.py                     ← Register/Login
│   ├── medicines.py                ← CRUD medicines
│   ├── adherence.py                ← Adherence logs & email confirmation
│   ├── ocr.py                      ← Prescription image extraction
│   ├── notes.py                    ← Patient-doctor async messages
│   ├── connections.py              ← Connect doctor/reviewer to patient
│   └── dashboard.py                ← Aggregated data for UIs
├── services/                       ← Business logic
│   ├── email_service.py            ← Sends emails via Resend
│   ├── gemini_service.py           ← All Gemini API calls
│   ├── scheduler_service.py        ← Scheduling reminder jobs
│   └── insight_service.py          ← AI insight generation
├── models/
│   └── schemas.py                  ← Pydantic request/response models
└── utils/
    ├── token.py                    ← Secure token generation/validation
    ├── adherence_stats.py          ← Status calculations
    └── supabase_client.py          ← Supabase DB client
```

### **Startup Flow**
1. `main.py` creates FastAPI app with `lifespan` context manager
2. On startup:
   - `start_scheduler()` initializes APScheduler
   - `reschedule_all_active_medicines()` rebuilds all cron jobs from DB
3. On shutdown: `shutdown_scheduler()` cleans up

### **Core Endpoints**

#### **1. Authentication Flow**
```
POST /api/auth/register
  ↓
  Supabase Auth creates user → Get JWT
  ↓
  Insert profile record with role ('patient' | 'doctor')
  ↓
  Return { access_token, role, id, full_name }

POST /api/auth/login
  ↓
  Supabase Auth validates credentials → Get JWT
  ↓
  Query profiles table for role and name
  ↓
  Return { access_token, role, id, full_name }
```

#### **2. Medicine Management Flow**
```
POST /api/medicines (Add Medicine)
  ├─ Validate input (MedicineSchema)
  ├─ Insert into medicines table
  ├─ Call schedule_medicine(medicine_id, reminder_times)
  │   └─ For each time: Add APScheduler cron job
  │       └─ Job runs at that time each day → send_reminder_for_medicine()
  ├─ Log visit: "Added {name} {dosage}"
  └─ Return { id, message }

PUT /api/medicines/{id} (Update Medicine)
  ├─ Update medicines table
  ├─ Call reschedule_medicine() 
  │   └─ Remove old jobs → Add new jobs
  ├─ Log visit: "Updated medicine"
  └─ Return { message }

DELETE /api/medicines/{id} (Deactivate)
  ├─ Set is_active = false
  ├─ Call unschedule_medicine()
  │   └─ Remove all APScheduler jobs for this medicine
  └─ Return { message }

GET /api/medicines/{patient_id} (List)
  └─ Select all active medicines for patient
```

#### **3. Reminder Scheduling & Adherence Flow** (THE HEART)
```
Every day at scheduled reminder time (e.g., 08:00):
  
APScheduler triggers → send_reminder_for_medicine(medicine_id)
  ├─ Fetch medicine record
  ├─ Fetch patient email from Supabase Auth
  ├─ Generate secure token: secrets.token_urlsafe(32)
  ├─ Insert into adherence_logs:
  │   {
  │     medicine_id, patient_id, scheduled_time (now),
  │     token (UNIQUE), token_used=false, confirmed_at=NULL
  │   }
  ├─ Build HTML email with button:
  │   <a href="{BACKEND_URL}/api/adherence/confirm?token={token}">
  │     ✅ Yes, I took it
  │   </a>
  └─ Send via Resend.Emails.send()

When patient clicks email link (24 hours later, could be anytime):
  
GET /api/adherence/confirm?token={token} [PUBLIC - no auth]
  ├─ Query adherence_logs: find token, token_used=false
  ├─ If found:
  │   ├─ Update adherence_logs:
  │   │   { confirmed_at=now(), token_used=true }
  │   └─ Redirect to {FRONTEND_URL}/confirm?status=success
  ├─ If not found or already used:
  │   └─ Redirect to {FRONTEND_URL}/confirm?status=invalid
```

#### **4. Adherence Data Retrieval**
```
GET /api/adherence/{patient_id}?days=30
  ├─ Query adherence_logs from last 30 days
  ├─ Fetch medicines list to map names
  ├─ Compute status for each log:
  │   confirmed_at is NOT null  → "taken"
  │   confirmed_at IS null AND past scheduled_time  → "missed"
  │   confirmed_at IS null AND future scheduled_time  → "pending"
  └─ Return enriched logs with { status, medicine_name, confirmed_at }

GET /api/adherence/{patient_id}/summary
  ├─ Group logs by medicine_id and time_slot
  ├─ Calculate per-medicine and per-timeslot percentages
  └─ Return {
      medicine_id, medicine_name, taken_count, missed_count,
      percentage, time_slots: [ { time, taken, missed, % } ]
    }
```

#### **5. OCR (Prescription Image Extraction)**
```
POST /api/ocr [Protected]
  ├─ Receive multipart/form-data with image file
  ├─ Validate size (max 10MB) and MIME type
  ├─ Convert image to base64
  ├─ Call extract_prescription_data(image_bytes, mime_type)
  │   └─ Gemini 2.0 Flash processes:
  │       Input: OCR_PROMPT + base64 image
  │       Output: JSON array of medicines
  │       [
  │         {
  │           name, dosage, frequency,
  │           reminder_times: ["HH:MM", "HH:MM"],
  │           notes
  │         }
  │       ]
  ├─ Validate JSON structure
  ├─ Sanitize fields (nulls stay null, never auto-save)
  └─ Return array to frontend for form prefilling
```

#### **6. Dashboard Aggregation**
```
GET /api/dashboard/patient/{patient_id}
  ├─ Fetch profile: full_name, allergies
  ├─ Fetch adherence logs (last 60 days)
  ├─ Calculate streak: consecutive days with 100% adherence
  ├─ Calculate weekly % and last week %
  ├─ Get today's medicines with status for each reminder time
  │   └─ For each medicine:
  │       For each reminder_time:
  │         Look up today's adherence_log for that slot
  │         Compute status (taken/missed/pending)
  └─ Return {
      profile, todays_medicines: [ { name, dosage, statuses: [...] } ],
      streak: { current, best },
      weekly_percentage, last_week_percentage
    }

GET /api/dashboard/doctor/{doctor_id}
  ├─ Query patient_doctor_connections for this doctor
  ├─ For each connected patient:
  │   ├─ Count today's medicines
  │   ├─ Count doses marked as "taken" today
  │   ├─ Calculate adherence %
  └─ Return patient list with adherence stats
```

#### **7. Connections**
```
POST /api/connections/doctor
  ├─ Validate patient_id and doctor_id don't already connect
  ├─ Insert patient_doctor_connections record
  └─ Return { message }

POST /api/connections/reviewer
  ├─ Query Supabase Auth users by email
  ├─ Validate reviewer is a patient (role='patient')
  ├─ Insert patient_reviewer_connections
  └─ Return { message, reviewer_name }

GET /api/connections/patients/{doctor_id}
  └─ Return list of all patients connected to this doctor

GET /api/connections/reviewers/{patient_id}
  └─ Return list of all reviewers for this patient
```

#### **8. Notes (Async Communication)**
```
POST /api/notes
  ├─ Insert new note record
  ├─ Log visit: "Note: {message[:80]}"
  └─ Return { message, id }

GET /api/notes/{patient_id}/{doctor_id}
  └─ Return all notes between this patient and doctor (ordered by created_at)

PUT /api/notes/read/{patient_id}/{doctor_id}
  └─ Mark all unread notes as is_read=true
```

### **Service Layer Details**

#### **email_service.py**
```python
build_reminder_email(medicine_name, dosage, token)
  └─ Returns HTML string with styled button
  
send_reminder_email(to_email, medicine_name, dosage, token)
  └─ Calls resend.Emails.send() with HTML content
```

#### **gemini_service.py**
```python
extract_prescription_data(image_bytes, mime_type)
  ├─ Configure Gemini API
  ├─ Send OCR_PROMPT + image to Gemini 2.0 Flash
  ├─ Parse JSON response
  ├─ Strip markdown code fences
  └─ Return structured medicine data
```

#### **scheduler_service.py**
```python
reschedule_all_active_medicines()
  ├─ Query all is_active=true medicines
  ├─ For each medicine + reminder_time:
  │   └─ Call schedule_medicine()
  └─ Log boot reschedule count

schedule_medicine(medicine_id, reminder_times)
  ├─ For each time string ("08:00"):
  │   └─ Add APScheduler job:
  │       trigger=CronTrigger(hour=8, minute=0)
  │       func=send_reminder_for_medicine(medicine_id)
  │       id=f"reminder_{medicine_id}_0800"
  │       replace_existing=true
  └─ Log scheduled jobs

unschedule_medicine(medicine_id)
  └─ Find and remove all APScheduler jobs starting with
     f"reminder_{medicine_id}_"

reschedule_medicine(medicine_id, new_times)
  ├─ unschedule_medicine(medicine_id)
  └─ schedule_medicine(medicine_id, new_times)

send_reminder_for_medicine(medicine_id)
  ├─ Fetch medicine record
  ├─ Check is_active (skip if inactive)
  ├─ Fetch patient email
  ├─ Generate token
  ├─ Insert adherence_log
  └─ Call send_reminder_email()
```

---

## **V. FRONTEND ARCHITECTURE & UI FLOW**

### **File Structure**
```
frontend/src/
├── App.jsx                         ← Router & protected routes
├── main.jsx                        ← React entry point
├── pages/
│   ├── Splash.jsx                  ← Landing page
│   ├── Login.jsx                   ← Login form
│   ├── Register.jsx                ← Registration form
│   ├── PatientDashboard.jsx        ← Patient home (adherence overview)
│   ├── DoctorDashboard.jsx         ← Doctor home (patient list)
│   ├── MedicineForm.jsx            ← Add/edit medicine + OCR
│   ├── ConfirmTaken.jsx            ← Email link landing page
│   ├── PatientProfile.jsx          ← Doctor's view of patient
│   ├── Notes.jsx                   ← Patient-doctor messaging
│   └── Profile.jsx                 ← Profile settings
├── components/
│   ├── AdherenceCalendar.jsx       ← 30-day grid visualization
│   ├── InsightCard.jsx             ← AI summary card
│   ├── MedicineCard.jsx            ← Single medicine status
│   ├── PatientListCard.jsx         ← Doctor's patient item
│   ├── VisitTimeline.jsx           ← Timeline of events
│   ├── NoteThread.jsx              ← Messages display
│   ├── BottomNav.jsx               ← Mobile nav
│   ├── layout/
│   │   ├── AppShell.jsx            ← Header + sidebar wrapper
│   │   └── AuthLayout.jsx          ← Auth pages wrapper
│   └── ui/
│       ├── Modal.jsx               ← Confirmation dialogs
│       ├── Skeleton.jsx            ← Loading placeholders
│       └── ToastContext.jsx        ← Toast notifications
├── hooks/
│   ├── useAuth.js                  ← Auth state & methods
│   └── usePatientData.js           ← Patient data loading & caching
├── services/
│   ├── api.js                      ← Centralized fetch client
│   └── supabaseClient.js           ← Supabase client
└── utils/
    └── auth.js                     ← Token management
```

### **Routing & ProtectedRoute**

```jsx
// App.jsx Route Structure

Public Routes:
  / → Splash (landing page)
  /login → Login
  /register → Register
  /confirm?status=success|invalid → ConfirmTaken (no auth needed!)

Protected Routes (Patient):
  /patient → PatientDashboard (role='patient')
  /medicines → MedicineForm (new medicine)
  /medicine/new → MedicineForm
  /notes → Notes (messaging)
  /profile → Profile (any role)

Protected Routes (Doctor):
  /doctor → DoctorDashboard (role='doctor')
  /patient-profile/:patientId → PatientProfile (view patient details)
  /profile → Profile

ProtectedRoute Component:
  ├─ Check localStorage for auth_token
  ├─ If no token → redirect to /login
  ├─ If has requiredRole → verify user.role matches
  ├─ Else redirect to default dashboard for that role
```

### **Authentication Flow**

```
User Registration:
  1. Register.jsx form → useAuth.register()
  2. api.post(/api/auth/register, data)
     ├─ Backend: supabase.auth.sign_up()
     ├─ Backend: insert profiles record
     └─ Returns { id, role }
  3. Redirect to Login

User Login:
  1. Login.jsx form → useAuth.login()
  2. api.post(/api/auth/login, data)
     ├─ Backend: supabase.auth.sign_in_with_password()
     ├─ Backend: query profiles for full_name + role
     └─ Returns { access_token, role, id, full_name }
  3. Frontend stores in localStorage:
     {
       auth_token: "eyJ...",
       current_user: { id, email, role, full_name }
     }
  4. Redirect based on role:
     role='doctor' → /doctor
     role='patient' → /patient

Every API call:
  ├─ Retrieve auth_token from localStorage
  ├─ Attach Authorization: Bearer {token}
  └─ Backend validates JWT with Supabase
```

### **Patient Dashboard Flow**

```
PatientDashboard.jsx Load:
  1. usePatientData() hook fetches:
     ├─ GET /api/dashboard/patient/{id}
     ├─ GET /api/connections/doctors/{id}
     ├─ GET /api/visits/{id}
     └─ GET /api/adherence/{id}?days=30
  
  2. Data structure returned:
     {
       dashboard: {
         profile: { full_name, allergies },
         todays_medicines: [
           {
             medicine_id, name, dosage,
             statuses: [ { time, status, confirmed_at } ]
           }
         ],
         streak: { current, best },
         weekly_percentage,
         last_week_percentage
       },
       doctors: [ { doctor_id, connected_at } ],
       visits: [ { action_type, summary, visit_date } ],
       adherenceLogs: [ { status, medicine_name, confirmed_at } ]
     }
  
  3. Frontend renders:
     ├─ Header: "Good to see you, {name}" + weekly %
     ├─ Stats cards: Weekly %, Doses today, Streak, Last week %
     ├─ Todays medicines section:
     │   For each medicine:
     │     MedicineCard showing:
     │       - Medicine name + dosage
     │       - Each reminder time with status button
     │       - [Taken] button if pending
     ├─ Adherence calendar (30-day grid)
     │   - Each day: green (taken) | red (missed) | grey (pending)
     ├─ Recent visits (timeline)
     └─ Add medicine button → MedicineForm

Patient Actions:
  Mark dose taken → [Mark taken] button
    ├─ Frontend: markDoseTaken(medicineId, time)
    ├─ Store in localStorage overlay (for immediate UI update)
    ├─ Reload patient data
    └─ Re-render dashboard

Patient Actions:
  Add medicine → Click [Add medicine]
    └─ Navigate to MedicineForm
```

### **Medicine Form Flow (with OCR)**

```
MedicineForm.jsx Load:
  1. If editing, fetch medicine from location.state
  2. Build initial form state:
     {
       patient_id, name, dosage, frequency,
       reminder_times: ["08:00"],
       notes, start_date, end_date
     }

OCR Workflow:
  1. User clicks [Upload prescription]
  2. Select image file (JPG/PNG, max 10MB)
  3. handleOcrFile():
     ├─ Create FormData
     ├─ POST /api/ocr with image
     ├─ Backend processes with Gemini
     └─ Returns [{ name, dosage, frequency, reminder_times, notes }]
  4. Frontend prefills form fields:
     - name, dosage, frequency from OCR
     - reminder_times array
     - notes (optional)
  5. User edits if needed:
     - Add/remove reminder times
     - Correct any OCR errors
     - Add notes
  6. Click [Save]

Form Submission:
  1. POST /api/medicines or PUT /api/medicines/{id}
  2. Backend:
     ├─ Insert/update medicines table
     ├─ Schedule cron jobs for reminder_times
     └─ Log visit
  3. Frontend:
     └─ Navigate back to /patient
```

### **Doctor Dashboard Flow**

```
DoctorDashboard.jsx Load:
  1. Query localStorage for patients list
  2. Query localStorage for medicines list
  3. Query localStorage for dose_logs
  
  4. Compute for each patient:
     ├─ Count active medicines
     ├─ Count doses taken today
     ├─ Calculate adherence %
  
  5. Render patient cards:
     ├─ Patient name + adherence %
     ├─ "X/Y doses taken today"
     └─ [View profile] button → /patient-profile/{id}

PatientProfile.jsx Load:
  1. Parse patientId from URL params
  2. Query localStorage for:
     ├─ Patient profile
     ├─ Patient's medicines
     └─ Patient's dose logs for today
  
  3. Render:
     ├─ Patient name + email
     ├─ Stat cards:
     │   - Active medicines count
     │   - Doses taken today
     │   - Total scheduled today
     └─ Current medicine plan (list of active medicines)
```

### **Email Confirmation (ConfirmTaken) Flow**

```
Patient receives reminder email:
  From: reminders@yourdomain.com
  Body: HTML with styled "✅ Yes, I took it" button
  Link: {BACKEND_URL}/api/adherence/confirm?token={unique_token}

Patient clicks link:
  1. Browser GET /api/adherence/confirm?token={token}
  2. Backend:
     ├─ Query adherence_logs for token
     ├─ Check token_used=false
     ├─ If valid:
     │   ├─ Set confirmed_at=now()
     │   ├─ Set token_used=true
     │   └─ Redirect to {FRONTEND_URL}/confirm?status=success
     └─ If invalid:
         └─ Redirect to {FRONTEND_URL}/confirm?status=invalid
  
  3. Frontend ConfirmTaken.jsx:
     ├─ Read URL param status
     ├─ If status=success:
     │   ├─ Show ✅ "Dose Confirmed"
     │   └─ Message: "Great job! Your dose has been recorded."
     └─ Else:
         ├─ Show 🙂 "Link Unavailable"
         └─ Message: "Already confirmed or link expired."
```

### **Hook: useAuth()**

```javascript
useAuth() hook:
  ├─ State:
  │   user (getCurrentUser())
  │   loading, error
  │
  ├─ Methods:
  │   login(email, password)
  │     ├─ Call authLogin() from utils/auth.js
  │     ├─ Store in localStorage
  │     └─ Redirect to /patient or /doctor
  │
  │   register(formData)
  │     ├─ Call registerUser() from utils/auth.js
  │     └─ Redirect to /login
  │
  │   logout()
  │     ├─ Clear localStorage
  │     └─ Navigate to /login
```

### **Hook: usePatientData()**

```javascript
usePatientData() hook:
  ├─ State:
  │   dashboard, doctors, visits, adherenceLogs
  │   loading, error
  │
  ├─ On mount:
  │   └─ Promise.all() 4 API calls:
  │       1. dashboard/patient
  │       2. connections/doctors
  │       3. visits
  │       4. adherence logs
  │
  ├─ Overlays (localStorage):
  │   ├─ readOverlay() → medicine_dose_overlay entries
  │   │   └─ Used for optimistic UI updates when marking "taken"
  │   ├─ readCancelled() → cancelled_medicines
  │   │   └─ Used to hide deactivated medicines in UI
  │   └─ applyDashboardOverlay()
  │       └─ Merge overlay data into dashboard before rendering
  │
  ├─ Methods:
  │   markDoseTaken(medicineId, time)
  │     ├─ Store in localStorage overlay
  │     ├─ Call loadData() to refresh from API
  │
  │   markDoseUntaken(medicineId, time)
  │     ├─ Remove from localStorage overlay
  │     └─ Call loadData()
  │
  │   cancelMedicine(medicineId)
  │     ├─ Add to cancelled list
  │     └─ Filter from todays_medicines display
```

### **API Service (api.js)**

```javascript
api.js Structure:
  ├─ BASE_URL: read from import.meta.env.VITE_API_URL
  │   Dev mock: http://localhost:8001
  │   Dev real: http://localhost:8000
  │   Prod: https://your-app.railway.app
  │
  ├─ authHeadersJson():
  │   { Authorization: `Bearer ${localStorage.auth_token}` }
  │
  ├─ Methods:
  │   api.get(path)
  │   api.post(path, body)
  │   api.put(path, body)
  │   api.delete(path)
  │   api.upload(path, formData)  // multipart/form-data
  │
  └─ endpoints object (centralized route definitions):
      ├─ auth.register, auth.login
      ├─ medicines.list, create, update, remove
      ├─ adherence.logs, summary
      ├─ dashboard.patient, doctor
      ├─ connections.*, notes.*
      └─ ocr()
```

---

## **VI. COMPLETE END-TO-END USER FLOWS**

### **Flow 1: Patient Registration & Setup**

```
1. Patient visits app → Splash page
2. Clicks "Register" → Register.jsx
3. Fills form:
   Email, Password (6+ chars), Full Name, Select "Patient"
4. Submit:
   POST /api/auth/register
   ├─ Supabase Auth creates user
   ├─ profiles table gets new record (role='patient')
   └─ Returns user ID
5. Redirected to /login
6. Enters credentials → Login.jsx
7. POST /api/auth/login:
   ├─ Supabase Auth validates
   ├─ Returns JWT access_token
   └─ Frontend stores in localStorage
8. Redirected to /patient (PatientDashboard)
```

### **Flow 2: Add Medicine with OCR**

```
1. Patient on dashboard → Click [Add medicine]
   → Navigate to /medicines (MedicineForm)

2. Option A: Manual entry
   ├─ Type medicine name, dosage, frequency
   ├─ Add reminder times (e.g., 08:00, 21:00)
   ├─ Click [Save]
   └─ POST /api/medicines

2. Option B: Upload prescription
   ├─ Click [Upload prescription]
   ├─ Select JPG/PNG image
   ├─ Frontend:
   │   ├─ Create FormData with image
   │   ├─ POST /api/ocr
   │   └─ Backend: Gemini extracts medicine data
   ├─ Form auto-fills:
   │   name, dosage, frequency, reminder_times
   ├─ Patient reviews & edits if needed
   ├─ Click [Save]
   └─ POST /api/medicines with sanitized data

3. Backend on POST /api/medicines:
   ├─ Insert into medicines table
   ├─ Get medicine_id
   ├─ For each reminder_time (e.g., "08:00"):
   │   ├─ APScheduler creates cron job
   │   ├─ Job ID: "reminder_{med_id}_0800"
   │   └─ Trigger: daily at 08:00 UTC
   ├─ Log visit: "Added Metformin 500mg"
   └─ Return { id, message }

4. Frontend redirects to /patient (dashboard)

Daily:
  At 08:00 UTC:
  ├─ APScheduler triggers send_reminder_for_medicine()
  ├─ Generate secure token
  ├─ Insert adherence_log (confirmed_at=NULL)
  ├─ Send HTML email to patient with unique link
  └─ Email contains: [✅ Yes, I took it] button

When patient clicks email link:
  ├─ GET /api/adherence/confirm?token={token}
  ├─ Backend validates token & marks taken
  ├─ Redirect to /confirm?status=success
  └─ Frontend shows: ✅ "Dose Confirmed"
```

### **Flow 3: Doctor Connects to Patient**

```
Requirement: They need a connection method (code sharing / invite link)
Currently: No implementation visible in codebase

Assuming manual setup via API:
  1. Both doctor and patient registered
  2. Doctor posts: POST /api/connections/doctor
     {
       patient_id: "{patient_uuid}",
       doctor_id: "{doctor_uuid}"
     }
  3. Backend:
     ├─ Check no duplicate connection exists
     ├─ Insert patient_doctor_connections
     └─ Return { message }
  
  4. Doctor now sees patient in /doctor dashboard
  5. Doctor can click [View profile] → /patient-profile/{patientId}
     ├─ Fetch patient's medicines
     ├─ Fetch patient's adherence data
     ├─ View timeline of events
```

### **Flow 4: Doctor Views Patient Dashboard (PatientProfile)**

```
1. Doctor on DoctorDashboard
2. Clicks patient card → Navigate to /patient-profile/{patientId}

3. PatientProfile.jsx:
   ├─ Load from localStorage (mock data)
   ├─ Query medicines for this patient
   ├─ Query dose_logs for today
   
4. Render:
   ├─ Patient name + email
   ├─ Stat cards:
   │   - Active medicines: X
   │   - Doses taken today: Y
   │   - Total scheduled: Z
   ├─ Current medicine plan:
   │   For each active medicine:
   │     - Name + dosage
   │     - Frequency + reminder times
   └─ [Edit medicine] button (if doctor role)

(Note: API endpoints built but not fully integrated to frontend)
```

### **Flow 5: Patient Adds Family Member as Reviewer**

```
Requirement: Patient adds email of family member

Flow:
  1. Patient's Profile page (future feature)
  2. Section: "Add reviewer (family member)"
  3. Enter reviewer email
  4. POST /api/connections/reviewer:
     {
       patient_id: "{my_id}",
       reviewer_email: "daughter@email.com"
     }
  
  5. Backend:
     ├─ Query Supabase Auth users for email
     ├─ Verify found user has role='patient'
     ├─ Insert patient_reviewer_connections
     └─ Return { message, reviewer_name }
  
  6. Reviewer (daughter) logs in (she's a patient too)
  7. Sees option: "View dashboards you have access to"
  8. Selects her father's dashboard (read-only)
  9. Views his:
     ├─ Today's medicines + status
     ├─ 30-day calendar
     ├─ Adherence stats
     ├─ Streak
     └─ Recent visits/events
```

### **Flow 6: Patient-Doctor Async Messaging**

```
1. Patient on Notes page
2. Compose message to doctor
3. POST /api/notes:
   {
     patient_id, doctor_id, message
   }
4. Backend:
   ├─ Insert notes record
   ├─ Log visit: "Note: {message[:80]}"
   └─ Return { message, id }

5. Doctor can view note thread:
   GET /api/notes/{patient_id}/{doctor_id}
   └─ Return all messages ordered by created_at

6. Doctor replies (endpoint exists but frontend not shown):
   POST /api/notes with sender_role='doctor'
```

---

## **VII. KEY DATA FLOWS**

### **Data Flow 1: Reminder Trigger to Email**

```
Timeline:
  Day 1, 08:00 UTC:
    ├─ APScheduler wakes up (job ID: "reminder_med123_0800")
    ├─ Calls: send_reminder_for_medicine("med123")
    ├─ Fetch medicine: { name: "Metformin", dosage: "500mg" }
    ├─ Fetch patient email: "ramesh@email.com"
    ├─ Generate token: "aBcDeF...xyz123"
    ├─ Insert adherence_logs:
    │   {
    │     medicine_id: "med123",
    │     patient_id: "patient456",
    │     scheduled_time: "2025-04-10T08:00:00Z",
    │     token: "aBcDeF...xyz123",
    │     token_used: false,
    │     confirmed_at: null
    │   }
    └─ Send email via Resend:
        From: reminders@medadhere.com
        To: ramesh@email.com
        Subject: Time to take your Metformin
        HTML: <button href="...?token=aBcDeF...xyz123">
                 ✅ Yes, I took it
              </button>

  Day 1, 08:05 (patient checks email):
    ├─ Opens email client
    ├─ Reads: "Time to take your Metformin 500mg"
    ├─ Clicks button
    └─ Browser: GET /api/adherence/confirm?token=aBcDeF...xyz123
        ├─ Backend queries adherence_logs by token
        ├─ Validates token_used=false
        ├─ Updates:
        │   confirmed_at: "2025-04-10T08:05:30Z"
        │   token_used: true
        └─ Redirects to /confirm?status=success

  Day 1, 08:06 (frontend):
    ├─ ConfirmTaken.jsx renders
    ├─ Shows: ✅ "Dose Confirmed"
    └─ Message: "Great job! Keep it up."
```

### **Data Flow 2: Dashboard Data Aggregation**

```
User: Patient navigates to /patient

Frontend requests:
  Promise.all([
    GET /api/dashboard/patient/{id},
    GET /api/connections/doctors/{id},
    GET /api/visits/{id},
    GET /api/adherence/{id}?days=30
  ])

Backend processing:

GET /api/dashboard/patient/{id}:
  ├─ SELECT * FROM profiles WHERE id={id}
  ├─ SELECT * FROM adherence_logs WHERE patient_id={id} AND scheduled_time >= 60 days ago
  ├─ SELECT * FROM medicines WHERE patient_id={id} AND is_active=true
  ├─ Calculate streak (consecutive 100% adherence days)
  ├─ Calculate weekly_percentage (7 days)
  ├─ Calculate last_week_percentage (14-7 days)
  ├─ For today (local date in SCHEDULER_TIMEZONE):
  │   For each active medicine:
  │     For each reminder_time:
  │       Look up adherence_log matching today + time slot
  │       Compute status (taken/missed/pending)
  │       Build statuses array
  └─ Return aggregated dashboard object

GET /api/adherence/{id}?days=30:
  ├─ SELECT * FROM adherence_logs WHERE patient_id={id} AND scheduled_time >= 30 days ago
  ├─ Map medicine names
  ├─ Compute status for each log
  └─ Return enriched logs

Frontend receives:
  {
    dashboard: {
      profile: { full_name, allergies },
      todays_medicines: [ { medicine_id, name, dosage, statuses } ],
      streak: { current: 12, best: 21 },
      weekly_percentage: 89,
      last_week_percentage: 74
    },
    adherenceLogs: [ { status, medicine_name, confirmed_at } ]
  }

Frontend renders:
  ├─ Header: "Good to see you, Ramesh" + "Weekly: 89%"
  ├─ Stat cards: 89% | 6/7 doses | 🔥12 | 74%
  ├─ Todays medicines:
  │   Metformin 500mg
  │   ├─ 08:00 [Taken] ✓
  │   └─ 21:00 [Mark taken]
  ├─ 30-day calendar:
  │   Grid of 30 dots, green/red/grey indicating daily status
  └─ Recent visits:
     - "Prescribed Lisinopril 10mg"
     - "Added reminder time 20:00"
```

### **Data Flow 3: OCR to Form Prefill**

```
User: Patient on MedicineForm, clicks [Upload prescription]

Frontend:
  ├─ Opens file picker (accept="image/*,.pdf")
  ├─ User selects: prescription.jpg (2MB)
  ├─ handleOcrFile() triggered
  ├─ Create FormData:
  │   formData.append("image", File)
  ├─ POST /api/ocr (Content-Type: multipart/form-data)
  └─ Authorization: Bearer {token}

Backend POST /api/ocr:
  ├─ Receive UploadFile
  ├─ Read file bytes
  ├─ Validate size (max 10MB)
  ├─ Determine MIME type (image/jpeg, image/png, etc.)
  ├─ Call extract_prescription_data(bytes, mime_type)
  │   ├─ Convert to base64
  │   ├─ Call Gemini 2.0 Flash:
  │   │   POST https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent
  │   │   Input: OCR_PROMPT + base64 image
  │   └─ Gemini returns JSON:
  │       [
  │         {
  │           "name": "Metformin",
  │           "dosage": "500mg",
  │           "frequency": "twice daily",
  │           "reminder_times": ["08:00", "21:00"],
  │           "notes": "take after food"
  │         }
  │       ]
  ├─ Validate JSON structure
  ├─ Sanitize (nulls stay null, don't auto-save)
  └─ Return array

Frontend receives:
  [
    {
      name: "Metformin",
      dosage: "500mg",
      frequency: "twice daily",
      reminder_times: ["08:00", "21:00"],
      notes: "take after food"
    }
  ]

Frontend prefills form:
  ├─ inputName.value = "Metformin"
  ├─ inputDosage.value = "500mg"
  ├─ inputFrequency.value = "twice daily"
  ├─ reminderTimes = ["08:00", "21:00"]
  └─ inputNotes.value = "take after food"

User edits if needed, then clicks [Save]:
  ├─ Validate fields (name required, etc.)
  ├─ POST /api/medicines with form data
  ├─ Backend schedules reminders
  └─ Frontend redirects to /patient
```

---

## **VIII. CRITICAL ARCHITECTURAL PATTERNS**

### **Pattern 1: Token-Based Adherence**

The one-click email adherence system uses **secure, one-time tokens**:
- Each reminder generates a unique token: `secrets.token_urlsafe(32)` (256-bit)
- Token stored in adherence_logs with `token_used=false`
- Email contains link: `/api/adherence/confirm?token={token}`
- Public endpoint (no auth) validates token before marking confirmed_at
- Prevents double-clicks (token_used flag)
- Prevents token reuse even if link forwarded

### **Pattern 2: Scheduler Persistence**

APScheduler jobs survive **process restarts** via boot reschedule:
- On app startup: `reschedule_all_active_medicines()`
- Queries all `is_active=true` medicines from DB
- Rebuilds **all** cron jobs from database
- Essential for Railway deployments (free tier restarts frequently)

### **Pattern 3: Frontend Overlay & Optimistic Updates**

Patient dashboard uses **localStorage overlays** for instant feedback:
```javascript
readOverlay()  // Get local dose overrides
applyDashboardOverlay()  // Merge into API response before render

markDoseTaken(medicineId, time):
  ├─ Store in localStorage overlay immediately
  ├─ UI updates instantly (optimistic)
  ├─ Call loadData() to sync with backend (eventual consistency)
```

This allows patients to see "Dose marked as taken" immediately without waiting for API response.

### **Pattern 4: API Service Centralization**

All fetch calls go through **one service** (api.js):
- Single source of truth for Base URL
- Automatic Bearer token injection
- Centralized error handling
- Consistent response parsing

### **Pattern 5: Pydantic Schema Validation**

Backend enforces schemas via Pydantic:
- `RegisterSchema`, `MedicineSchema`, `NoteSchema`, etc.
- Automatic validation on request body
- Type hints + runtime checking
- Auto-generates OpenAPI docs

### **Pattern 6: Visit Log Trail**

Every action is logged to `visits` table:
- Medicine added/updated → visit record
- Note sent → visit record
- Creates chronological timeline for patient profile
- No separate "Timeline" logic—just query visits in order

---

## **IX. TECH FLOW DIAGRAM**

```
┌────────────────────────────────────────────────────────────────┐
│                      MEDICOMATES ARCHITECTURE                  │
└────────────────────────────────────────────────────────────────┘

FRONTEND (React + Vite)          BACKEND (FastAPI)           DATABASE (Supabase)
┌─────────────────────┐          ┌─────────────────────┐      ┌──────────────────┐
│ PatientDashboard    │          │ api/               │      │ profiles         │
│ DoctorDashboard     │          │   auth.py          │      │ medicines        │
│ MedicineForm        │          │   medicines.py     │      │ adherence_logs   │
│ Notes               │────HTTP──│   adherence.py     │──SQL─│ visits           │
│ ProfileDashboard    │(JWT)     │   ocr.py           │      │ notes            │
│ ConfirmTaken        │          │   dashboard.py     │      │ connections      │
└─────────────────────┘          │   notes.py         │      │ (and 2 more)     │
        │                        │   connections.py   │      └──────────────────┘
        │                        └─────────────────────┘
        │                                 │
        │                         ┌───────┴────────┐
        │                         │                │
        │                    ┌────────────┐   ┌─────────┐
        │                    │ services/  │   │external │
        │                    │ scheduler  │   │ APIs    │
        │                    │ email      │   │         │
        │                    │ gemini     │   │ Gemini  │
        │                    └────────────┘   │ Resend  │
        │                         │           └─────────┘
        └─────────────────────────┘

EMAIL FLOW:
  APScheduler Job (cron: daily 08:00)
       │
       ├─ Generate token
       ├─ Insert adherence_log
       └─ Email via Resend
            │
            └─ Patient clicks email link
                 │
                 GET /api/adherence/confirm?token={token}
                 │
                 Mark confirmed_at → Redirect to /confirm
```

---

## **X. SUMMARY**

**Medicomates** is a **three-sided medication adherence platform** with these flows:

1. **Patient**: Receives email reminders, clicks to confirm, sees personal adherence dashboard
2. **Doctor**: Logs in, views connected patients, sees adherence stats & timeline
3. **Reviewer** (family): Read-only access to patient's adherence data

**Core differentiator**: One-click email confirmation (no app installation, no login friction) + AI-powered insights for doctors.

**Tech summary**:
- Frontend: React + Vite with central API service
- Backend: FastAPI + APScheduler for daily reminders
- Database: Supabase (Postgres) with 9 main tables
- AI: Gemini 2.0 Flash for OCR + insights
- Email: Resend for HTML reminder emails

**Data flows**:
- Reminder generated → Email sent → Patient clicks → Dose confirmed → Dashboard updated
- Patient adds medicine → OCR extracts data → Form prefilled → Reminders scheduled
- Doctor connects → Sees patient dashboard → Trends calculated → Actions logged
