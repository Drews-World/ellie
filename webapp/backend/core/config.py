from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_anon_key: str = ""

    # ── Model layer ──
    # Primary provider for ELLIE's brain: "openrouter" or "gemini".
    # Falls back to Gemini automatically if openrouter_api_key is empty.
    llm_provider: str = "openrouter"

    # OpenRouter (primary — 200+ models, cost routing)
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Model routing per task tier (OpenRouter model ids).
    # See services/model_router.py + docs/ELLIE_REFACTOR_PLAN.md.
    model_brain: str = "anthropic/claude-sonnet-4.6"          # ELLIE chat agent loop (tools + memory)
    model_complex: str = "anthropic/claude-sonnet-4.6"        # high-stakes reasoning / code
    model_fast: str = "meta-llama/llama-3.3-70b-instruct"     # conversational / quick
    model_bulk: str = "qwen/qwen-2.5-72b-instruct"            # routine summarize / brief
    model_trivial: str = "meta-llama/llama-3.1-8b-instruct"   # tagging / classification
    model_multimodal: str = "google/gemini-flash-1.5"         # image / vision

    # Gemini (fallback, via OpenAI-compat endpoint)
    gemini_api_key: str = ""
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
    # Also allow this project's Vercel preview/branch deployments AND any
    # localhost port — the dev frontend doesn't always get 5173 (other
    # projects grab it), and localhost origins are only reachable from
    # Drew's own machine.
    cors_origin_regex: str = (
        r"https://ellie-[a-z0-9-]+-humesandrew093-9389s-projects\.vercel\.app"
        r"|http://localhost:\d+"
        r"|http://127\.0\.0\.1:\d+"
    )

    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache()
def get_settings():
    return Settings()
