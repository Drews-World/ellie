from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_anon_key: str = ""

    # Gemini (via OpenAI-compat endpoint)
    gemini_api_key: str
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    gemini_model: str = "gemini-2.0-flash"

    # External APIs
    news_api_key: str = ""
    polygon_api_key: str = ""
    openweather_api_key: str = ""
    govee_api_key: str = ""
    coingecko_api_url: str = "https://api.coingecko.com/api/v3"
    sportsradar_api_key: str = ""

    # Google Calendar (optional)
    google_client_id: str = ""
    google_client_secret: str = ""

    # Clerk
    clerk_jwks_url: str = ""

    # Sub-systems
    ellietrading_url: str = "http://localhost:8000"
    ellietrading_auth_token: str = ""
    elliebusiness_url: str = "http://localhost:8001"
    elliebusiness_auth_token: str = "dev-token"

    # App
    secret_key: str = "change-me-in-production"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174", "https://ellie.vercel.app"]

    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache()
def get_settings():
    return Settings()
