import logging
from datetime import datetime, timezone

from apscheduler.triggers.cron import CronTrigger
from postgrest.exceptions import APIError

from scheduler import scheduler
from services.email_service import send_reminder_email
from utils.supabase_client import supabase
from utils.token import generate_token

logger = logging.getLogger(__name__)


def reschedule_all_active_medicines() -> None:
    """Re-register cron jobs from DB — required after process restart (e.g. Railway)."""
    try:
        result = (
            supabase.table("medicines")
            .select("id, reminder_times")
            .eq("is_active", True)
            .execute()
        )
        medicines = result.data or []
        if not medicines:
            logger.info("Boot reschedule: no active medicines")
            return

        count = 0
        for med in medicines:
            if med.get("reminder_times"):
                schedule_medicine(med["id"], med["reminder_times"])
                count += 1
        logger.info("Boot reschedule: scheduled %s medicine(s)", count)
    except Exception:
        logger.exception("Boot reschedule failed")


def schedule_medicine(medicine_id: str, reminder_times: list) -> None:
    for time_str in reminder_times:
        try:
            hour, minute = map(int, time_str.split(":"))
            job_id = f"reminder_{medicine_id}_{hour:02d}{minute:02d}"
            scheduler.add_job(
                send_reminder_for_medicine,
                trigger=CronTrigger(hour=hour, minute=minute),
                args=[medicine_id],
                id=job_id,
                replace_existing=True,
            )
            logger.debug("Scheduled job %s at %02d:%02d", job_id, hour, minute)
        except Exception:
            logger.exception(
                "Failed to schedule reminder medicine_id=%s time=%s",
                medicine_id,
                time_str,
            )


def unschedule_medicine(medicine_id: str) -> None:
    for job in scheduler.get_jobs():
        if job.id.startswith(f"reminder_{medicine_id}_"):
            scheduler.remove_job(job.id)
            logger.debug("Removed job %s", job.id)


def reschedule_medicine(medicine_id: str, new_times: list) -> None:
    unschedule_medicine(medicine_id)
    schedule_medicine(medicine_id, new_times)


def send_reminder_for_medicine(medicine_id: str) -> None:
    med_result = (
        supabase.table("medicines")
        .select("id, patient_id, name, dosage, is_active")
        .eq("id", medicine_id)
        .execute()
    )
    if not med_result.data:
        logger.warning("Reminder skipped — medicine_id=%s not found", medicine_id)
        return
    medicine = med_result.data[0]

    if not medicine.get("is_active", True):
        logger.info("Reminder skipped — medicine_id=%s inactive", medicine_id)
        return

    patient_id = medicine["patient_id"]

    email: str | None = None
    try:
        user_response = supabase.auth.admin.get_user_by_id(patient_id)
        email = getattr(getattr(user_response, "user", None), "email", None) or None
    except Exception as exc:
        logger.warning(
            "Auth admin get_user_by_id failed for patient_id=%s (%s). Trying profiles.email fallback. "
            "If you use the new Supabase 'sb_secret_…' API key, switch to Legacy service_role JWT (eyJ…) "
            "or upgrade supabase-py — see backend/requirements.txt comment.",
            patient_id,
            exc,
        )

    if not email:
        try:
            prof = (
                supabase.table("profiles")
                .select("email")
                .eq("id", patient_id)
                .limit(1)
                .execute()
            )
            rows = prof.data or []
            raw = rows[0].get("email") if rows else None
            if isinstance(raw, str) and raw.strip():
                email = raw.strip()
        except APIError as exc:
            if exc.code == "42703" or (
                exc.message and "email" in exc.message and "does not exist" in exc.message
            ):
                logger.error(
                    "Reminder skipped — column public.profiles.email is missing. "
                    "Run docs/sql/add_profile_email.sql in the Supabase SQL editor, then "
                    "re-login once (or set email on that profile). patient_id=%s",
                    patient_id,
                )
            else:
                logger.exception(
                    "Reminder skipped — profiles.email lookup failed patient_id=%s",
                    patient_id,
                )
            return
        except Exception:
            logger.exception(
                "Reminder skipped — profiles.email lookup failed patient_id=%s",
                patient_id,
            )
            return

    if not email:
        logger.error(
            "Reminder skipped — no email. Fix SUPABASE_SERVICE_KEY (service_role), "
            "and/or add profiles.email (see docs/sql/add_profile_email.sql) and re-login. patient_id=%s",
            patient_id,
        )
        return

    token = generate_token()

    try:
        supabase.table("adherence_logs").insert(
            {
                "medicine_id": medicine_id,
                "patient_id": patient_id,
                "scheduled_time": datetime.now(timezone.utc).isoformat(),
                "token": token,
                "token_used": False,
                "confirmed_at": None,
            }
        ).execute()
    except Exception:
        logger.exception(
            "Reminder failed — adherence_logs insert medicine_id=%s", medicine_id
        )
        return

    send_reminder_email(
        to=email,
        medicine_name=medicine["name"],
        dosage=medicine["dosage"],
        token=token,
    )
