from fastapi import APIRouter

from models.schemas import MedicineSchema, MedicineUpdateSchema
from services.scheduler_service import (
    reschedule_medicine,
    schedule_medicine,
    unschedule_medicine,
)
from utils.supabase_client import supabase
from utils.visits import log_visit

router = APIRouter(prefix="/medicines", tags=["medicines"])


@router.get("/{patient_id}")
async def get_medicines(patient_id: str):
    result = (
        supabase.table("medicines")
        .select("*")
        .eq("patient_id", patient_id)
        .eq("is_active", True)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.post("")
async def add_medicine(data: MedicineSchema):
    payload = {
        "patient_id": data.patient_id,
        "name": data.name,
        "dosage": data.dosage,
        "frequency": data.frequency,
        "reminder_times": data.reminder_times,
        "start_date": data.start_date.isoformat() if data.start_date else None,
        "end_date": data.end_date.isoformat() if data.end_date else None,
        "notes": data.notes,
        "added_by": data.doctor_id,
    }
    created = supabase.table("medicines").insert(payload).execute()
    medicine = (created.data or [{}])[0]
    medicine_id = medicine.get("id")

    if medicine_id:
        schedule_medicine(medicine_id, data.reminder_times)
        if data.doctor_id:
            log_visit(
                data.patient_id,
                data.doctor_id,
                "prescription_added",
                f"Added {data.name} {data.dosage}",
            )

    return {"id": medicine_id, "message": "Medicine added and reminders scheduled"}


@router.put("/{medicine_id}")
async def update_medicine(medicine_id: str, data: MedicineUpdateSchema):
    update_payload = data.model_dump(exclude_none=True)
    if "start_date" in update_payload and data.start_date:
        update_payload["start_date"] = data.start_date.isoformat()
    if "end_date" in update_payload and data.end_date:
        update_payload["end_date"] = data.end_date.isoformat()

    if update_payload:
        supabase.table("medicines").update(update_payload).eq("id", medicine_id).execute()

    if data.reminder_times is not None:
        reschedule_medicine(medicine_id, data.reminder_times)

    if data.doctor_id:
        log_visit(
            data.patient_id,
            data.doctor_id,
            "prescription_updated",
            f"Updated medicine {medicine_id}",
        )

    return {"message": "Medicine updated and reminders rescheduled"}


@router.delete("/{medicine_id}")
async def deactivate_medicine(medicine_id: str):
    unschedule_medicine(medicine_id)
    supabase.table("medicines").update({"is_active": False}).eq("id", medicine_id).execute()
    return {"message": "Medicine deactivated"}
