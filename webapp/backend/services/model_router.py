"""
ELLIE model-router layer.

One place that decides *which model handles which kind of task*, returns a
ready-to-use OpenAI-compatible client + model id, and (via `complete`) runs the
call with a graceful fallback chain so the brain never goes dark on a single
model's quota/outage. OpenRouter is the primary provider (200+ models + cost
routing); Gemini's OpenAI-compat endpoint is the last-resort fallback.

Two layers:

1. Task tiers — capability/cost bands, each mapped to a concrete model id:
     complex    → high-stakes reasoning / code / decisions   (Claude Sonnet)
     fast       → conversational / quick analysis            (Llama 3.3 70B)
     bulk       → routine summarize / monitor / brief         (Qwen 2.5 72B)
     trivial    → tagging / classification / routing         (Llama 3.1 8B)
     multimodal → image / vision                             (Gemini Flash)

2. Task routes — semantic task names callers use, mapped to a tier. Callers say
   *what they're doing* ("brief", "chat", "trade_proposal"); the router decides
   which model serves it. This keeps routing policy in one file instead of
   scattered tier strings at every call site.

Usage:
    from services.model_router import complete, get_model_client

    # Preferred: route by task, with built-in fallback.
    text = complete("brief", messages=[...], max_tokens=1000)

    # Lower-level: get a client + model id for a tier and call it yourself.
    client, model = get_model_client("fast")
    resp = client.chat.completions.create(model=model, messages=[...])

See docs/ELLIE_REFACTOR_PLAN.md → "Model routing strategy".
"""
import logging

from openai import OpenAI
from core.config import get_settings

logger = logging.getLogger("ellie.model_router")

# ── Tier → settings field holding its OpenRouter model id ──
_TIER_FIELDS = {
    "complex": "model_complex",
    "fast": "model_fast",
    "bulk": "model_bulk",
    "trivial": "model_trivial",
    "multimodal": "model_multimodal",
}

DEFAULT_TIER = "fast"

# ── Semantic task → tier routing table ──
# Callers route by *what the work is*, not by model. Add a row here rather than
# hardcoding a tier string at a call site. Unknown tasks fall back to DEFAULT_TIER.
TASK_ROUTES = {
    # complex — reasoning, code, money/decisions: worth the spend
    "reason": "complex",
    "code": "complex",
    "decision": "complex",
    "trade_proposal": "complex",
    "deep_analysis": "complex",
    "plan": "complex",
    # fast — interactive, latency-sensitive
    "chat": "fast",
    "quick_analysis": "fast",
    "reply": "fast",
    # bulk — routine high-volume synthesis
    "brief": "bulk",
    "summarize": "bulk",
    "monitor": "bulk",
    "digest": "bulk",
    "screen": "bulk",
    # trivial — cheap structured calls
    "classify": "trivial",
    "tag": "trivial",
    "route": "trivial",
    "extract": "trivial",
    # multimodal — vision/image
    "vision": "multimodal",
    "image": "multimodal",
    "ocr": "multimodal",
}

# ── Per-tier degrade path ──
# If a tier's model fails (quota/rate-limit/outage), try the next tier on the
# same provider, cheapest-capable first. Every chain is finite and bottoms out;
# `complete` then tries the Gemini fallback as a final safety net.
FALLBACK_CHAIN = {
    "complex": ["complex", "fast", "bulk"],
    "fast": ["fast", "bulk", "trivial"],
    "bulk": ["bulk", "trivial"],
    "trivial": ["trivial"],
    "multimodal": ["multimodal", "fast"],
}

# Error fingerprints that mean "this model is unavailable, try the next one"
# rather than "the request itself is broken" (which should surface, not retry).
_RETRYABLE_MARKERS = (
    "quota", "rate limit", "rate_limit", "ratelimit", "429",
    "billing", "insufficient", "overloaded", "unavailable",
    "503", "502", "500", "timeout", "timed out", "capacity",
)


def _using_openrouter(settings) -> bool:
    return settings.llm_provider == "openrouter" and bool(settings.openrouter_api_key)


def _openrouter_client(settings) -> OpenAI:
    return OpenAI(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        default_headers={
            # OpenRouter attribution headers (optional but recommended).
            "HTTP-Referer": "https://ellie.vercel.app",
            "X-Title": "ELLIE Hub",
        },
    )


def _gemini_client(settings) -> OpenAI:
    return OpenAI(
        api_key=settings.gemini_api_key,
        base_url=settings.gemini_base_url,
    )


def route_task(task: str) -> str:
    """Map a semantic task name to a capability tier."""
    return TASK_ROUTES.get(task, DEFAULT_TIER)


def get_model_client(tier: str = DEFAULT_TIER):
    """Return (client, model_id) for a task tier.

    Picks OpenRouter when configured, otherwise falls back to Gemini so ELLIE
    never goes dark just because an OpenRouter key isn't set yet.
    """
    settings = get_settings()

    if _using_openrouter(settings):
        field = _TIER_FIELDS.get(tier, _TIER_FIELDS[DEFAULT_TIER])
        return _openrouter_client(settings), getattr(settings, field)

    # Fallback: Gemini via its OpenAI-compatible endpoint.
    return _gemini_client(settings), settings.gemini_model


def _is_retryable(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(marker in msg for marker in _RETRYABLE_MARKERS)


def complete(task: str = None, *, tier: str = None, messages: list,
             max_tokens: int = 1000, **kwargs) -> str:
    """Route a task to a model and run the chat completion, with fallback.

    Pass either a semantic `task` (preferred — routed via TASK_ROUTES) or an
    explicit `tier`. On a retryable failure (quota/rate-limit/outage) the call
    degrades down the tier's FALLBACK_CHAIN, then to Gemini as a last resort.

    Returns the assistant message text. Raises the last error only if every
    candidate (including Gemini) fails with a non-retryable error, or all
    candidates are exhausted.
    """
    settings = get_settings()

    if tier is None:
        tier = route_task(task) if task else DEFAULT_TIER

    # Build the ordered list of OpenRouter tiers to attempt.
    if _using_openrouter(settings):
        tiers = FALLBACK_CHAIN.get(tier, [tier])
        attempts = [("openrouter", t, getattr(settings, _TIER_FIELDS[t])) for t in tiers]
        # Final safety net: Gemini, if a key exists.
        if settings.gemini_api_key:
            attempts.append(("gemini", "fallback", settings.gemini_model))
    else:
        attempts = [("gemini", "fallback", settings.gemini_model)]

    last_exc = None
    for provider, attempt_tier, model in attempts:
        client = _openrouter_client(settings) if provider == "openrouter" else _gemini_client(settings)
        try:
            resp = client.chat.completions.create(
                model=model, max_tokens=max_tokens, messages=messages, **kwargs
            )
            if attempt_tier != tier:
                logger.warning(
                    "model_router: task=%s tier=%s fell back to %s/%s (%s)",
                    task, tier, provider, attempt_tier, model,
                )
            else:
                logger.info("model_router: task=%s tier=%s -> %s/%s", task, tier, provider, model)
            return resp.choices[0].message.content
        except Exception as e:  # noqa: BLE001 — we classify below
            last_exc = e
            if _is_retryable(e):
                logger.warning(
                    "model_router: %s/%s (%s) unavailable, trying next — %s",
                    provider, attempt_tier, model, e,
                )
                continue
            # Non-retryable (bad request, auth, etc.) — surface immediately.
            raise

    # Exhausted every candidate on retryable errors.
    raise last_exc if last_exc else RuntimeError("model_router: no model candidates available")


def active_provider() -> str:
    """'openrouter' or 'gemini' — whichever is currently in effect."""
    return "openrouter" if _using_openrouter(get_settings()) else "gemini"
