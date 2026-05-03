import logging
from datetime import datetime, timezone

from apscheduler.triggers.cron import CronTrigger

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
            .select("*")
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
        supabase.table("medicines").select("*").eq("id", medicine_id).execute()
    )
    if not med_result.data:
        logger.warning("Reminder skipped — medicine_id=%s not found", medicine_id)
        return
    medicine = med_result.data[0]

    if not medicine.get("is_active", True):
        logger.info("Reminder skipped — medicine_id=%s inactive", medicine_id)
        return

    patient_id = medicine["patient_id"]

    try:
        user_response = supabase.auth.admin.get_user_by_id(patient_id)
        email = user_response.user.email
    except Exception:
        logger.exception(
            "Reminder skipped — could not fetch email patient_id=%s", patient_id
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
