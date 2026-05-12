import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from services.cloudinary_documents import destroy, upload_bytes
from services.document_service import default_title_from_filename, prepare_file_for_upload
from utils.auth import get_current_user
from utils.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


def _run(q):
    """Execute a PostgREST builder; map RLS failures to a clear client error."""
    try:
        return q.execute()
    except APIError as exc:
        if exc.code == "42501":
            logger.warning("PostgREST RLS blocked request: %s", exc.message)
            raise HTTPException(
                status_code=503,
                detail=(
                    "Database blocked this operation (row-level security). "
                    "Set SUPABASE_SERVICE_KEY in backend/.env to the Supabase **service_role** "
                    "JWT (Dashboard → Project Settings → API), not the anon key. "
                    "If the key is already service_role, adjust or disable RLS on the affected table "
                    "for server-side access (e.g. ALTER TABLE public.medical_documents "
                    "DISABLE ROW LEVEL SECURITY; when only this API touches the table)."
                ),
            ) from exc
        raise HTTPException(status_code=500, detail=exc.message or "Database error.") from exc


def _patient_doctor_linked(patient_id: str, doctor_id: str) -> bool:
    r = _run(
        supabase.table("patient_doctor_connections")
        .select("id")
        .eq("patient_id", patient_id)
        .eq("doctor_id", doctor_id)
        .eq("is_active", True)
        .limit(1)
    )
    return bool(r.data)


class DocumentPatchSchema(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str | None = None


def _row_to_out(row: dict) -> dict:
    return {
        "id": row["id"],
        "owner_profile_id": row["owner_profile_id"],
        "uploaded_by": row["uploaded_by"],
        "cloudinary_public_id": row["cloudinary_public_id"],
        "secure_url": row["secure_url"],
        "original_filename": row["original_filename"],
        "mime_type": row["mime_type"],
        "size_bytes": row["size_bytes"],
        "resource_type": row["resource_type"],
        "title": row["title"],
        "notes": row.get("notes"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _fetch_doc(doc_id: str) -> dict | None:
    r = _run(supabase.table("medical_documents").select("*").eq("id", doc_id).single())
    return r.data


def _can_patch_or_delete(user: dict, row: dict) -> bool:
    uid = user["id"]
    role = user.get("role")
    owner = row["owner_profile_id"]
    if owner == uid:
        return True
    if role == "doctor" and _patient_doctor_linked(owner, uid):
        return True
    return False


@router.post("/upload")
async def upload_document(
    current_user: dict = Depends(get_current_user),
    file: UploadFile = File(...),
    patient_id: str | None = Form(None),
):
    """
    Patient uploads for self (no patient_id). Doctor may pass patient_id for a connected patient.
    Doctor uploads for self: omit patient_id.
    """
    uid = current_user["id"]
    role = current_user.get("role")

    owner_profile_id = uid
    if patient_id:
        if role != "doctor":
            raise HTTPException(status_code=403, detail="Only doctors can upload to a patient chart.")
        if patient_id == uid:
            raise HTTPException(status_code=400, detail="Use default upload without patient_id for your own files.")
        if not _patient_doctor_linked(patient_id, uid):
            raise HTTPException(status_code=403, detail="You are not connected to this patient as a doctor.")
        owner_profile_id = patient_id

    raw = await file.read()
    mime_in = file.content_type
    filename = file.filename or "upload"

    try:
        data, mime_out, resource_type = prepare_file_for_upload(raw, mime_in, filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        up = upload_bytes(data, mime_out, resource_type, owner_profile_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Cloudinary upload failed")
        raise HTTPException(status_code=502, detail="Upload to storage failed.") from exc

    title = default_title_from_filename(filename)
    insert = {
        "owner_profile_id": owner_profile_id,
        "uploaded_by": uid,
        "cloudinary_public_id": up["public_id"],
        "secure_url": up["secure_url"],
        "original_filename": filename[:500],
        "mime_type": mime_out,
        "size_bytes": up.get("bytes") or len(data),
        "resource_type": resource_type,
        "title": title,
        "notes": None,
    }
    created = _run(supabase.table("medical_documents").insert(insert))
    row = (created.data or [None])[0]
    if not row:
        raise HTTPException(status_code=500, detail="Failed to save document metadata.")
    return _row_to_out(row)


@router.get("/me")
async def list_my_documents(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    r = _run(
        supabase.table("medical_documents")
        .select("*")
        .eq("owner_profile_id", uid)
        .order("created_at", desc=True)
    )
    return [_row_to_out(x) for x in (r.data or [])]


@router.get("/patient/{patient_id}")
async def list_patient_documents(patient_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can list patient medical documents.")
    if not _patient_doctor_linked(patient_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="You are not connected to this patient as a doctor.")
    r = _run(
        supabase.table("medical_documents")
        .select("*")
        .eq("owner_profile_id", patient_id)
        .order("created_at", desc=True)
    )
    return [_row_to_out(x) for x in (r.data or [])]


@router.patch("/{document_id}")
async def update_document(
    document_id: str,
    body: DocumentPatchSchema,
    current_user: dict = Depends(get_current_user),
):
    row = _fetch_doc(document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found.")
    if not _can_patch_or_delete(current_user, row):
        raise HTTPException(status_code=403, detail="Not allowed to edit this document.")

    _run(
        supabase.table("medical_documents")
        .update(
            {
                "title": body.title.strip(),
                "notes": (body.notes.strip() if body.notes else None),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", document_id)
    )
    updated = _fetch_doc(document_id)
    return _row_to_out(updated or row)


@router.delete("/{document_id}")
async def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    row = _fetch_doc(document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found.")
    if not _can_patch_or_delete(current_user, row):
        raise HTTPException(status_code=403, detail="Not allowed to delete this document.")

    destroy(row["cloudinary_public_id"], row.get("resource_type") or "image")
    _run(supabase.table("medical_documents").delete().eq("id", document_id))
    return {"message": "Document deleted."}
