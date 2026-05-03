from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    GEMINI_API_KEY: str
    RESEND_API_KEY: str
    FROM_EMAIL: str
    FRONTEND_URL: str
    BACKEND_URL: str
    SCHEDULER_TIMEZONE: str = "Asia/Kolkata"

    class Config:
        env_file = ".env"

settings = Settings()
