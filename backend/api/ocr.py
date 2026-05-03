from fastapi import APIRouter, File, UploadFile

router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.post("")
async def extract_ocr(image: UploadFile = File(...)):
    _ = image
    return []
