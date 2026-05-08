import logging

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from utils.supabase_client import supabase

logger = logging.getLogger(__name__)

# HTTPBearer makes Swagger UI's 🔒 Authorize button work correctly.
# It also validates the Bearer format automatically before reaching our code.
_bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    token = credentials.credentials  # already stripped of "Bearer " prefix by HTTPBearer

    try:
        user_response = supabase.auth.get_user(token)
    except Exception as exc:
        logger.warning("Supabase get_user failed: %s", exc)
        raise HTTPException(
            status_code=401,
            detail=f"Token rejected by Supabase: {exc}. Token may be expired — log in again.",
        ) from exc

    user = getattr(user_response, "user", None)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Supabase returned no user for this token. It is likely expired or revoked.",
        )

    profile_result = (
        supabase.table("profiles")
        .select("id, role, full_name")
        .eq("id", user.id)
        .single()
        .execute()
    )
    profile = profile_result.data or {}
    if not profile:
        raise HTTPException(
            status_code=403,
            detail=f"User {user.id} authenticated but has no profile row. Register flow may have failed.",
        )

    return {
        "id": profile["id"],
        "role": profile.get("role"),
        "full_name": profile.get("full_name"),
        "email": getattr(user, "email", None),
    }

