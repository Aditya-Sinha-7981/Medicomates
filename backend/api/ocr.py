from fastapi import APIRouter, File, HTTPException, UploadFile

from services.gemini_service import extract_prescription_data

router = APIRouter(prefix="/ocr", tags=["ocr"])

_MAX_BYTES = 10 * 1024 * 1024


def _mime_for_upload(upload: UploadFile) -> str:
    if upload.content_type:
        return upload.content_type.split(";")[0].strip().lower()
    name = (upload.filename or "").lower()
    if name.endswith(".png"):
        return "image/png"
    if name.endswith(".webp"):
        return "image/webp"
    if name.endswith(".pdf"):
        return "application/pdf"
    return "image/jpeg"


@router.post("")
async def extract_ocr(image: UploadFile = File(...)):
    raw = await image.read()
    if len(raw) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image must be at most 10MB")
    mime = _mime_for_upload(image)
    if mime == "application/pdf":
        raise HTTPException(
            status_code=415,
            detail=(
                "PDF uploads are not supported yet in this backend build; "
                "export the prescription page as JPG or PNG and retry."
            ),
        )
    if not mime.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type — use JPG or PNG.",
        )

    meds = await extract_prescription_data(raw, mime_type=mime)
    if isinstance(medics, dict):
        meds = [medics]
    if not isinstance(medics, list):
        return []

    allowed = {"name", "dosage", "frequency", "reminder_times", "notes"}
    out = []
    for item in meds:
        if not isinstance(item, dict):
            continue
        row = {}
        for k in allowed:
            v = item.get(k)
            if k == "reminder_times" and v is not None and not isinstance(v, list):
                v = None
            row[k] = v
        out.append(row)
    return out
