from fastapi import APIRouter, HTTPException

from models.schemas import DoctorConnectionSchema, ReviewerConnectionSchema
from utils.supabase_client import supabase

router = APIRouter(prefix="/connections", tags=["connections"])


@router.post("/doctor")
async def connect_doctor(data: DoctorConnectionSchema):
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
async def add_reviewer(data: ReviewerConnectionSchema):
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
async def get_doctor_patients(doctor_id: str):
    links = (
        supabase.table("patient_doctor_connections")
        .select("patient_id, connected_at")
        .eq("doctor_id", doctor_id)
        .eq("is_active", True)
        .execute()
    )
    return [
        {
            "patient_id": row["patient_id"],
            "full_name": "",
            "connected_at": row.get("connected_at"),
            "weekly_adherence_percentage": 0,
        }
        for row in (links.data or [])
    ]


@router.get("/doctors/{patient_id}")
async def get_patient_doctors(patient_id: str):
    links = (
        supabase.table("patient_doctor_connections")
        .select("doctor_id, connected_at")
        .eq("patient_id", patient_id)
        .eq("is_active", True)
        .execute()
    )
    return links.data or []


@router.get("/reviewers/{patient_id}")
async def get_patient_reviewers(patient_id: str):
    links = (
        supabase.table("patient_reviewer_connections")
        .select("reviewer_id, connected_at")
        .eq("patient_id", patient_id)
        .execute()
    )
    return links.data or []
