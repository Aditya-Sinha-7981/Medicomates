from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
import google.generativeai as genai

from config import settings
from utils.supabase_client import supabase

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.GEMINI_API_KEY)
_model = genai.GenerativeModel("gemini-2.5-flash")


def _parse_scheduled(ts: str) -> datetime:
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    return datetime.fromisoformat(ts)


def build_adherence_summary(logs: list) -> str:
    meds: dict[str, dict[str, dict[str, int]]] = {}
    for log in logs:
        med = log.get("medicines") or {}
        med_id = log.get("medicine_id")
        if not med_id and not med:
            continue
        med_key = f"{med.get('name') or 'Unknown'} {med.get('dosage') or ''}".strip()

        try:
            time_str = _parse_scheduled(log["scheduled_time"]).strftime("%H:%M")
        except (KeyError, TypeError, ValueError):
            continue

        meds.setdefault(med_key, {})
        meds[med_key].setdefault(time_str, {"taken": 0, "total": 0})

        meds[med_key][time_str]["total"] += 1
        if log.get("confirmed_at") is not None:
            meds[med_key][time_str]["taken"] += 1

    summary_lines: list[str] = []
    for med_key, times in meds.items():
        summary_lines.append(f"{med_key}:")
        for time_str in sorted(times):
            stats = times[time_str]
            taken = stats["taken"]
            total = stats["total"]
            pct = int((taken / total) * 100) if total > 0 else 0
            summary_lines.append(f"  - {time_str}: {taken}/{total} taken ({pct}%)")
        summary_lines.append("")

    return "\n".join(summary_lines)


def _generate_insight_text_sync(summary: str) -> str:
    """
    Priority order:
    1) Ollama (local) — avoids Gemini rate limits
    2) Gemini — fallback if local inference fails/unavailable
    """
    try:
        if settings.OLLAMA_INSIGHT_MODEL:
            text = _generate_insight_text_ollama_sync(summary)
            if text:
                return text
    except Exception:
        logger.exception("Local (Ollama) insight generation failed; falling back to Gemini.")

    return _generate_insight_text_gemini_sync(summary)


def _normalize_insight_text(text: str) -> str:
    """
    Try to keep output as a short, readable paragraph.
    (We still enforce the prompt, but models sometimes add prefixes/bullets.)
    """
    t = (text or "").strip()
    if not t:
        return ""

    # Strip common prefixes and collapse whitespace for nicer UI rendering.
    t = re.sub(r"^(\s*insight\s*[:\-])\s*", "", t, flags=re.IGNORECASE)
    t = "\n".join([line for line in t.splitlines() if not line.strip().startswith(("-", "*"))]).strip()
    t = re.sub(r"\s+", " ", t).strip()

    # Truncate to at most 4 sentences to match the contract expectations.
    sentences = re.split(r"(?<=[.!?])\s+", t)
    if len(sentences) > 4:
        t = " ".join(sentences[:4]).strip()
    return t


def _build_insight_prompt(summary: str) -> str:
    return f"""
You are a clinical assistant helping a doctor understand a patient's medication adherence.
Based on the following 30-day adherence data, write a brief 3-4 sentence insight summary.
Focus on: overall adherence rate, any time-of-day patterns in missed doses, and one actionable suggestion.
Do NOT give medical advice. Do NOT suggest starting or stopping medicines.
If you recommend an action, phrase it as a suggestion to the clinician about reminder scheduling/behavior, not a treatment change.
Write in plain English. Be concise.

Adherence data:
{summary}
"""

def _generate_insight_text_ollama_sync(summary: str) -> str:
    prompt = _build_insight_prompt(summary)

    base_url = (settings.OLLAMA_BASE_URL or "").rstrip("/")
    model = settings.OLLAMA_INSIGHT_MODEL
    if not base_url or not model:
        return ""

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": settings.OLLAMA_TEMPERATURE,
            "num_predict": settings.OLLAMA_NUM_PREDICT,
        },
    }

    try:
        with httpx.Client(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
            resp = client.post(f"{base_url}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()

        text = data.get("response") or ""
        normalized = _normalize_insight_text(text)
        if normalized:
            logger.info("Insight generation succeeded via Ollama (%s).", model)
        return normalized
    except Exception as exc:
        logger.warning("Ollama insight generation failed: %s", exc)
        return ""


def _generate_insight_text_gemini_sync(summary: str) -> str:
    prompt = _build_insight_prompt(summary)
    try:
        response = _model.generate_content(prompt)
        text = getattr(response, "text", None) or ""
        return _normalize_insight_text(text)
    except Exception:
        logger.exception("Insight generation failed (Gemini).")
        return "Insight generation temporarily unavailable."


async def generate_insight(patient_id: str) -> str:
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    thirty_days_ago_iso = thirty_days_ago.isoformat()

    result = (
        supabase.table("adherence_logs")
        .select("*, medicines(name, dosage, reminder_times)")
        .eq("patient_id", patient_id)
        .gte("scheduled_time", thirty_days_ago_iso)
        .execute()
    )

    logs = result.data or []
    if not logs:
        return "No adherence data available for the last 30 days."

    summary = build_adherence_summary(logs)
    return await asyncio.to_thread(_generate_insight_text_sync, summary)
