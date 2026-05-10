from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

from config import settings
from models.schemas import MarkDoseSchema
from utils.adherence_stats import calculate_percentage, compute_status
from utils.auth import get_current_user
from utils.supabase_client import supabase
from utils.token import generate_token, validate_token

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


@router.post("/mark")
async def mark_dose(
    data: MarkDoseSchema, current_user: dict = Depends(get_current_user)
):
    """
    Manual dose toggle from the patient dashboard.

    If a scheduler row for today's slot doesn't exist yet, create one for that slot so
    manual marking persists across roles (patient/reviewer/doctor views).
    """
    if current_user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Only patients can mark doses")
    if current_user.get("id") != data.patient_id:
        raise HTTPException(status_code=403, detail="Cannot modify another patient's logs")

    # Find today's scheduled logs for this medicine, then match by local-time slot (HH:MM).
    app_tz = ZoneInfo(settings.SCHEDULER_TIMEZONE)
    now_utc = datetime.now(timezone.utc)
    today_local = now_utc.astimezone(app_tz).date()
    day_start_local = datetime.combine(today_local, datetime.min.time(), tzinfo=app_tz)
    day_end_local = day_start_local + timedelta(days=1)
    day_start_utc = day_start_local.astimezone(timezone.utc).isoformat()
    day_end_utc = day_end_local.astimezone(timezone.utc).isoformat()

    logs_res = (
        supabase.table("adherence_logs")
        .select("id, scheduled_time, confirmed_at, token_used")
        .eq("patient_id", data.patient_id)
        .eq("medicine_id", data.medicine_id)
        .gte("scheduled_time", day_start_utc)
        .lt("scheduled_time", day_end_utc)
        .execute()
    )
    logs = logs_res.data or []
    target = None
    for row in logs:
        try:
            scheduled_utc = datetime.fromisoformat(row["scheduled_time"].replace("Z", "+00:00"))
            scheduled_local = scheduled_utc.astimezone(app_tz)
        except Exception:
            continue
        if scheduled_local.strftime("%H:%M") == data.time:
            target = row
            break

    if not target:
        # No row exists for this slot yet; create one so state is persisted in DB.
        try:
            hour, minute = map(int, data.time.split(":"))
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM.") from exc

        scheduled_local = datetime.combine(
            today_local, datetime.min.time(), tzinfo=app_tz
        ).replace(hour=hour, minute=minute)
        scheduled_utc_iso = scheduled_local.astimezone(timezone.utc).isoformat()

        created = (
            supabase.table("adherence_logs")
            .insert(
                {
                    "medicine_id": data.medicine_id,
                    "patient_id": data.patient_id,
                    "scheduled_time": scheduled_utc_iso,
                    "token": generate_token(),
                    "confirmed_at": datetime.now(timezone.utc).isoformat() if data.taken else None,
                    "token_used": bool(data.taken),
                }
            )
            .execute()
        )
        row = (created.data or [{}])[0]
        return {
            "status": "ok",
            "id": row.get("id"),
            "confirmed_at": row.get("confirmed_at"),
            "token_used": row.get("token_used"),
        }

    if data.taken:
        update = {
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
            # Prevent double-confirmation from the email link after manual marking.
            "token_used": True,
        }
    else:
        update = {
            "confirmed_at": None,
            # Allow email click again if user undoes a manual confirmation.
            "token_used": False,
        }

    supabase.table("adherence_logs").update(update).eq("id", target["id"]).execute()
    return {"status": "ok", "id": target["id"], **update}


@router.get("/{patient_id}")
async def get_adherence_logs(
    patient_id: str, days: int = 30, current_user: dict = Depends(get_current_user)
):
    safe_days = max(1, days)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=safe_days)).isoformat()

    # Fetch logs
    logs_result = (
        supabase.table("adherence_logs")
        .select("*")
        .eq("patient_id", patient_id)
        .gte("scheduled_time", cutoff)
        .order("scheduled_time", desc=True)
        .execute()
    )
    logs = logs_result.data or []

    if not logs:
        return []

    # Fetch medicines mapping
    meds_result = supabase.table("medicines").select("id, name").eq("patient_id", patient_id).execute()
    meds_map = {m["id"]: m["name"] for m in (meds_result.data or [])}

    enriched_logs = []
    for log in logs:
        log["medicine_name"] = meds_map.get(log["medicine_id"], "Unknown Medicine")
        log["status"] = compute_status(log["scheduled_time"], log.get("confirmed_at"))
        enriched_logs.append(log)

    return enriched_logs


@router.get("/{patient_id}/summary")
async def get_adherence_summary(
    patient_id: str, current_user: dict = Depends(get_current_user)
):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    logs_result = (
        supabase.table("adherence_logs")
        .select("*")
        .eq("patient_id", patient_id)
        .gte("scheduled_time", cutoff)
        .execute()
    )
    logs = logs_result.data or []

    meds_result = supabase.table("medicines").select("id, name").eq("patient_id", patient_id).execute()
    meds_map = {m["id"]: m["name"] for m in (meds_result.data or [])}

    summary_map = {}

    for log in logs:
        med_id = log["medicine_id"]
        med_name = meds_map.get(med_id, "Unknown Medicine")

        status = compute_status(log["scheduled_time"], log.get("confirmed_at"))
        if status == "pending":
            continue

        try:
            s_time = datetime.fromisoformat(log["scheduled_time"].replace("Z", "+00:00"))
            time_slot = s_time.strftime("%H:%M")
        except Exception:
            continue

        if med_id not in summary_map:
            summary_map[med_id] = {
                "medicine_id": med_id,
                "medicine_name": med_name,
                "taken_count": 0,
                "missed_count": 0,
                "percentage": 0,
                "time_slots": {}
            }

        if time_slot not in summary_map[med_id]["time_slots"]:
            summary_map[med_id]["time_slots"][time_slot] = {
                "time": time_slot,
                "taken": 0,
                "missed": 0,
                "percentage": 0
            }

        if status == "taken":
            summary_map[med_id]["taken_count"] += 1
            summary_map[med_id]["time_slots"][time_slot]["taken"] += 1
        elif status == "missed":
            summary_map[med_id]["missed_count"] += 1
            summary_map[med_id]["time_slots"][time_slot]["missed"] += 1

    # Finalize percentages
    result_list = []
    for med_id, data in summary_map.items():
        total = data["taken_count"] + data["missed_count"]
        data["percentage"] = calculate_percentage(data["taken_count"], total)

        slots_list = []
        for slot_time, slot_data in data["time_slots"].items():
            slot_total = slot_data["taken"] + slot_data["missed"]
            slot_data["percentage"] = calculate_percentage(slot_data["taken"], slot_total)
            slots_list.append(slot_data)

        data["time_slots"] = sorted(slots_list, key=lambda x: x["time"])
        result_list.append(data)

    return sorted(result_list, key=lambda item: item["medicine_name"])
