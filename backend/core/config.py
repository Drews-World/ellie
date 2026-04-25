from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_anon_key: str = ""

    # Anthropic
    anthropic_api_key: str

    # External APIs
    news_api_key: str = ""
    polygon_api_key: str = ""
    openweather_api_key: str = ""
    govee_api_key: str = ""   # Govee developer API key for IoT light control
    coingecko_api_url: str = "https://api.coingecko.com/api/v3"
    sportsradar_api_key: str = ""

    # Google Calendar (optional)
    google_client_id: str = ""
    google_client_secret: str = ""

    # Clerk
    clerk_jwks_url: str = ""

    # App
    secret_key: str = "change-me-in-production"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:5173", "https://ellie.vercel.app"]

    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache()
def get_settings():
    return Settings()
