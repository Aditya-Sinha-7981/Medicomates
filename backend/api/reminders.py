from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from services.call_service import build_critical_twiml
from services.critical_call_service import _load_medicine, _load_patient_profile, trigger_critical_call
from utils.auth import get_current_user

router = APIRouter(prefix="/reminders", tags=["reminders"])


def _require_doctor(current_user: dict) -> None:
    if current_user.get("role") != "doctor":
        raise HTTPException(
            status_code=403,
            detail="Only doctors can access critical medication call tools",
        )


@router.get("/critical-call/twiml-preview/{patient_id}/{medicine_id}")
async def preview_critical_twiml(
    patient_id: str,
    medicine_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Returns the exact TwiML that will be sent on the next call (doctor JWT).
    Open in browser or compare with Twilio debugger if audio is wrong.
    """
    _require_doctor(current_user)
    medicine = _load_medicine(patient_id, medicine_id)
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found for this patient")
    profile = _load_patient_profile(patient_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    name = (profile.get("full_name") or "Patient").strip()
    med_name = (medicine.get("name") or "your medication").strip()
    xml = build_critical_twiml(name, med_name)
    return Response(content=xml, media_type="application/xml")


@router.post("/critical-call/{patient_id}/{medicine_id}")
async def trigger_critical_call_endpoint(
    patient_id: str,
    medicine_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Demo helper: immediately place a bilingual critical-medication voice call.

    Requires doctor JWT (same as POST /api/testing/send_reminder/{medicine_id}).
    Medicine must belong to patient and have is_critical=true.
    Patient profiles.phone must be E.164 (e.g. +919876543210).
    """
    if not patient_id or not medicine_id:
        raise HTTPException(status_code=400, detail="patient_id and medicine_id required")

    _require_doctor(current_user)

    try:
        result = trigger_critical_call(
            patient_id,
            medicine_id,
            skip_dedup=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": result.get("status"),
        "message": result.get("message"),
        "message_text": result.get("message_text"),
        "call_sid": result.get("call_sid"),
        "patient_id": patient_id,
        "medicine_id": medicine_id,
    }
