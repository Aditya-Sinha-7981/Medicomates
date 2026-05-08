from fastapi import APIRouter, Depends

from utils.auth import get_current_user
from utils.supabase_client import supabase

router = APIRouter(prefix="/visits", tags=["visits"])


@router.get("/{patient_id}")
async def get_visits(patient_id: str, current_user: dict = Depends(get_current_user)):
    visits_result = (
        supabase.table("visits")
        .select("*")
        .eq("patient_id", patient_id)
        .order("visit_date", desc=True)
        .execute()
    )
    visits = visits_result.data or []
    if not visits:
        return []

    doctor_ids = list({row["doctor_id"] for row in visits if row.get("doctor_id")})
    doctor_name_map = {}
    if doctor_ids:
        profiles_result = (
            supabase.table("profiles")
            .select("id, full_name")
            .in_("id", doctor_ids)
            .execute()
        )
        doctor_name_map = {
            row["id"]: row.get("full_name", "Doctor") for row in (profiles_result.data or [])
        }

    out = []
    for row in visits:
        out.append(
            {
                "id": row["id"],
                "doctor_name": doctor_name_map.get(row.get("doctor_id"), "Doctor"),
                "visit_date": row.get("visit_date"),
                "action_type": row.get("action_type"),
                "summary": row.get("summary"),
            }
        )
    return out
