import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import MedicineConfirmSchema, MedicineSchema, MedicineUpdateSchema
from services.allergy_service import check_medicine_safety, check_new_medicine_interactions
from services.scheduler_service import (
    reschedule_medicine,
    schedule_medicine,
    unschedule_medicine,
)
from utils.auth import get_current_user
from utils.supabase_client import supabase
from utils.visits import log_visit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/medicines", tags=["medicines"])


def _patient_doctor_linked(patient_id: str, doctor_id: str) -> bool:
    r = (
        supabase.table("patient_doctor_connections")
        .select("id")
        .eq("patient_id", patient_id)
        .eq("doctor_id", doctor_id)
        .limit(1)
        .execute()
    )
    return bool(r.data)


def _patient_reviewer_linked(patient_id: str, reviewer_id: str) -> bool:
    r = (
        supabase.table("patient_reviewer_connections")
        .select("id")
        .eq("patient_id", patient_id)
        .eq("reviewer_id", reviewer_id)
        .limit(1)
        .execute()
    )
    return bool(r.data)


def assert_can_read_medicines(patient_id: str, current_user: dict) -> None:
    """
    Reviewers use accounts with role \"patient\" (see connections — only patients can be reviewers).
    So we must allow reviewer links before rejecting other patients' IDs.
    """
    uid = current_user["id"]
    role = current_user.get("role")

    if patient_id == uid:
        return

    if _patient_reviewer_linked(patient_id, uid):
        return

    if role == "doctor":
        if _patient_doctor_linked(patient_id, uid):
            return
        raise HTTPException(
            status_code=403, detail="You are not connected to this patient as a doctor."
        )

    if role == "patient":
        raise HTTPException(status_code=403, detail="You can only view your own medicines.")

    raise HTTPException(status_code=403, detail="Not allowed to view medicines for this patient.")


def assert_can_write_medicines(patient_id: str, current_user: dict, doctor_id: str | None) -> None:
    uid = current_user["id"]
    role = current_user.get("role")
    if role == "patient":
        if patient_id != uid:
            raise HTTPException(status_code=403, detail="Patients may only add medicines to their own profile.")
        return
    if role == "doctor":
        effective_doctor = doctor_id or uid
        if doctor_id and doctor_id != uid:
            raise HTTPException(status_code=403, detail="doctor_id must match the logged-in doctor.")
        if not _patient_doctor_linked(patient_id, effective_doctor):
            raise HTTPException(status_code=403, detail="You are not connected to this patient as a doctor.")
        return
    raise HTTPException(status_code=403, detail="Only patients and doctors can add or change medicines.")


def _public_interactions(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "drug1": r["drug1"],
            "drug2": r["drug2"],
            "description": r["description"],
            "severity": r["severity"],
        }
        for r in rows
    ]


async def _save_medicine(data: MedicineSchema, rxcui: str | None) -> dict:
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
        "rxcui": rxcui,
        "is_active": True,
        "quantity_on_hand": data.quantity_on_hand,
        "units_per_day": data.units_per_day,
        "low_supply_threshold_days": data.low_supply_threshold_days,
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


@router.post("/confirm")
async def confirm_add_medicine(
    data: MedicineConfirmSchema, current_user: dict = Depends(get_current_user)
):
    assert_can_write_medicines(data.patient_id, current_user, data.doctor_id)
    logger.warning(
        "Medicine added after acknowledging warnings — patient=%s name=%s warnings=%s",
        data.patient_id,
        data.name,
        data.acknowledged_warnings,
    )
    return await _save_medicine(data, data.rxcui)


@router.get("/{patient_id}")
async def get_medicines(patient_id: str, current_user: dict = Depends(get_current_user)):
    assert_can_read_medicines(patient_id, current_user)
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
async def add_medicine(data: MedicineSchema, current_user: dict = Depends(get_current_user)):
    assert_can_write_medicines(data.patient_id, current_user, data.doctor_id)

    safety = await check_medicine_safety(data.name, data.patient_id)
    interactions: list[dict[str, Any]] = []
    if safety.get("rxcui"):
        interactions = await check_new_medicine_interactions(data.patient_id, safety["rxcui"])

    if not safety["safe"] or interactions:
        return {
            "status": "warnings",
            "warnings": safety["warnings"],
            "interactions": _public_interactions(interactions),
            "medicine_data": data.model_dump(mode="json"),
            "rxcui": safety["rxcui"],
        }

    return await _save_medicine(data, safety["rxcui"])


@router.put("/{medicine_id}")
async def update_medicine(
    medicine_id: str, data: MedicineUpdateSchema, current_user: dict = Depends(get_current_user)
):
    existing = (
        supabase.table("medicines")
        .select("patient_id")
        .eq("id", medicine_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Medicine not found")
    assert_can_write_medicines(existing.data["patient_id"], current_user, data.doctor_id)

    raw = data.model_dump(exclude_unset=True, mode="json")
    update_payload = {k: v for k, v in raw.items() if k not in ("patient_id", "doctor_id")}

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
async def deactivate_medicine(medicine_id: str, current_user: dict = Depends(get_current_user)):
    existing = (
        supabase.table("medicines")
        .select("patient_id")
        .eq("id", medicine_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Medicine not found")
    assert_can_write_medicines(existing.data["patient_id"], current_user, doctor_id=None)

    unschedule_medicine(medicine_id)
    supabase.table("medicines").update({"is_active": False}).eq("id", medicine_id).execute()
    return {"message": "Medicine deactivated"}
