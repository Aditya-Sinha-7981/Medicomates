#!/bin/bash
# MedAdhere — Project Structure Setup
# Run ONCE from the repo root after cloning.
# Usage: bash setup_structure.sh
# Windows: use Git Bash or WSL (not cmd.exe). Python: 3.11.9 (see .python-version).

echo "Creating MedAdhere project structure..."

# ── BACKEND FOLDERS ───────────────────────────────────────────────────────────

mkdir -p backend/api
mkdir -p backend/services
mkdir -p backend/models
mkdir -p backend/utils
mkdir -p mock_api
mkdir -p docs
mkdir -p logs

# ── BACKEND PACKAGE INIT FILES ────────────────────────────────────────────────

touch backend/__init__.py
touch backend/api/__init__.py
touch backend/services/__init__.py
touch backend/models/__init__.py
touch backend/utils/__init__.py

# ── BACKEND CORE FILES (nearly empty, owner fills them in) ───────────────────

cat > backend/main.py << 'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings

app = FastAPI(title="MedAdhere API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TODO (Lead): import and register all routers here
# from api.auth import router as auth_router
# app.include_router(auth_router, prefix="/api")
EOF

cat > backend/config.py << 'EOF'
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    GEMINI_API_KEY: str
    RESEND_API_KEY: str
    FROM_EMAIL: str
    FRONTEND_URL: str
    BACKEND_URL: str
    SCHEDULER_TIMEZONE: str = "Asia/Kolkata"

    class Config:
        env_file = ".env"

settings = Settings()
EOF

touch backend/scheduler.py

# ── BACKEND API FILES ─────────────────────────────────────────────────────────

touch backend/api/auth.py
touch backend/api/medicines.py
touch backend/api/adherence.py
touch backend/api/notes.py
touch backend/api/connections.py
touch backend/api/dashboard.py
touch backend/api/ocr.py

# ── BACKEND SERVICE FILES ─────────────────────────────────────────────────────

cat > backend/services/scheduler_service.py << 'EOF'
# STUB — Lead replaces internals. Backend 2 calls these functions as-is.

def schedule_medicine(medicine_id: str, reminder_times: list) -> None:
    print(f"[STUB] Would schedule {medicine_id} at {reminder_times}")

def unschedule_medicine(medicine_id: str) -> None:
    print(f"[STUB] Would unschedule {medicine_id}")

def reschedule_medicine(medicine_id: str, new_times: list) -> None:
    unschedule_medicine(medicine_id)
    schedule_medicine(medicine_id, new_times)
EOF

cat > backend/utils/visits.py << 'EOF'
# STUB — Lead replaces internals. Backend 2 calls this function as-is.

def log_visit(patient_id: str, doctor_id: str, action_type: str, summary: str) -> None:
    print(f"[STUB] Visit logged: {action_type} — {summary}")
EOF

cat > backend/utils/supabase_client.py << 'EOF'
# Supabase singleton — import this everywhere, never create a new client yourself
# from utils.supabase_client import supabase

import os
from supabase import create_client, Client
from config import settings

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
EOF

touch backend/utils/token.py
touch backend/services/email_service.py
touch backend/services/gemini_service.py
touch backend/services/insight_service.py
touch backend/models/schemas.py

# ── BACKEND .ENV (created from .env.example, gitignored) ─────────────────────

if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "  ✓ backend/.env created from .env.example — fill in your API keys"
else
    echo "  ✓ backend/.env already exists, skipping"
fi

# ── FRONTEND FOLDERS ──────────────────────────────────────────────────────────

mkdir -p frontend/src/pages
mkdir -p frontend/src/components
mkdir -p frontend/src/hooks
mkdir -p frontend/src/services

# ── FRONTEND PAGE FILES ───────────────────────────────────────────────────────

touch frontend/src/pages/Login.jsx
touch frontend/src/pages/Register.jsx
touch frontend/src/pages/PatientDashboard.jsx
touch frontend/src/pages/DoctorDashboard.jsx
touch frontend/src/pages/PatientProfile.jsx
touch frontend/src/pages/MedicineForm.jsx
touch frontend/src/pages/ConfirmTaken.jsx
touch frontend/src/pages/Notes.jsx

# ── FRONTEND COMPONENT FILES ──────────────────────────────────────────────────

touch frontend/src/components/AdherenceCalendar.jsx
touch frontend/src/components/InsightCard.jsx
touch frontend/src/components/VisitTimeline.jsx
touch frontend/src/components/MedicineCard.jsx
touch frontend/src/components/PatientListCard.jsx
touch frontend/src/components/NoteThread.jsx

# ── FRONTEND HOOK + SERVICE FILES ─────────────────────────────────────────────

touch frontend/src/hooks/useAuth.js
touch frontend/src/hooks/usePatientData.js

cat > frontend/src/services/api.js << 'EOF'
// Central API service — all fetch calls go through here, never inline fetch in components
const BASE_URL = import.meta.env.VITE_API_URL;

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
});

export const api = {
  get: (path) =>
    fetch(`${BASE_URL}${path}`, { headers: getHeaders() }).then((r) => r.json()),

  post: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    }).then((r) => r.json()),

  put: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(body),
    }).then((r) => r.json()),

  delete: (path) =>
    fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
      headers: getHeaders(),
    }).then((r) => r.json()),

  upload: (path, formData) =>
    fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
      body: formData,
    }).then((r) => r.json()),
};
EOF

touch frontend/src/services/supabaseClient.js

# ── FRONTEND .ENV (created if missing, gitignored) ────────────────────────────

if [ ! -f frontend/.env ]; then
    cat > frontend/.env << 'EOF'
# Mock server phase: http://localhost:8001
# Real backend (ngrok): replace with URL from lead
# Production: set to Railway backend URL on Vercel
VITE_API_URL=http://localhost:8001
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
EOF
    echo "  ✓ frontend/.env created — ask lead for Supabase keys"
else
    echo "  ✓ frontend/.env already exists, skipping"
fi

# ── MOCK API ──────────────────────────────────────────────────────────────────

cat > mock_api/mock_server.py << 'EOF'
# MedAdhere Mock Server
# Full code is in TEAM.md — paste it below this comment block.
#
# Run with:
#   pip install fastapi uvicorn
#   uvicorn mock_api.mock_server:app --reload --port 8001
#
# Frontend .env must have: VITE_API_URL=http://localhost:8001

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/")
def root():
    return {"status": "paste full mock server code from TEAM.md"}
EOF

echo "  ✓ mock_api/mock_server.py placeholder created — paste full code from TEAM.md"

# ── LOCAL LOG FILES (gitignored, personal scratch notes) ─────────────────────

touch logs/lead.local.md
touch logs/backend2.local.md
touch logs/frontend1.local.md
touch logs/frontend2.local.md
touch logs/person5.local.md

echo "  ✓ logs/ created (gitignored, personal scratch space)"

# ── DONE ─────────────────────────────────────────────────────────────────────

echo ""
echo "Done. Read your section in TEAM.md before touching any file."
echo ""
echo "  LEAD:        Use Python 3.11.9 (pyenv/asdf: see .python-version)"
echo "               Fill in backend/.env — Supabase, Gemini, Resend keys"
echo "               cd backend && python -m venv venv"
echo "               Mac:     source venv/bin/activate"
echo "               Windows: venv\\Scripts\\activate"
echo "               pip install -r requirements.txt"
echo "               Paste full mock server into mock_api/mock_server.py (from TEAM.md)"
echo ""
echo "  BACKEND 2:   Ask lead for Supabase keys, fill in backend/.env"
echo "               Same venv setup as above"
echo ""
echo "  FRONTEND:    Fill in frontend/.env — ask lead for Supabase anon key"
echo "               cd frontend && npm install"
echo "               Run mock server: uvicorn mock_api.mock_server:app --reload --port 8001"
echo "               cd frontend && npm run dev"
echo ""
