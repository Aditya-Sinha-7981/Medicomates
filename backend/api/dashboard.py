from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException

from config import settings
from services.insight_service import generate_insight
from utils.adherence_stats import calculate_streak, calculate_time_window_percentage, compute_status
from utils.auth import get_current_user
from utils.supabase_client import supabase

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/patient/{patient_id}")
async def get_patient_dashboard(patient_id: str, current_user: dict = Depends(get_current_user)):
    # 1. Profile
    profile_result = supabase.table("profiles").select("full_name, allergies").eq("id", patient_id).execute()
    profile = profile_result.data[0] if profile_result.data else {}

    # 2. Adherence Logs
    # Fetch enough logs to compute streaks and last two weeks
    cutoff = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    logs_result = supabase.table("adherence_logs").select("*").eq("patient_id", patient_id).gte("scheduled_time", cutoff).execute()
    logs = logs_result.data or []

    # 3. Streak
    streak = calculate_streak(logs)

    # 4. Weekly percentages
    now = datetime.now(timezone.utc)
    start_this_week = now - timedelta(days=7)
    start_last_week = now - timedelta(days=14)

    weekly_percentage = calculate_time_window_percentage(logs, start_this_week, now)
    last_week_percentage = calculate_time_window_percentage(logs, start_last_week, start_this_week)

    # 5. Today's Medicines (scheduler-local day boundaries)
    app_tz = ZoneInfo(settings.SCHEDULER_TIMEZONE)
    today_local = now.astimezone(app_tz).date()

    meds_result = supabase.table("medicines").select("*").eq("patient_id", patient_id).eq("is_active", True).execute()
    meds = meds_result.data or []

    today_log_map = {}
    for log in logs:
        try:
            scheduled_utc = datetime.fromisoformat(log["scheduled_time"].replace("Z", "+00:00"))
            scheduled_local = scheduled_utc.astimezone(app_tz)
        except Exception:
            continue

        if scheduled_local.date() != today_local:
            continue

        slot_key = (log.get("medicine_id"), scheduled_local.strftime("%H:%M"))
        # Keep taken logs if there is a conflict for the same slot.
        if slot_key not in today_log_map:
            today_log_map[slot_key] = log
        elif today_log_map[slot_key].get("confirmed_at") is None and log.get("confirmed_at") is not None:
            today_log_map[slot_key] = log

    todays_medicines = []
    for med in meds:
        statuses = []
        # Pre-fill all scheduled times based on reminder_times
        for rt in med.get("reminder_times", []):
            try:
                hour, minute = map(int, rt.split(":"))
                scheduled_local = datetime.combine(today_local, time(hour=hour, minute=minute), tzinfo=app_tz)
                scheduled_utc = scheduled_local.astimezone(timezone.utc)

                # Find matching log by local slot time to avoid UTC/local mismatch.
                matching_log = today_log_map.get((med["id"], rt))

                if matching_log:
                    status = matching_log.get("status") or compute_status(matching_log["scheduled_time"], matching_log.get("confirmed_at"))
                    conf_at = matching_log.get("confirmed_at")
                else:
                    # Log hasn't been generated yet (scheduler runs at exact time)
                    if scheduled_utc < now:
                        status = "missed"
                    else:
                        status = "pending"
                    conf_at = None

                statuses.append({
                    "time": rt,
                    "status": status,
                    "confirmed_at": conf_at
                })
            except Exception:
                pass

        todays_medicines.append({
            "medicine_id": med["id"],
            "name": med["name"],
            "dosage": med["dosage"],
            "reminder_times": med.get("reminder_times", []),
            "statuses": sorted(statuses, key=lambda x: x["time"])
        })

    return {
        "profile": profile,
        "todays_medicines": todays_medicines,
        "streak": streak,
        "weekly_percentage": weekly_percentage,
        "last_week_percentage": last_week_percentage,
    }


@router.get("/doctor/{doctor_id}")
async def get_doctor_dashboard(doctor_id: str, current_user: dict = Depends(get_current_user)):
    profile_result = supabase.table("profiles").select("full_name").eq("id", doctor_id).execute()
    profile = profile_result.data[0] if profile_result.data else {}

    # NOTE: Avoid Supabase join ambiguity here because patient_doctor_connections has TWO FKs
    # to profiles (patient_id and doctor_id). In some Supabase setups, `.select("profiles(...)")`
    # can error with "Could not find a relationship" / ambiguous relationship name.
    conns_result = (
        supabase.table("patient_doctor_connections")
        .select("patient_id")
        .eq("doctor_id", doctor_id)
        .eq("is_active", True)
        .execute()
    )
    connections = conns_result.data or []

    patients_list = []
    now = datetime.now(timezone.utc)
    start_this_week = now - timedelta(days=7)

    for conn in connections:
        pat_id = conn["patient_id"]
        profile_res = (
            supabase.table("profiles")
            .select("full_name")
            .eq("id", pat_id)
            .single()
            .execute()
        )
        full_name = (profile_res.data or {}).get("full_name") or "Unknown"
        
        logs_result = supabase.table("adherence_logs").select("*").eq("patient_id", pat_id).gte("scheduled_time", start_this_week.isoformat()).execute()
        logs = logs_result.data or []
        
        weekly_percentage = calculate_time_window_percentage(logs, start_this_week, now)
        
        patients_list.append({
            "patient_id": pat_id,
            "full_name": full_name,
            "weekly_percentage": weekly_percentage,
            "needs_attention": weekly_percentage < 60
        })

    return {"profile": profile, "patients": patients_list}


def _utc_iso_z() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
    )


@router.get("/insight/{patient_id}")
async def get_insight(patient_id: str, current_user: dict = Depends(get_current_user)):
    text = await generate_insight(patient_id)
    return {"insight": text, "generated_at": _utc_iso_z()}


@router.get("/reviewer/{patient_id}")
async def get_reviewer_dashboard(patient_id: str, current_user: dict = Depends(get_current_user)):
    """
    Returns the same payload as the patient dashboard but only accessible by
    a confirmed reviewer of that patient. Read-only — the frontend enforces no edits.
    """
    # Verify the caller is actually a reviewer of this patient
    link_res = (
        supabase.table("patient_reviewer_connections")
        .select("id")
        .eq("patient_id", patient_id)
        .eq("reviewer_id", current_user["id"])
        .execute()
    )
    if not link_res.data:
        raise HTTPException(status_code=403, detail="You are not a reviewer of this patient.")

    # Reuse the exact same aggregation logic as the patient dashboard
    profile_result = supabase.table("profiles").select("full_name, allergies").eq("id", patient_id).execute()
    profile = profile_result.data[0] if profile_result.data else {}

    cutoff = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    logs_result = supabase.table("adherence_logs").select("*").eq("patient_id", patient_id).gte("scheduled_time", cutoff).execute()
    logs = logs_result.data or []

    streak = calculate_streak(logs)

    now = datetime.now(timezone.utc)
    start_this_week = now - timedelta(days=7)
    start_last_week = now - timedelta(days=14)

    weekly_percentage = calculate_time_window_percentage(logs, start_this_week, now)
    last_week_percentage = calculate_time_window_percentage(logs, start_last_week, start_this_week)

    app_tz = ZoneInfo(settings.SCHEDULER_TIMEZONE)
    today_local = now.astimezone(app_tz).date()

    meds_result = supabase.table("medicines").select("*").eq("patient_id", patient_id).eq("is_active", True).execute()
    meds = meds_result.data or []

    today_log_map = {}
    for log in logs:
        try:
            scheduled_utc = datetime.fromisoformat(log["scheduled_time"].replace("Z", "+00:00"))
            scheduled_local = scheduled_utc.astimezone(app_tz)
        except Exception:
            continue
        if scheduled_local.date() != today_local:
            continue
        slot_key = (log.get("medicine_id"), scheduled_local.strftime("%H:%M"))
        if slot_key not in today_log_map:
            today_log_map[slot_key] = log
        elif today_log_map[slot_key].get("confirmed_at") is None and log.get("confirmed_at") is not None:
            today_log_map[slot_key] = log

    todays_medicines = []
    for med in meds:
        statuses = []
        for rt in med.get("reminder_times", []):
            try:
                hour, minute = map(int, rt.split(":"))
                scheduled_local = datetime.combine(today_local, time(hour=hour, minute=minute), tzinfo=app_tz)
                scheduled_utc = scheduled_local.astimezone(timezone.utc)
                matching_log = today_log_map.get((med["id"], rt))
                if matching_log:
                    status = matching_log.get("status") or compute_status(matching_log["scheduled_time"], matching_log.get("confirmed_at"))
                    conf_at = matching_log.get("confirmed_at")
                else:
                    status = "missed" if scheduled_utc < now else "pending"
                    conf_at = None
                statuses.append({"time": rt, "status": status, "confirmed_at": conf_at})
            except Exception:
                pass
        todays_medicines.append({
            "medicine_id": med["id"],
            "name": med["name"],
            "dosage": med["dosage"],
            "reminder_times": med.get("reminder_times", []),
            "statuses": sorted(statuses, key=lambda x: x["time"]),
        })

    # Also return the full 30-day adherence logs so the calendar can render
    adherence_30d = supabase.table("adherence_logs").select("*, medicines(name)").eq("patient_id", patient_id).gte("scheduled_time", (now - timedelta(days=30)).isoformat()).execute()

    return {
        "profile": profile,
        "todays_medicines": todays_medicines,
        "streak": streak,
        "weekly_percentage": weekly_percentage,
        "last_week_percentage": last_week_percentage,
        "adherence_logs": adherence_30d.data or [],
    }
