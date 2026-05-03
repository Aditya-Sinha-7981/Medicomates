from fastapi import APIRouter

from models.schemas import NoteSchema
from utils.supabase_client import supabase
from utils.visits import log_visit

router = APIRouter(prefix="/notes", tags=["notes"])


@router.post("")
async def send_note(data: NoteSchema):
    created = (
        supabase.table("notes")
        .insert(
            {
                "patient_id": data.patient_id,
                "doctor_id": data.doctor_id,
                "sender_role": "patient",
                "message": data.message,
            }
        )
        .execute()
    )
    note = (created.data or [{}])[0]
    log_visit(
        data.patient_id,
        data.doctor_id,
        "note_added",
        f"Note: {data.message[:80]}",
    )
    return {"message": "Note sent", "id": note.get("id")}


@router.get("/{patient_id}/{doctor_id}")
async def get_notes(patient_id: str, doctor_id: str):
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
async def mark_notes_read(patient_id: str, doctor_id: str):
    supabase.table("notes").update({"is_read": True}).eq("patient_id", patient_id).eq(
        "doctor_id", doctor_id
    ).execute()
    return {"message": "Marked as read"}
