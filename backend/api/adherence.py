from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from config import settings
from utils.adherence_stats import calculate_percentage, compute_status
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
async def get_adherence_summary(patient_id: str):
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
