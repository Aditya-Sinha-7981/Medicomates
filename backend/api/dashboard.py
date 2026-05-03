from datetime import datetime, timezone

from fastapi import APIRouter

from services.insight_service import generate_insight

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/patient/{patient_id}")
async def get_patient_dashboard(patient_id: str):
    _ = patient_id
    return {
        "profile": {},
        "todays_medicines": [],
        "streak": {"current": 0, "best": 0},
        "weekly_percentage": 0,
        "last_week_percentage": 0,
    }


@router.get("/doctor/{doctor_id}")
async def get_doctor_dashboard(doctor_id: str):
    _ = doctor_id
    return {"profile": {}, "patients": []}


def _utc_iso_z() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
    )


@router.get("/insight/{patient_id}")
async def get_insight(patient_id: str):
    text = await generate_insight(patient_id)
    return {"insight": text, "generated_at": _utc_iso_z()}
