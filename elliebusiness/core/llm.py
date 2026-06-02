"""
LLM client + model-router for the Business Factory crew.

Priority: OpenRouter (production) → Gemini (free fallback).
Both speak the OpenAI-compat protocol, so callers use the same interface.

Two ways to call `complete`:

  • Legacy boolean — `complete(prompt, fast=True)`:
        fast=False → creative/reasoning model (Forge copy, ELLIE planning)
        fast=True  → cheap/fast model (Nova classification, scoring)

  • Semantic task — `complete(prompt, task="screen")` (preferred):
        the caller says *what the work is* and the router picks the tier.
        Unknown tasks fall back to the `fast` boolean's tier.

Either way the call now degrades down a FALLBACK_CHAIN on a retryable error
(quota / rate-limit / outage), then to Gemini as a last resort — so a single
model's 429 no longer takes the whole pipeline down. This mirrors the brain's
own router in webapp/backend/services/model_router.py so the business floor
reasons on the same routing policy as the rest of ELLIE.
"""
from __future__ import annotations

import logging

from openai import OpenAI

from .config import get_settings

logger = logging.getLogger("ellie.business.llm")

# ── Capability tiers → which settings model id serves them ────────────────────
# elliebusiness only configures two OpenRouter models (creative + fast) plus
# Gemini, so the cheaper tiers share the fast model. The tier names still matter:
# they define the FALLBACK_CHAIN degrade order.
def _tier_model(tier: str, s) -> str:
    return {
        "complex": s.openrouter_model,
        "fast": s.openrouter_fast_model,
        "bulk": s.openrouter_fast_model,
        "trivial": s.openrouter_fast_model,
    }.get(tier, s.openrouter_model)


DEFAULT_TIER = "fast"

# ── Semantic task → tier ──
# Route by what the work is. Add a row here rather than hardcoding tiers at call
# sites. Unknown tasks fall through to the caller's `fast` boolean.
TASK_ROUTES = {
    # complex — planning, decisions, creative copy: worth the better model
    "decision": "complex",
    "reason": "complex",
    "plan": "complex",
    "design_copy": "complex",
    "strategy": "complex",
    "listing_copy": "complex",
    # fast — interactive / lightweight generation
    "chat": "fast",
    "quick_analysis": "fast",
    "ideate": "fast",
    "score": "fast",
    # bulk — routine high-volume synthesis
    "screen": "bulk",
    "summarize": "bulk",
    "research": "bulk",
    "digest": "bulk",
    # trivial — cheap structured calls
    "classify": "trivial",
    "tag": "trivial",
    "extract": "trivial",
}

# ── Per-tier degrade path on failure ──
FALLBACK_CHAIN = {
    "complex": ["complex", "fast"],
    "fast": ["fast", "bulk"],
    "bulk": ["bulk", "fast"],
    "trivial": ["trivial", "fast"],
}

# Error fingerprints meaning "this model is unavailable, try the next" rather
# than "the request is broken" (which should surface, not silently retry).
_RETRYABLE_MARKERS = (
    "quota", "rate limit", "rate_limit", "ratelimit", "429",
    "billing", "insufficient", "overloaded", "unavailable",
    "503", "502", "500", "timeout", "timed out", "capacity",
)


def route_task(task: str | None, fast: bool) -> str:
    """Map a semantic task → tier. Falls back to the `fast` boolean's tier."""
    if task and task in TASK_ROUTES:
        return TASK_ROUTES[task]
    return "fast" if fast else "complex"


def _openrouter_client(s) -> OpenAI:
    return OpenAI(
        api_key=s.openrouter_api_key,
        base_url=s.openrouter_base_url,
        default_headers={"HTTP-Referer": "https://ellie.vercel.app", "X-Title": "ELLIE Business"},
    )


def _gemini_client(s) -> OpenAI:
    return OpenAI(api_key=s.gemini_api_key, base_url=s.gemini_base_url)


def get_llm_client(fast: bool = False) -> tuple[OpenAI, str]:
    """Return (client, model_name). Kept for backward compatibility.

    fast=True picks the cheaper/faster model; fast=False the creative model.
    """
    s = get_settings()
    if s.openrouter_api_key:
        tier = "fast" if fast else "complex"
        return _openrouter_client(s), _tier_model(tier, s)
    if s.gemini_api_key:
        return _gemini_client(s), s.gemini_model
    raise RuntimeError(
        "No LLM key configured. Set OPENROUTER_API_KEY (production) "
        "or GEMINI_API_KEY (free fallback) in .env"
    )


def _is_retryable(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(marker in msg for marker in _RETRYABLE_MARKERS)


def _build_attempts(tier: str, s) -> list[tuple[str, str, str]]:
    """Ordered (provider, tier, model) list: OpenRouter degrade chain + Gemini."""
    attempts: list[tuple[str, str, str]] = []
    if s.openrouter_api_key:
        seen: set[str] = set()
        for t in FALLBACK_CHAIN.get(tier, [tier]):
            model = _tier_model(t, s)
            if model in seen:  # fast/bulk/trivial share a model — don't retry it
                continue
            seen.add(model)
            attempts.append(("openrouter", t, model))
    if s.gemini_api_key:
        attempts.append(("gemini", "fallback", s.gemini_model))
    if not attempts:
        raise RuntimeError(
            "No LLM key configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY in .env"
        )
    return attempts


def complete(
    prompt: str,
    system: str = "",
    fast: bool = False,
    json_mode: bool = False,
    task: str | None = None,
) -> str:
    """One-shot text completion with task routing + fallback. Returns the text.

    Pass a semantic `task` (preferred) or rely on the `fast` boolean. On a
    retryable failure the call degrades down the tier's FALLBACK_CHAIN, then to
    Gemini, so a single model's quota/outage doesn't break the pipeline.
    """
    s = get_settings()
    tier = route_task(task, fast)
    attempts = _build_attempts(tier, s)

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    last_exc: Exception | None = None
    for provider, attempt_tier, model in attempts:
        client = _openrouter_client(s) if provider == "openrouter" else _gemini_client(s)
        kwargs: dict = {"model": model, "messages": messages, "max_tokens": 2000}
        # json_object response_format only works on some OpenAI models; Claude/
        # Gemini ignore or error on it — we rely on the system prompt instead.
        if json_mode and "openai/" in model:
            kwargs["response_format"] = {"type": "json_object"}
        try:
            resp = client.chat.completions.create(**kwargs)
            if attempt_tier != tier:
                logger.warning("llm: task=%s tier=%s fell back to %s/%s (%s)",
                               task, tier, provider, attempt_tier, model)
            else:
                logger.info("llm: task=%s tier=%s -> %s/%s", task, tier, provider, model)
            return resp.choices[0].message.content or ""
        except Exception as e:  # noqa: BLE001 — classified below
            last_exc = e
            if _is_retryable(e):
                logger.warning("llm: %s/%s (%s) unavailable, trying next — %s",
                               provider, attempt_tier, model, e)
                continue
            raise  # non-retryable (bad request / auth) — surface immediately

    raise last_exc if last_exc else RuntimeError("llm: no model candidates available")
