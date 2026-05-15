"""Twilio voice calls for critical missed medication reminders."""

from __future__ import annotations

import logging
import re

from config import settings
from utils.supabase_client import supabase

logger = logging.getLogger(__name__)

CallStatus = str  # 'success' | 'no_answer' | 'failed'


def normalize_phone_e164(phone: str | None) -> str | None:
    """Strip spaces/dashes; require leading + for E.164."""
    if not phone or not isinstance(phone, str):
        return None
    cleaned = re.sub(r"[\s\-\(\)]", "", phone.strip())
    if not cleaned.startswith("+") or len(cleaned) < 8:
        return None
    return cleaned


def build_critical_message_text(patient_name: str, medicine_name: str) -> str:
    """Full bilingual text stored in call_logs.message_text."""
    hindi = (
        f"नमस्ते {patient_name}, यह आपकी दवा {medicine_name} "
        "लेने की याद दिलाने के लिए है।"
    )
    english = (
        f"Hello {patient_name}, this is a reminder to take your {medicine_name}."
    )
    return f"{hindi} | {english}"


def build_critical_twiml(patient_name: str, medicine_name: str) -> str:
    """
    Build TwiML via Twilio's VoiceResponse so XML/unicode is valid.
    Hindi (hi-IN) then English (en-IN), both Polly.Aditi.
    """
    from twilio.twiml.voice_response import VoiceResponse

    name = (patient_name or "Patient").strip()
    med = (medicine_name or "your medication").strip()

    hindi = f"नमस्ते {name}, यह आपकी दवा {med} लेने की याद दिलाने के लिए है।"
    english = f"Hello {name}, this is a reminder to take your {med}."

    response = VoiceResponse()
    response.pause(length=1)
    response.say(hindi, voice="Polly.Aditi", language="hi-IN")
    response.pause(length=1)
    response.say(english, voice="Polly.Aditi", language="en-IN")
    return str(response)


def _map_twilio_status(twilio_status: str | None) -> CallStatus:
    s = (twilio_status or "").lower()
    if s in ("completed", "in-progress", "ringing", "queued"):
        return "success"
    if s in ("no-answer", "busy"):
        return "no_answer"
    return "failed"


def log_call(
    patient_id: str,
    medicine_id: str,
    status: CallStatus,
    message_text: str,
) -> dict | None:
    try:
        row = (
            supabase.table("call_logs")
            .insert(
                {
                    "patient_id": patient_id,
                    "medicine_id": medicine_id,
                    "status": status,
                    "message_text": message_text,
                }
            )
            .execute()
        )
        return (row.data or [None])[0]
    except Exception:
        logger.exception(
            "call_logs insert failed patient_id=%s medicine_id=%s",
            patient_id,
            medicine_id,
        )
        return None


def place_critical_call(
    *,
    to_phone: str,
    patient_id: str,
    medicine_id: str,
    patient_name: str,
    medicine_name: str,
) -> dict:
    """
    Place outbound call via Twilio. Always writes call_logs (success / no_answer / failed).
  Returns dict suitable for API response.
    """
    message_text = build_critical_message_text(patient_name, medicine_name)
    provider = (settings.CALL_PROVIDER or "none").strip().lower()

    if provider != "twilio":
        log_call(patient_id, medicine_id, "failed", message_text)
        return {
            "status": "failed",
            "message": "CALL_PROVIDER is not set to twilio",
            "message_text": message_text,
            "call_sid": None,
        }

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        log_call(patient_id, medicine_id, "failed", message_text)
        return {
            "status": "failed",
            "message": "Twilio credentials missing in environment",
            "message_text": message_text,
            "call_sid": None,
        }

    from_number = normalize_phone_e164(settings.TWILIO_PHONE_NUMBER)
    to_e164 = normalize_phone_e164(to_phone)
    if not from_number or not to_e164:
        log_call(patient_id, medicine_id, "failed", message_text)
        return {
            "status": "failed",
            "message": "Invalid Twilio from/to phone (use E.164, e.g. +16814056121)",
            "message_text": message_text,
            "call_sid": None,
        }

    twiml = build_critical_twiml(patient_name, medicine_name)
    logger.info(
        "Critical call TwiML patient=%s medicine=%s twiml=%s",
        patient_id,
        medicine_id,
        twiml,
    )

    try:
        from twilio.rest import Client

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        # Inline Twiml must be used (not the number's console webhook).
        call = client.calls.create(
            to=to_e164,
            from_=from_number,
            twiml=twiml,
        )
        mapped = _map_twilio_status(getattr(call, "status", None))
        log_call(patient_id, medicine_id, mapped, message_text)
        return {
            "status": mapped,
            "message": "Critical medication call placed",
            "message_text": message_text,
            "call_sid": getattr(call, "sid", None),
            "twilio_status": getattr(call, "status", None),
        }
    except Exception as exc:
        err_msg = str(exc)
        try:
            from twilio.base.exceptions import TwilioRestException

            if isinstance(exc, TwilioRestException):
                code = getattr(exc, "code", None)
                if code == 20003:
                    err_msg = (
                        "Twilio authentication failed (error 20003). "
                        "Use Account SID (starts with AC) and the primary Auth Token from "
                        "Twilio Console → Account → API keys & tokens — not an API Key secret. "
                        "Restart the backend after updating .env."
                    )
                else:
                    err_msg = f"Twilio error {code}: {getattr(exc, 'msg', None) or exc}"
        except ImportError:
            pass

        logger.exception(
            "Twilio call failed patient_id=%s medicine_id=%s", patient_id, medicine_id
        )
        log_call(patient_id, medicine_id, "failed", message_text)
        return {
            "status": "failed",
            "message": err_msg,
            "message_text": message_text,
            "call_sid": None,
        }
