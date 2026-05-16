from fastapi import APIRouter, Depends, HTTPException

from services.sos_service import trigger_patient_sos
from utils.auth import get_current_user

router = APIRouter(prefix="/sos", tags=["sos"])


@router.post("/{patient_id}")
async def trigger_sos(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Patient-triggered emergency SOS: email all connected reviewers,
    voice-call all connected active doctors.
    """
    if current_user.get("role") != "patient":
        raise HTTPException(
            status_code=403,
            detail="Only patients can trigger emergency SOS",
        )
    if current_user["id"] != patient_id:
        raise HTTPException(
            status_code=403,
            detail="You can only trigger SOS for your own account",
        )

    try:
        result = trigger_patient_sos(patient_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to trigger emergency SOS. Please try again.",
        ) from exc

    return result
