"""Orchestration for critical-medication voice calls (manual + scheduled miss check)."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.triggers.date import DateTrigger

from scheduler import scheduler
from services.call_service import (
    build_critical_message_text,
    log_call,
    normalize_phone_e164,
    place_critical_call,
)
from utils.supabase_client import supabase

logger = logging.getLogger(__name__)

CRITICAL_MISS_GRACE_MINUTES = 1


def _load_medicine(patient_id: str, medicine_id: str) -> dict | None:
    result = (
        supabase.table("medicines")
        .select("id, patient_id, name, is_active, is_critical")
        .eq("id", medicine_id)
        .eq("patient_id", patient_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def _load_patient_profile(patient_id: str) -> dict | None:
    result = (
        supabase.table("profiles")
        .select("id, full_name, phone")
        .eq("id", patient_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def _already_called_since(patient_id: str, medicine_id: str, since_iso: str) -> bool:
    result = (
        supabase.table("call_logs")
        .select("id")
        .eq("patient_id", patient_id)
        .eq("medicine_id", medicine_id)
        .gte("called_at", since_iso)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def trigger_critical_call(
    patient_id: str,
    medicine_id: str,
    *,
    skip_dedup: bool = False,
    adherence_log_id: str | None = None,
) -> dict:
    """
    Place a critical-medication voice call for patient_id + medicine_id.
    Used by Swagger demo endpoint (skip_dedup=True) and scheduled miss check.
    """
    medicine = _load_medicine(patient_id, medicine_id)
    if not medicine:
        raise ValueError("Medicine not found for this patient")
    if not medicine.get("is_active", True):
        raise ValueError("Medicine is not active")
    if not medicine.get("is_critical"):
        raise ValueError("Medicine is not marked as critical")

    profile = _load_patient_profile(patient_id)
    if not profile:
        raise ValueError("Patient profile not found")

    patient_name = (profile.get("full_name") or "Patient").strip()
    medicine_name = (medicine.get("name") or "your medication").strip()
    phone = profile.get("phone")

    if not skip_dedup and adherence_log_id:
        log_row = (
            supabase.table("adherence_logs")
            .select("scheduled_time")
            .eq("id", adherence_log_id)
            .limit(1)
            .execute()
        )
        logs = log_row.data or []
        since = logs[0].get("scheduled_time") if logs else None
        if since and _already_called_since(patient_id, medicine_id, since):
            return {
                "status": "skipped",
                "message": "Call already logged for this reminder window",
                "message_text": None,
                "call_sid": None,
            }

    if not phone or not normalize_phone_e164(phone):
        message_text = build_critical_message_text(patient_name, medicine_name)
        log_call(patient_id, medicine_id, "failed", message_text)
        return {
            "status": "failed",
            "message": "Patient phone missing or invalid in profiles.phone (use E.164, e.g. +919876543210)",
            "message_text": message_text,
            "call_sid": None,
        }

    return place_critical_call(
        to_phone=phone,
        patient_id=patient_id,
        medicine_id=medicine_id,
        patient_name=patient_name,
        medicine_name=medicine_name,
    )


def schedule_critical_miss_check(adherence_log_id: str) -> None:
    """One-shot job 30 minutes after a critical medicine reminder email."""
    if not scheduler.running:
        logger.warning(
            "Scheduler not running; cannot schedule critical miss check log_id=%s",
            adherence_log_id,
        )
        return

    run_at = datetime.now(timezone.utc) + timedelta(minutes=CRITICAL_MISS_GRACE_MINUTES)
    job_id = f"critical_miss_{adherence_log_id}"
    try:
        scheduler.add_job(
            check_critical_miss,
            trigger=DateTrigger(run_date=run_at),
            args=[adherence_log_id],
            id=job_id,
            replace_existing=True,
        )
        logger.info(
            "Scheduled critical miss check %s at %s",
            job_id,
            run_at.isoformat(),
        )
    except Exception:
        logger.exception("Failed to schedule critical miss check log_id=%s", adherence_log_id)


def check_critical_miss(adherence_log_id: str) -> None:
    """If dose still unconfirmed after grace period, place critical call."""
    try:
        result = (
            supabase.table("adherence_logs")
            .select("id, patient_id, medicine_id, confirmed_at")
            .eq("id", adherence_log_id)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            logger.warning("Critical miss check — log not found id=%s", adherence_log_id)
            return

        log = rows[0]
        if log.get("confirmed_at"):
            logger.info(
                "Critical miss check skipped — already confirmed log_id=%s",
                adherence_log_id,
            )
            return

        patient_id = log["patient_id"]
        medicine_id = log["medicine_id"]
        outcome = trigger_critical_call(
            patient_id,
            medicine_id,
            skip_dedup=False,
            adherence_log_id=adherence_log_id,
        )
        logger.info(
            "Critical miss check log_id=%s outcome=%s",
            adherence_log_id,
            outcome.get("status"),
        )
    except Exception:
        logger.exception(
            "Critical miss check failed log_id=%s", adherence_log_id
        )
