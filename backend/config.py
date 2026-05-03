from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    GEMINI_API_KEY: str
    RESEND_API_KEY: str
    FROM_EMAIL: str
    FRONTEND_URL: str
    BACKEND_URL: str
    SCHEDULER_TIMEZONE: str = "Asia/Kolkata"

    @field_validator(
        "SUPABASE_URL",
        "SUPABASE_SERVICE_KEY",
        "GEMINI_API_KEY",
        "RESEND_API_KEY",
        "FROM_EMAIL",
        "FRONTEND_URL",
        "BACKEND_URL",
        mode="before",
    )
    @classmethod
    def strip_env_strings(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().strip('"').strip("'")
        return v


settings = Settings()
