from fastapi import APIRouter, Depends, HTTPException

from models.schemas import LoginSchema, RegisterSchema
from utils.auth import get_current_user
from utils.supabase_client import supabase

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Quick token validation endpoint. Use this first when debugging 401s.
    If this works, your token and header format are correct."""
    return current_user


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

    payload = {
        "id": user.id,
        "role": data.role,
        "full_name": data.full_name,
        "email": data.email.strip().lower(),
    }
    try:
        supabase.table("profiles").upsert(payload).execute()
    except Exception:
        # profiles.email column may not exist until docs/sql/add_profile_email.sql is applied.
        supabase.table("profiles").upsert(
            {k: v for k, v in payload.items() if k != "email"}
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

    # Keep profiles.email in sync for reminder delivery fallback (see scheduler_service).
    try:
        supabase.table("profiles").update({"email": data.email.strip().lower()}).eq(
            "id", user.id
        ).execute()
    except Exception:
        pass

    return {
        "access_token": session.access_token,
        "role": profile_data.get("role"),
        "id": user.id,
        "full_name": profile_data.get("full_name"),
    }
