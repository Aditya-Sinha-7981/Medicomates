"""
Compress images with Pillow before Cloudinary upload. PDFs pass through unchanged.
"""
from __future__ import annotations

import io
import logging
import re
from pathlib import Path

from PIL import Image

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
ALLOWED_MIMES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}


def default_title_from_filename(filename: str) -> str:
    base = Path(filename or "").name.strip() or "Document"
    base = re.sub(r"\.[^.]+$", "", base).strip() or "Document"
    return base[:200]


def prepare_file_for_upload(
    raw: bytes, content_type: str | None, filename: str
) -> tuple[bytes, str, str]:
    """
    Returns (bytes_to_upload, mime_for_cloudinary, resource_type 'image'|'raw').
    Raises ValueError on invalid type/size.
    """
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ValueError("File exceeds 20MB limit.")

    mime = (content_type or "").split(";")[0].strip().lower()
    if mime not in ALLOWED_MIMES:
        raise ValueError("Only PDF, JPEG, PNG, and WebP are allowed.")

    if mime == "application/pdf":
        return raw, "application/pdf", "raw"

    try:
        img = Image.open(io.BytesIO(raw))
        img = img.convert("RGB")
        max_edge = 2048
        w, h = img.size
        if max(w, h) > max_edge:
            ratio = max_edge / float(max(w, h))
            img = img.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=82, optimize=True)
        out = buf.getvalue()
        if len(out) > MAX_UPLOAD_BYTES:
            raise ValueError("Compressed image still exceeds 20MB; try a smaller original.")
        return out, "image/jpeg", "image"
    except ValueError:
        raise
    except Exception as exc:
        logger.exception("Image compression failed")
        raise ValueError("Could not process image file.") from exc
