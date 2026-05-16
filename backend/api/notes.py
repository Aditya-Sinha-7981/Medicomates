import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from models.schemas import NoteSchema
from services.email_service import send_urgent_note_email
from utils.auth import get_current_user
from utils.supabase_client import supabase
from utils.user_email import resolve_user_email
from utils.visits import log_visit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notes", tags=["notes"])


def _load_profile_name(user_id: str) -> str:
    result = (
        supabase.table("profiles")
        .select("full_name")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if rows:
        return (rows[0].get("full_name") or "Care team").strip()
    return "Care team"


def _notify_urgent_note_recipient(
    *,
    recipient_id: str,
    sender_name: str,
    message: str,
) -> None:
    email = resolve_user_email(recipient_id)
    if not email:
        logger.warning("Urgent note email skipped — no email for user_id=%s", recipient_id)
        return
    triggered_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    send_urgent_note_email(
        email,
        sender_name,
        message[:120],
        triggered_at,
    )


def _enrich_inbox_rows(rows: list[dict], name_key: str, profile_id_key: str) -> list[dict]:
    if not rows:
        return []
    profile_ids = list({r[profile_id_key] for r in rows if r.get(profile_id_key)})
    names_by_id: dict[str, str] = {}
    if profile_ids:
        prof = (
            supabase.table("profiles")
            .select("id, full_name")
            .in_("id", profile_ids)
            .execute()
        )
        for p in prof.data or []:
            names_by_id[p["id"]] = (p.get("full_name") or "Care team").strip()
    enriched = []
    for row in rows:
        item = dict(row)
        item[name_key] = names_by_id.get(row.get(profile_id_key), "Care team")
        enriched.append(item)
    return enriched


@router.post("")
async def send_note(data: NoteSchema, current_user: dict = Depends(get_current_user)):
    sender_role = current_user.get("role")
    if sender_role not in {"patient", "doctor"}:
        raise HTTPException(status_code=403, detail="Only patient or doctor can send notes")

    created = (
        supabase.table("notes")
        .insert(
            {
                "patient_id": data.patient_id,
                "doctor_id": data.doctor_id,
                "sender_role": sender_role,
                "message": data.message,
                "is_urgent": data.is_urgent,
            }
        )
        .execute()
    )
    note = (created.data or [{}])[0]

    if data.is_urgent:
        sender_name = _load_profile_name(current_user["id"])
        recipient_id = data.doctor_id if sender_role == "patient" else data.patient_id
        try:
            _notify_urgent_note_recipient(
                recipient_id=recipient_id,
                sender_name=sender_name,
                message=data.message,
            )
        except Exception:
            logger.exception("Urgent note email failed; note was still saved")

    if sender_role == "doctor":
        summary = f"Doctor sent a note: {data.message[:80]}"
        if data.is_urgent:
            summary = f"Doctor sent an urgent note: {data.message[:80]}"
        log_visit(data.patient_id, data.doctor_id, "note_added", summary)

    return {"message": "Note sent", "id": note.get("id")}


@router.get("/urgent/doctor/{doctor_id}")
async def get_urgent_inbox_for_doctor(
    doctor_id: str, current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can access this inbox")
    if current_user.get("id") != doctor_id:
        raise HTTPException(status_code=403, detail="You can only access your own inbox")

    result = (
        supabase.table("notes")
        .select("id, patient_id, doctor_id, message, created_at")
        .eq("doctor_id", doctor_id)
        .eq("is_urgent", True)
        .eq("is_read", False)
        .eq("sender_role", "patient")
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    return _enrich_inbox_rows(result.data or [], "patient_name", "patient_id")


@router.get("/urgent/patient/{patient_id}")
async def get_urgent_inbox_for_patient(
    patient_id: str, current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Only patients can access this inbox")
    if current_user.get("id") != patient_id:
        raise HTTPException(status_code=403, detail="You can only access your own inbox")

    result = (
        supabase.table("notes")
        .select("id, patient_id, doctor_id, message, created_at")
        .eq("patient_id", patient_id)
        .eq("is_urgent", True)
        .eq("is_read", False)
        .eq("sender_role", "doctor")
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    return _enrich_inbox_rows(result.data or [], "doctor_name", "doctor_id")


@router.get("/{patient_id}/{doctor_id}")
async def get_notes(
    patient_id: str, doctor_id: str, current_user: dict = Depends(get_current_user)
):
    result = (
        supabase.table("notes")
        .select("*")
        .eq("patient_id", patient_id)
        .eq("doctor_id", doctor_id)
        .order("created_at")
        .execute()
    )
    return result.data or []


@router.put("/read/{patient_id}/{doctor_id}")
async def mark_notes_read(
    patient_id: str,
    doctor_id: str,
    scope: str | None = Query(
        default=None,
        description="normal | urgent — if omitted, marks all incoming messages",
    ),
    current_user: dict = Depends(get_current_user),
):
    role = current_user.get("role")
    if role not in {"patient", "doctor"}:
        raise HTTPException(status_code=403, detail="Only patient or doctor can mark notes read")

    incoming_sender = "doctor" if role == "patient" else "patient"

    query = (
        supabase.table("notes")
        .update({"is_read": True})
        .eq("patient_id", patient_id)
        .eq("doctor_id", doctor_id)
        .eq("sender_role", incoming_sender)
    )

    if scope == "normal":
        query = query.eq("is_urgent", False)
    elif scope == "urgent":
        query = query.eq("is_urgent", True)
    elif scope is not None:
        raise HTTPException(status_code=400, detail="scope must be 'normal' or 'urgent'")

    query.execute()
    return {"message": "Marked as read"}
