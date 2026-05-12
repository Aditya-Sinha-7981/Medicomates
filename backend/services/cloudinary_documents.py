"""
Cloudinary upload/destroy for medical documents.
"""

from __future__ import annotations

import io
import logging
import uuid

import cloudinary
import cloudinary.uploader

from config import settings

logger = logging.getLogger(__name__)

_configured = False


def _ensure_config() -> None:
    global _configured
    if _configured:
        return
    if not settings.CLOUDINARY_CLOUD_NAME or not settings.CLOUDINARY_API_KEY:
        raise RuntimeError("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.")
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )
    _configured = True


def upload_bytes(
    data: bytes,
    mime: str,
    resource_type: str,
    folder_owner_id: str,
) -> dict:
    """Upload to Cloudinary. Returns dict with public_id, secure_url, bytes."""
    _ensure_config()
    folder = f"medicomates/{folder_owner_id}"
    public_id = uuid.uuid4().hex
    file_obj = io.BytesIO(data)
    result = cloudinary.uploader.upload(
        file_obj,
        folder=folder,
        public_id=public_id,
        resource_type=resource_type,
        overwrite=False,
    )
    return {
        "public_id": result.get("public_id") or f"{folder}/{public_id}",
        "secure_url": result.get("secure_url") or "",
        "bytes": result.get("bytes") or len(data),
    }


def destroy(public_id: str, resource_type: str) -> None:
    _ensure_config()
    try:
        cloudinary.uploader.destroy(public_id, resource_type=resource_type)
    except Exception as exc:
        logger.warning("Cloudinary destroy failed for %s: %s", public_id, exc)
