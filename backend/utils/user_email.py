"""Resolve user email via Supabase Auth admin, with profiles.email fallback."""

import logging

from postgrest.exceptions import APIError

from utils.supabase_client import supabase

logger = logging.getLogger(__name__)


def resolve_user_email(user_id: str) -> str | None:
    email: str | None = None
    try:
        user_response = supabase.auth.admin.get_user_by_id(user_id)
        email = getattr(getattr(user_response, "user", None), "email", None) or None
    except Exception as exc:
        logger.warning(
            "Auth admin get_user_by_id failed for user_id=%s (%s). Trying profiles.email fallback.",
            user_id,
            exc,
        )

    if email:
        return email.strip() if isinstance(email, str) else None

    try:
        prof = (
            supabase.table("profiles")
            .select("email")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = prof.data or []
        raw = rows[0].get("email") if rows else None
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    except APIError:
        logger.exception("profiles.email lookup failed user_id=%s", user_id)
    except Exception:
        logger.exception("profiles.email lookup failed user_id=%s", user_id)

    return None
