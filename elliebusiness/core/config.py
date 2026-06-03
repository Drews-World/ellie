from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── LLM ──────────────────────────────────────────────────────────────────
    # OpenRouter is the production choice (one key, every model).
    # Gemini is the free fallback for prototyping.
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "anthropic/claude-sonnet-4-5"   # Forge creative tasks
    openrouter_fast_model: str = "openai/gpt-4o-mini"        # Nova classification / cheap tasks

    gemini_api_key: str = ""
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    gemini_model: str = "gemini-2.0-flash"

    # ── Image gen ────────────────────────────────────────────────────────────
    openai_api_key: str = ""         # Required for Forge image generation (platform.openai.com)
    image_gen_model: str = "gpt-image-2"

    # ── Supabase ─────────────────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_service_key: str = ""

    # ── Etsy ─────────────────────────────────────────────────────────────────
    etsy_api_key: str = ""           # Keystring — read-only (Nova)
    etsy_shared_secret: str = ""     # OAuth secret — needed for writing (Forge)
    etsy_access_token: str = ""      # OAuth access token after auth flow
    etsy_refresh_token: str = ""     # OAuth refresh token
    etsy_shop_id: str = ""           # Your Etsy shop ID

    # ── Printify ─────────────────────────────────────────────────────────────
    printify_api_token: str = ""
    printify_shop_id: str = ""

    # ── Pinterest (Herald — promote listings to drive Etsy traffic) ──────────
    pinterest_access_token: str = ""     # OAuth token from developers.pinterest.com
    pinterest_base_url: str = "https://api.pinterest.com/v5"
    pinterest_default_board_id: str = ""  # fallback board when no niche match
    # Default OFF: the scheduled sweep will NOT post publicly until you flip this
    # on. Manual /promote/listing calls (Drew/ELLIE-initiated) are always allowed.
    pinterest_auto_promote: bool = False
    # Etsy storefront base for building destination links from a listing id.
    etsy_listing_base_url: str = "https://www.etsy.com/listing"

    # ── Discord ──────────────────────────────────────────────────────────────
    discord_webhook_url: str = ""    # EllieBusiness channel webhook

    # ── PixelLab (Phase 2 — game assets) ─────────────────────────────────────
    pixellab_api_key: str = ""

    # ── App ──────────────────────────────────────────────────────────────────
    auth_token: str = "dev-token"    # Bearer token ELLIE Hub uses
    environment: str = "development"

    # ── Spending limits ───────────────────────────────────────────────────────
    daily_llm_spend_limit_usd: float = 10.0
    daily_image_spend_limit_usd: float = 20.0

    # ── Research integrity ────────────────────────────────────────────────────
    # When Etsy API + web scrape both fail, Nova can fall back to LLM-generated
    # ("synthetic") listings. That data is a guess, not real market signal.
    # Default OFF: Nova refuses rather than pass fabricated data off as real.
    # Set NOVA_ALLOW_SYNTHETIC=1 to permit it (it will be loudly flagged).
    nova_allow_synthetic: bool = False

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
