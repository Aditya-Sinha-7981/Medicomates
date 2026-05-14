# Supabase singleton — import this everywhere, never create a new client yourself
# from utils.supabase_client import supabase

import base64
import json
import logging
import re

from supabase import create_client, Client

from config import settings

logger = logging.getLogger(__name__)


def _jwt_payload(jwt: str) -> dict | None:
    """Decode JWT payload (middle segment) without verifying signature."""
    try:
        parts = jwt.strip().split(".")
        if len(parts) != 3:
            return None
        body = parts[1] + "=" * (-len(parts[1]) % 4)
        return json.loads(base64.urlsafe_b64decode(body))
    except Exception:
        return None


def _project_ref_from_supabase_url(url: str) -> str | None:
    if not url:
        return None
    m = re.search(
        r"(?:https?://)?([a-z0-9]+)\.supabase\.co",
        url.strip().rstrip("/"),
        re.IGNORECASE,
    )
    return m.group(1).lower() if m else None


_key = (settings.SUPABASE_SERVICE_KEY or "").strip()
_payload = _jwt_payload(_key) if _key else None
_jwt_role = str(_payload.get("role")) if _payload and _payload.get("role") is not None else None
_jwt_ref = str(_payload.get("ref")).lower() if _payload and _payload.get("ref") else None
_url_ref = _project_ref_from_supabase_url(settings.SUPABASE_URL or "")

if _key and not _key.startswith("eyJ"):
    logger.warning(
        "SUPABASE_SERVICE_KEY does not start with 'eyJ' (legacy JWT). "
        "supabase-py 2.7.x + Auth admin (get_user_by_id, listUsers) expect the "
        "**Legacy service_role** key from Supabase → Project Settings → API → "
        "**Legacy API keys** → service_role. The newer 'sb_secret_…' publishable/secret "
        "pair often yields 403 User not allowed on /auth/v1/admin/*. "
        "Upgrade supabase-py or paste the legacy JWT."
    )

if _jwt_role == "anon":
    logger.error(
        "SUPABASE_SERVICE_KEY is an **anon** JWT (payload.role=anon). "
        "Auth admin API requires **service_role**. In Dashboard → API → **Legacy API keys**, "
        "copy **service_role** (not anon) — both keys look like eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
    )
elif _jwt_role == "service_role":
    logger.debug("SUPABASE_SERVICE_KEY decodes as service_role — OK for Auth admin.")
elif _jwt_role:
    logger.warning("SUPABASE_SERVICE_KEY JWT role=%s (expected service_role).", _jwt_role)

if _jwt_ref and _url_ref and _jwt_ref != _url_ref:
    logger.error(
        "SUPABASE_URL project ref (%s) does not match JWT ref (%s). "
        "Auth admin will often return 403. Use the service_role key from the **same** project "
        "as SUPABASE_URL (e.g. https://%s.supabase.co).",
        _url_ref,
        _jwt_ref,
        _jwt_ref,
    )

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
