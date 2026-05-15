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
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Local insight model (Ollama) — used first for adherence insight text.
    # If Ollama is unavailable, we fall back to Gemini.
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_INSIGHT_MODEL: str = "llama3.1:8b-instruct"
    OLLAMA_TIMEOUT_SECONDS: int = 8
    OLLAMA_TEMPERATURE: float = 0.2
    OLLAMA_NUM_PREDICT: int = 180

    # Task 2 — Twilio critical-medication voice calls (optional until Task 2 code ships)
    CALL_PROVIDER: str = "none"  # "none" | "twilio"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    @field_validator(
        "SUPABASE_URL",
        "SUPABASE_SERVICE_KEY",
        "GEMINI_API_KEY",
        "RESEND_API_KEY",
        "FROM_EMAIL",
        "FRONTEND_URL",
        "BACKEND_URL",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_PHONE_NUMBER",
        "CALL_PROVIDER",
        mode="before",
    )
    @classmethod
    def strip_env_strings(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().strip('"').strip("'")
        return v


settings = Settings()
