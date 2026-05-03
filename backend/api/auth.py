from fastapi import APIRouter, HTTPException

from models.schemas import LoginSchema, RegisterSchema
from utils.supabase_client import supabase

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(data: RegisterSchema):
    try:
        response = supabase.auth.sign_up(
            {"email": data.email, "password": data.password}
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Registration failed: {exc}") from exc

    user = getattr(response, "user", None)
    if not user:
        raise HTTPException(status_code=400, detail="Registration failed: missing user")

    supabase.table("profiles").upsert(
        {
            "id": user.id,
            "role": data.role,
            "full_name": data.full_name,
        }
    ).execute()

    return {"message": "registered", "id": user.id, "role": data.role}


@router.post("/login")
async def login(data: LoginSchema):
    try:
        response = supabase.auth.sign_in_with_password(
            {"email": data.email, "password": data.password}
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid credentials: {exc}") from exc

    user = getattr(response, "user", None)
    session = getattr(response, "session", None)
    if not user or not session:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    profile = (
        supabase.table("profiles")
        .select("id, role, full_name")
        .eq("id", user.id)
        .single()
        .execute()
    )
    profile_data = profile.data or {}

    return {
        "access_token": session.access_token,
        "role": profile_data.get("role"),
        "id": user.id,
        "full_name": profile_data.get("full_name"),
    }
