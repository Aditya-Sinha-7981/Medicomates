from __future__ import annotations

import asyncio
import json
import logging
import re

import google.generativeai as genai

from config import settings

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.GEMINI_API_KEY)
_model = genai.GenerativeModel("gemini-2.5-flash")

_OCR_PROMPT = """
You are reading an Indian medical prescription. Extract all medicines listed.
For each medicine return one object in a JSON array with exactly these keys:
"name", "dosage", "frequency", "reminder_times", "notes".
reminder_times must be an array of "HH:MM" strings inferred from frequency; use sensible defaults.
notes is optional supplementary text such as timing with food.

Return only the JSON array. No explanation. No markdown code fences.
If you cannot read a field clearly, set it to JSON null.

Example shape:
[
  {
    "name": "Metformin",
    "dosage": "500mg",
    "frequency": "twice daily",
    "reminder_times": ["08:00", "21:00"],
    "notes": "take after food"
  }
]
"""


def _strip_markdown_fence(text: str) -> str:
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*```\s*$", "", t)
    return t.strip()


def _extract_prescription_data_sync(image_data: bytes, mime_type: str):
    """Blocking Gemini call — run via asyncio.to_thread from async endpoints."""
    try:
        response = _model.generate_content(
            [
                _OCR_PROMPT,
                {"mime_type": mime_type, "data": image_data},
            ]
        )
        text = getattr(response, "text", None) or ""
        data = json.loads(_strip_markdown_fence(text))
        return data
    except Exception:
        logger.exception("OCR extraction failed")
        return []


async def extract_prescription_data(image_data: bytes, mime_type: str = "image/jpeg"):
    return await asyncio.to_thread(
        _extract_prescription_data_sync, image_data, mime_type
    )
