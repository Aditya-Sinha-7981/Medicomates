"""Emergency SOS orchestration: email + call connected reviewers and doctors."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from services.call_service import (
    build_sos_doctor_message_text,
    build_sos_doctor_twiml,
    normalize_phone_e164,
    place_voice_call,
)
from services.email_service import send_sos_alert_email
from utils.supabase_client import supabase
from utils.user_email import resolve_user_email

logger = logging.getLogger(__name__)


def _send_sos_email(user_id: str, role_label: str, patient_name: str, triggered_at_display: str) -> str:
    """Returns 'sent' | 'skipped' | 'failed'."""
    email = resolve_user_email(user_id)
    if not email:
        logger.warning(
            "SOS email skipped — no email for %s user_id=%s",
            role_label,
            user_id,
        )
        return "skipped"
    logger.info("SOS sending email to %s (%s) at %s", role_label, user_id, email)
    if send_sos_alert_email(email, patient_name, triggered_at_display):
        return "sent"
    return "failed"


def _load_patient_profile(patient_id: str) -> dict | None:
    result = (
        supabase.table("profiles")
        .select("id, full_name")
        .eq("id", patient_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def _first_active_medicine_id(patient_id: str) -> str | None:
    result = (
        supabase.table("medicines")
        .select("id")
        .eq("patient_id", patient_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0]["id"] if rows else None


def _notify_reviewers(patient_id: str, patient_name: str, triggered_at_display: str) -> dict:
    links = (
        supabase.table("patient_reviewer_connections")
        .select("reviewer_id")
        .eq("patient_id", patient_id)
        .execute()
    )
    rows = links.data or []
    if not rows:
        logger.info("SOS reviewers: none connected for patient_id=%s", patient_id)

    notified = 0
    skipped = 0
    failed = 0

    for row in rows:
        reviewer_id = row.get("reviewer_id")
        if not reviewer_id:
            continue
        outcome = _send_sos_email(
            str(reviewer_id), "reviewer", patient_name, triggered_at_display
        )
        if outcome == "sent":
            notified += 1
        elif outcome == "skipped":
            skipped += 1
        else:
            failed += 1

    logger.info(
        "SOS reviewers done patient_id=%s notified=%s skipped=%s failed=%s",
        patient_id,
        notified,
        skipped,
        failed,
    )
    return {"notified": notified, "skipped": skipped, "failed": failed}


def _notify_doctors(
    patient_id: str,
    patient_name: str,
    triggered_at_display: str,
    medicine_id: str | None,
) -> dict:
    links = (
        supabase.table("patient_doctor_connections")
        .select("doctor_id")
        .eq("patient_id", patient_id)
        .eq("is_active", True)
        .execute()
    )
    rows = links.data or []
    if not rows:
        logger.info("SOS doctors: none connected for patient_id=%s", patient_id)

    emailed = 0
    email_skipped = 0
    email_failed = 0
    called = 0
    skipped_no_phone = 0
    call_failed = 0

    message_text = build_sos_doctor_message_text(patient_name)
    twiml = build_sos_doctor_twiml(patient_name)

    for row in rows:
        doctor_id = row.get("doctor_id")
        if not doctor_id:
            continue
        doctor_id_str = str(doctor_id)

        email_outcome = _send_sos_email(
            doctor_id_str, "doctor", patient_name, triggered_at_display
        )
        if email_outcome == "sent":
            emailed += 1
        elif email_outcome == "skipped":
            email_skipped += 1
        else:
            email_failed += 1

        profile_res = (
            supabase.table("profiles")
            .select("phone, full_name")
            .eq("id", doctor_id)
            .limit(1)
            .execute()
        )
        profile_rows = profile_res.data or []
        if not profile_rows:
            logger.warning("SOS call skipped — doctor profile missing doctor_id=%s", doctor_id)
            skipped_no_phone += 1
            continue

        phone = profile_rows[0].get("phone")
        if not phone or not normalize_phone_e164(phone):
            logger.warning(
                "SOS call skipped — doctor phone missing/invalid doctor_id=%s phone=%r",
                doctor_id,
                phone,
            )
            skipped_no_phone += 1
            continue

        logger.info("SOS placing voice call to doctor_id=%s", doctor_id)
        outcome = place_voice_call(
            to_phone=phone,
            patient_id=patient_id,
            medicine_id=medicine_id,
            message_text=message_text,
            twiml=twiml,
            success_message="Emergency SOS call placed to doctor",
            log_label="SOS",
        )
        status = outcome.get("status")
        if status in ("success", "no_answer"):
            called += 1
        else:
            call_failed += 1
            logger.warning(
                "SOS doctor call failed doctor_id=%s status=%s message=%s",
                doctor_id,
                status,
                outcome.get("message"),
            )

    logger.info(
        "SOS doctors done patient_id=%s emailed=%s call=%s email_skipped=%s call_skipped_phone=%s",
        patient_id,
        emailed,
        called,
        email_skipped,
        skipped_no_phone,
    )
    return {
        "emailed": emailed,
        "email_skipped": email_skipped,
        "email_failed": email_failed,
        "called": called,
        "skipped_no_phone": skipped_no_phone,
        "call_failed": call_failed,
    }


def trigger_patient_sos(patient_id: str) -> dict:
    profile = _load_patient_profile(patient_id)
    if not profile:
        raise ValueError("Patient profile not found")

    patient_name = (profile.get("full_name") or "Patient").strip()
    triggered_at = datetime.now(timezone.utc)
    triggered_at_iso = triggered_at.isoformat()
    triggered_at_display = triggered_at.strftime("%Y-%m-%d %H:%M UTC")

    medicine_id = _first_active_medicine_id(patient_id)
    if not medicine_id:
        logger.warning(
            "SOS for patient_id=%s has no active medicine; call_logs will not be written",
            patient_id,
        )

    reviewers = _notify_reviewers(patient_id, patient_name, triggered_at_display)
    doctors = _notify_doctors(
        patient_id, patient_name, triggered_at_display, medicine_id
    )

    return {
        "status": "ok",
        "patient_name": patient_name,
        "triggered_at": triggered_at_iso,
        "reviewers": reviewers,
        "doctors": doctors,
    }
