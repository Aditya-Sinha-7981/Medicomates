import logging

from utils.supabase_client import supabase

logger = logging.getLogger(__name__)


def log_visit(patient_id: str, doctor_id: str, action_type: str, summary: str) -> None:
    try:
        supabase.table("visits").insert(
            {
                "patient_id": patient_id,
                "doctor_id": doctor_id,
                "action_type": action_type,
                "summary": summary,
            }
        ).execute()
    except Exception:
        logger.exception(
            "log_visit insert failed patient_id=%s action_type=%s",
            patient_id,
            action_type,
        )
