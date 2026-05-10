from fastapi import APIRouter, Depends, HTTPException

from services.scheduler_service import send_reminder_for_medicine
from utils.auth import get_current_user

router = APIRouter(prefix="/testing", tags=["testing"])


@router.post("/send_reminder/{medicine_id}")
async def send_test_reminder(
    medicine_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Demo helper: trigger a reminder email + adherence_logs insert immediately
    for an existing medicine_id.

    This is intentionally protected (requires a valid JWT). Recommend using a
    doctor account in Swagger for demo/testing.
    """
    if not medicine_id:
        raise HTTPException(status_code=400, detail="medicine_id required")
    # Only doctors should be able to trigger emails arbitrarily.
    if current_user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can trigger test reminders")

    # Blocking call (sends email via Resend).
    send_reminder_for_medicine(medicine_id)
    return {"status": "ok", "message": "Reminder triggered", "medicine_id": medicine_id}

