from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import DoctorConnectionSchema, ReviewerConnectionSchema
from utils.adherence_stats import calculate_time_window_percentage
from utils.auth import get_current_user
from utils.supabase_client import supabase

router = APIRouter(prefix="/connections", tags=["connections"])


@router.post("/doctor")
async def connect_doctor(data: DoctorConnectionSchema, current_user: dict = Depends(get_current_user)):
    existing = (
        supabase.table("patient_doctor_connections")
        .select("id")
        .eq("patient_id", data.patient_id)
        .eq("doctor_id", data.doctor_id)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=400, detail="Connection already exists")

    supabase.table("patient_doctor_connections").insert(
        {"patient_id": data.patient_id, "doctor_id": data.doctor_id}
    ).execute()
    return {"message": "Connection established"}


@router.post("/reviewer")
async def add_reviewer(data: ReviewerConnectionSchema, current_user: dict = Depends(get_current_user)):
    users_response = supabase.auth.admin.list_users()
    users = getattr(users_response, "users", users_response)
    reviewer_user = next(
        (u for u in users if getattr(u, "email", "").lower() == data.reviewer_email.lower()),
        None,
    )
    if reviewer_user is None:
        raise HTTPException(status_code=404, detail="No patient account found with that email")

    reviewer_profile = (
        supabase.table("profiles")
        .select("id, full_name, role")
        .eq("id", reviewer_user.id)
        .single()
        .execute()
    )
    reviewer = reviewer_profile.data
    if not reviewer or reviewer.get("role") != "patient":
        raise HTTPException(status_code=404, detail="No patient account found with that email")

    supabase.table("patient_reviewer_connections").insert(
        {"patient_id": data.patient_id, "reviewer_id": reviewer_user.id}
    ).execute()
    return {"message": "Reviewer added", "reviewer_name": reviewer.get("full_name")}


@router.get("/patients/{doctor_id}")
async def get_doctor_patients(doctor_id: str, current_user: dict = Depends(get_current_user)):
    links = (
        supabase.table("patient_doctor_connections")
        .select("patient_id, connected_at")
        .eq("doctor_id", doctor_id)
        .eq("is_active", True)
        .execute()
    )
    rows = links.data or []
    if not rows:
        return []

    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=7)
    out = []
    for row in rows:
        patient_id = row["patient_id"]
        profile_res = (
            supabase.table("profiles")
            .select("full_name")
            .eq("id", patient_id)
            .single()
            .execute()
        )
        profile = profile_res.data or {}
        logs_res = (
            supabase.table("adherence_logs")
            .select("*")
            .eq("patient_id", patient_id)
            .gte("scheduled_time", week_start.isoformat())
            .execute()
        )
        logs = logs_res.data or []
        weekly_percentage = calculate_time_window_percentage(logs, week_start, now)
        out.append(
            {
                "patient_id": patient_id,
                "full_name": profile.get("full_name", "Unknown"),
                "connected_at": row.get("connected_at"),
                "weekly_adherence_percentage": weekly_percentage,
            }
        )
    return out


@router.get("/doctors/{patient_id}")
async def get_patient_doctors(patient_id: str, current_user: dict = Depends(get_current_user)):
    links = (
        supabase.table("patient_doctor_connections")
        .select("doctor_id, connected_at")
        .eq("patient_id", patient_id)
        .eq("is_active", True)
        .execute()
    )
    rows = links.data or []
    if not rows:
        return []
    out = []
    for row in rows:
        doctor_id = row["doctor_id"]
        profile_res = (
            supabase.table("profiles")
            .select("full_name")
            .eq("id", doctor_id)
            .single()
            .execute()
        )
        profile = profile_res.data or {}
        out.append(
            {
                "doctor_id": doctor_id,
                "full_name": profile.get("full_name", "Unknown"),
                "connected_at": row.get("connected_at"),
            }
        )
    return out


@router.get("/reviewers/{patient_id}")
async def get_patient_reviewers(patient_id: str, current_user: dict = Depends(get_current_user)):
    links = (
        supabase.table("patient_reviewer_connections")
        .select("reviewer_id, connected_at")
        .eq("patient_id", patient_id)
        .execute()
    )
    rows = links.data or []
    if not rows:
        return []
    out = []
    for row in rows:
        reviewer_id = row["reviewer_id"]
        profile_res = (
            supabase.table("profiles")
            .select("full_name")
            .eq("id", reviewer_id)
            .single()
            .execute()
        )
        profile = profile_res.data or {}
        out.append(
            {
                "reviewer_id": reviewer_id,
                "full_name": profile.get("full_name", "Unknown"),
                "connected_at": row.get("connected_at"),
            }
        )
    return out
