"""
connections.py
--------------
All doctor-patient and reviewer connection endpoints, including the new
request-based flow (search → send request → accept/reject).

Tables used:
  connection_requests        — pending / accepted / rejected requests
  patient_doctor_connections — live doctor-patient links
  patient_reviewer_connections — live reviewer links
"""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from supabase import create_client

from config import settings
from models.schemas import ConnectionRequestSchema, DoctorConnectionSchema, ReviewerConnectionSchema
from utils.adherence_stats import calculate_time_window_percentage
from utils.auth import get_current_user
from utils.supabase_client import supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/connections", tags=["connections"])


# ---------------------------------------------------------------------------
# Helper: resolve a user profile by email (via Supabase Auth admin list)
# ---------------------------------------------------------------------------
def _find_user_by_email(email: str):
    """Return (auth_user, profile) tuple or (None, None) if not found."""
    # IMPORTANT: Use a fresh service-role client for admin operations.
    # The shared singleton may hold a user session after /api/auth/login calls,
    # which can make admin.list_users() fail with "User not allowed".
    admin_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    try:
        users_response = admin_client.auth.admin.list_users()
    except Exception as exc:
        logger.exception("Failed to query Supabase Auth users for email search")
        raise HTTPException(
            status_code=503,
            detail=(
                "User search is temporarily unavailable. "
                "Please retry in a few seconds."
            ),
        ) from exc

    users = getattr(users_response, "users", users_response)
    auth_user = next(
        (u for u in users if getattr(u, "email", "").lower() == email.lower()),
        None,
    )
    if auth_user is None:
        return None, None
    try:
        profile_res = (
            supabase.table("profiles")
            .select("id, full_name, role")
            .eq("id", auth_user.id)
            .single()
            .execute()
        )
        return auth_user, profile_res.data
    except Exception as exc:
        logger.exception("Failed to load profile for matched auth user id=%s", auth_user.id)
        raise HTTPException(
            status_code=503,
            detail="Profile lookup failed. Please retry.",
        ) from exc


# ---------------------------------------------------------------------------
# SEARCH — find a user by email before sending a request
# ---------------------------------------------------------------------------
@router.get("/search")
async def search_user(
    email: str,
    type: str,  # 'doctor_patient' | 'reviewer'
    current_user: dict = Depends(get_current_user),
):
    """
    Search for a user by email before sending a connection request.
    - type=doctor_patient → caller must be doctor, result must be patient
    - type=reviewer       → caller must be patient, result must be patient (not themselves)
    """
    if type not in ("doctor_patient", "reviewer"):
        raise HTTPException(status_code=400, detail="Invalid type. Must be 'doctor_patient' or 'reviewer'.")

    if type == "doctor_patient" and current_user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can search for patients.")

    if type == "reviewer" and current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can search for reviewers.")

    auth_user, profile = _find_user_by_email(email)
    if auth_user is None or profile is None:
        raise HTTPException(status_code=404, detail="No account found with that email.")

    if profile.get("role") != "patient":
        raise HTTPException(status_code=404, detail="No patient account found with that email.")

    if type == "reviewer" and auth_user.id == current_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot add yourself as a reviewer.")

    return {
        "user_id": auth_user.id,
        "full_name": profile.get("full_name", ""),
        "role": profile.get("role"),
    }


# ---------------------------------------------------------------------------
# SEND REQUEST
# ---------------------------------------------------------------------------
@router.post("/request")
async def send_connection_request(
    data: ConnectionRequestSchema,
    current_user: dict = Depends(get_current_user),
):
    """
    Send a connection request to another user by email.
    - type=doctor_patient: doctor → patient
    - type=reviewer:       patient-owner → reviewer-candidate
    """
    if data.type == "doctor_patient" and current_user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can send doctor-patient requests.")

    if data.type == "reviewer" and current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can send reviewer requests.")

    auth_user, profile = _find_user_by_email(data.to_email)
    if auth_user is None or profile is None:
        raise HTTPException(status_code=404, detail="No account found with that email.")

    if profile.get("role") != "patient":
        raise HTTPException(status_code=404, detail="No patient account found with that email.")

    to_id = auth_user.id

    # Determine patient_id
    if data.type == "doctor_patient":
        patient_id = to_id  # patient is the target
        # Check if already connected
        existing_conn = (
            supabase.table("patient_doctor_connections")
            .select("id")
            .eq("patient_id", patient_id)
            .eq("doctor_id", current_user["id"])
            .eq("is_active", True)
            .execute()
        )
        if existing_conn.data:
            raise HTTPException(status_code=400, detail="Already connected with this patient.")
    else:  # reviewer
        patient_id = current_user["id"]  # patient-owner is the sender
        if to_id == current_user["id"]:
            raise HTTPException(status_code=400, detail="You cannot add yourself as a reviewer.")
        # Check if already reviewing
        existing_conn = (
            supabase.table("patient_reviewer_connections")
            .select("id")
            .eq("patient_id", patient_id)
            .eq("reviewer_id", to_id)
            .execute()
        )
        if existing_conn.data:
            raise HTTPException(status_code=400, detail="This person is already your reviewer.")

    # Check for duplicate pending request
    existing_req = (
        supabase.table("connection_requests")
        .select("id, status")
        .eq("from_id", current_user["id"])
        .eq("to_id", to_id)
        .eq("type", data.type)
        .eq("status", "pending")
        .execute()
    )
    if existing_req.data:
        raise HTTPException(status_code=400, detail="A pending request already exists.")

    supabase.table("connection_requests").insert({
        "from_id": current_user["id"],
        "to_id": to_id,
        "type": data.type,
        "patient_id": patient_id,
        "status": "pending",
    }).execute()

    return {"message": "Request sent.", "to_name": profile.get("full_name")}


# ---------------------------------------------------------------------------
# INCOMING REQUESTS (for the person who needs to accept/reject)
# ---------------------------------------------------------------------------
@router.get("/requests/incoming")
async def get_incoming_requests(current_user: dict = Depends(get_current_user)):
    """Return all pending requests where to_id = current user."""
    result = (
        supabase.table("connection_requests")
        .select("*")
        .eq("to_id", current_user["id"])
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    rows = result.data or []

    enriched = []
    for row in rows:
        # Resolve the sender's name from profiles
        sender_res = (
            supabase.table("profiles")
            .select("full_name, role")
            .eq("id", row["from_id"])
            .single()
            .execute()
        )
        sender = sender_res.data or {}
        enriched.append({
            "id": row["id"],
            "type": row["type"],
            "from_id": row["from_id"],
            "from_name": sender.get("full_name", "Unknown"),
            "from_role": sender.get("role", ""),
            "patient_id": row["patient_id"],
            "created_at": row["created_at"],
        })
    return enriched


# ---------------------------------------------------------------------------
# OUTGOING REQUESTS (for the sender to track status)
# ---------------------------------------------------------------------------
@router.get("/requests/outgoing")
async def get_outgoing_requests(current_user: dict = Depends(get_current_user)):
    """Return all pending requests sent by current user."""
    result = (
        supabase.table("connection_requests")
        .select("*")
        .eq("from_id", current_user["id"])
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    rows = result.data or []

    enriched = []
    for row in rows:
        target_res = (
            supabase.table("profiles")
            .select("full_name")
            .eq("id", row["to_id"])
            .single()
            .execute()
        )
        target = target_res.data or {}
        enriched.append({
            "id": row["id"],
            "type": row["type"],
            "to_id": row["to_id"],
            "to_name": target.get("full_name", "Unknown"),
            "patient_id": row["patient_id"],
            "created_at": row["created_at"],
        })
    return enriched


# ---------------------------------------------------------------------------
# ACCEPT REQUEST
# ---------------------------------------------------------------------------
@router.put("/requests/{request_id}/accept")
async def accept_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Accept an incoming connection request and write the live connection."""
    req_res = (
        supabase.table("connection_requests")
        .select("*")
        .eq("id", request_id)
        .single()
        .execute()
    )
    req = req_res.data
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")
    if req["to_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="This request was not sent to you.")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req['status']}.")

    # Mark request as accepted
    supabase.table("connection_requests").update({"status": "accepted"}).eq("id", request_id).execute()

    # Write the actual connection
    if req["type"] == "doctor_patient":
        supabase.table("patient_doctor_connections").insert({
            "patient_id": req["patient_id"],
            "doctor_id": req["from_id"],
            "is_active": True,
        }).execute()
    else:  # reviewer
        supabase.table("patient_reviewer_connections").insert({
            "patient_id": req["patient_id"],
            "reviewer_id": req["to_id"],
        }).execute()

    return {"message": "Request accepted."}


# ---------------------------------------------------------------------------
# REJECT REQUEST
# ---------------------------------------------------------------------------
@router.put("/requests/{request_id}/reject")
async def reject_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Reject an incoming connection request."""
    req_res = (
        supabase.table("connection_requests")
        .select("id, to_id, status")
        .eq("id", request_id)
        .single()
        .execute()
    )
    req = req_res.data
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")
    if req["to_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="This request was not sent to you.")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req['status']}.")

    supabase.table("connection_requests").update({"status": "rejected"}).eq("id", request_id).execute()
    return {"message": "Request rejected."}


# ---------------------------------------------------------------------------
# REVIEWING — patients I'm reviewing (for reviewer sidebar)
# ---------------------------------------------------------------------------
@router.get("/reviewing")
async def get_reviewing(current_user: dict = Depends(get_current_user)):
    """Return list of patients that the current user is reviewing."""
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can be reviewers.")

    links = (
        supabase.table("patient_reviewer_connections")
        .select("patient_id, connected_at")
        .eq("reviewer_id", current_user["id"])
        .execute()
    )
    rows = links.data or []
    if not rows:
        return []

    rows_sorted = sorted(rows, key=lambda r: r.get("connected_at") or "", reverse=True)

    out = []
    for row in rows_sorted:
        profile_res = (
            supabase.table("profiles")
            .select("full_name")
            .eq("id", row["patient_id"])
            .single()
            .execute()
        )
        profile = profile_res.data or {}
        out.append({
            "patient_id": row["patient_id"],
            "full_name": profile.get("full_name", "Unknown"),
            "connected_at": row.get("connected_at"),
        })
    return out


# ---------------------------------------------------------------------------
# EXISTING LIST ENDPOINTS (unchanged behaviour, kept compatible)
# ---------------------------------------------------------------------------

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
        out.append({
            "patient_id": patient_id,
            "full_name": profile.get("full_name", "Unknown"),
            "connected_at": row.get("connected_at"),
            "weekly_adherence_percentage": weekly_percentage,
        })
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
        out.append({
            "doctor_id": doctor_id,
            "full_name": profile.get("full_name", "Unknown"),
            "connected_at": row.get("connected_at"),
        })
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
        out.append({
            "reviewer_id": reviewer_id,
            "full_name": profile.get("full_name", "Unknown"),
            "connected_at": row.get("connected_at"),
        })
    return out
