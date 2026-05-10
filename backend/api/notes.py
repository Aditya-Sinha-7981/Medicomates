from fastapi import APIRouter, Depends, HTTPException

from models.schemas import NoteSchema
from utils.auth import get_current_user
from utils.supabase_client import supabase
from utils.visits import log_visit

router = APIRouter(prefix="/notes", tags=["notes"])


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
            }
        )
        .execute()
    )
    note = (created.data or [{}])[0]
    # Visit timeline should reflect clinically meaningful events; keep it focused on doctor actions.
    # Notes remain visible in the notes thread regardless of whether a visit row is created.
    if sender_role == "doctor":
        log_visit(
            data.patient_id,
            data.doctor_id,
            "note_added",
            f"Doctor sent a note: {data.message[:80]}",
        )
    return {"message": "Note sent", "id": note.get("id")}


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
    patient_id: str, doctor_id: str, current_user: dict = Depends(get_current_user)
):
    supabase.table("notes").update({"is_read": True}).eq("patient_id", patient_id).eq(
        "doctor_id", doctor_id
    ).execute()
    return {"message": "Marked as read"}
