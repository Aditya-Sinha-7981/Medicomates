import secrets

from utils.supabase_client import supabase


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def validate_token(token: str) -> dict | None:
    result = (
        supabase.table("adherence_logs")
        .select("*")
        .eq("token", token)
        .eq("token_used", False)
        .limit(1)
        .execute()
    )
    data = result.data or []
    return data[0] if data else None
