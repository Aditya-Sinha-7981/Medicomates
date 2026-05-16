from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# AUTH
@app.post("/api/auth/login")
async def mock_login(body: dict):
    role = body.get("role", "patient")
    # THE FIX: Return correct name and ID based on role
    name = "Dr. Sharma" if role == "doctor" else "Ramesh Kumar"
    user_id = "mock-doctor-uuid-001" if role == "doctor" else "mock-patient-uuid-001"
    
    return {
        "access_token": "mock_token_123",
        "role": role,
        "id": user_id,
        "full_name": name
    }

@app.post("/api/auth/register")
async def mock_register(body: dict):
    return {"message": "registered", "id": "mock-uuid-001", "role": body.get("role", "patient")}


# DASHBOARD
@app.get("/api/dashboard/patient/{patient_id}")
async def mock_patient_dashboard(patient_id: str):
    if patient_id == "mock-patient-uuid-002":
        return {
            "profile": {"full_name": "Sunita Devi", "allergies": "None known"},
            "todays_medicines": [
                {
                    "medicine_id": "med-002",
                    "name": "Amlodipine",
                    "dosage": "5mg",
                    "reminder_times": ["13:00"],
                    "statuses": [{"time": "13:00", "status": "missed", "confirmed_at": None}]
                }
            ],
            "streak": {"current": 1, "best": 4},
            "weekly_percentage": 52,
            "last_week_percentage": 48
        }
        
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
    await asyncio.sleep(2)  # simulate Gemini latency
    if patient_id == "mock-patient-uuid-002":
        return {
            "insight": "Sunita is struggling with her mid-day doses (only 52% adherence). Consider a follow-up call to see if the 1:00 PM timing conflicts with her daily schedule.",
            "generated_at": "2025-04-22T10:30:00Z"
        }
        
    return {
        "insight": "Ramesh takes morning doses reliably (87%) but misses evening Metformin frequently (47%). Consider shifting the 9pm reminder to 8pm when he may be more consistent.",
        "generated_at": "2025-04-22T10:30:00Z"
    }


# MEDICINES
@app.get("/api/medicines/{patient_id}")
async def mock_medicines(patient_id: str):
    if patient_id == "mock-patient-uuid-002":
        return [
            {"id": "med-002", "name": "Amlodipine", "dosage": "5mg", "frequency": "once daily",
             "reminder_times": ["13:00"], "start_date": "2025-02-10", "end_date": None,
             "notes": "Take with water", "added_by": "doc-001", "is_active": True}
        ]

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
@app.get("/api/notes/urgent/doctor/{doctor_id}")
async def mock_urgent_doctor(doctor_id: str):
    return [
        {
            "id": "note-urgent-001",
            "patient_id": "mock-patient-uuid-001",
            "doctor_id": doctor_id,
            "message": "Feeling worse since yesterday evening.",
            "created_at": "2025-04-10T18:00:00Z",
            "patient_name": "Ramesh Kumar",
        }
    ]


@app.get("/api/notes/urgent/patient/{patient_id}")
async def mock_urgent_patient(patient_id: str):
    return [
        {
            "id": "note-urgent-002",
            "patient_id": patient_id,
            "doctor_id": "doc-001",
            "message": "Please adjust your evening dose timing.",
            "created_at": "2025-04-10T17:00:00Z",
            "doctor_name": "Dr. Sharma",
        }
    ]


@app.get("/api/notes/{patient_id}/{doctor_id}")
async def mock_notes(patient_id: str, doctor_id: str):
    return [
        {"id": "note-001", "sender_role": "patient", "message": "Should I continue after 30 days?",
         "is_urgent": False, "is_read": True, "created_at": "2025-04-10T14:30:00Z"},
        {"id": "note-002", "sender_role": "doctor", "message": "Yes, continue until next visit.",
         "is_urgent": False, "is_read": True, "created_at": "2025-04-10T16:00:00Z"},
        {"id": "note-003", "sender_role": "patient", "message": "Chest tightness since morning.",
         "is_urgent": True, "is_read": False, "created_at": "2025-04-10T18:00:00Z"},
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
    if patient_id == "mock-patient-uuid-002":
        return [
            {"id": "visit-003", "doctor_name": "Dr. Sharma", "visit_date": "2025-04-15T00:00:00Z",
             "action_type": "prescription_added", "summary": "Added Amlodipine 5mg"}
        ]
        
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