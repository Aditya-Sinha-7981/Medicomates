from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from config import settings
from utils.supabase_client import supabase
from utils.token import validate_token

router = APIRouter(prefix="/adherence", tags=["adherence"])


@router.get("/confirm")
async def confirm_taken(token: str):
    log = validate_token(token)
    if not log:
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/confirm?status=invalid")

    supabase.table("adherence_logs").update(
        {
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
            "token_used": True,
        }
    ).eq("id", log["id"]).execute()

    return RedirectResponse(url=f"{settings.FRONTEND_URL}/confirm?status=success")


@router.get("/{patient_id}")
async def get_adherence_logs(patient_id: str, days: int = 30):
    # days filter is added by Backend 2 in next pass.
    result = (
        supabase.table("adherence_logs")
        .select("*")
        .eq("patient_id", patient_id)
        .order("scheduled_time", desc=True)
        .limit(max(1, days) * 10)
        .execute()
    )
    return result.data or []


@router.get("/{patient_id}/summary")
async def get_adherence_summary(patient_id: str):
    # Stub response for frontend integration; Backend 2 will compute grouped stats.
    _ = patient_id
    return []
