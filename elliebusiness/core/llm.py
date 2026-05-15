"""
LLM client factory.

Priority: OpenRouter (production) → Gemini (free fallback).
Both speak the OpenAI-compat protocol, so callers use the same interface.
"""
from __future__ import annotations

from openai import OpenAI

from .config import get_settings


def get_llm_client(fast: bool = False) -> tuple[OpenAI, str]:
    """Return (client, model_name).

    fast=True picks the cheaper/faster model (for Nova classification, scoring).
    fast=False picks the creative model (for Forge prompt generation, Etsy copy).
    """
    s = get_settings()

    if s.openrouter_api_key:
        client = OpenAI(
            api_key=s.openrouter_api_key,
            base_url=s.openrouter_base_url,
        )
        model = s.openrouter_fast_model if fast else s.openrouter_model
        return client, model

    if s.gemini_api_key:
        client = OpenAI(
            api_key=s.gemini_api_key,
            base_url=s.gemini_base_url,
        )
        return client, s.gemini_model

    raise RuntimeError(
        "No LLM key configured. Set OPENROUTER_API_KEY (production) "
        "or GEMINI_API_KEY (free fallback) in .env"
    )


def complete(prompt: str, system: str = "", fast: bool = False, json_mode: bool = False) -> str:
    """One-shot text completion. Returns the response string."""
    client, model = get_llm_client(fast=fast)
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    kwargs: dict = {"model": model, "messages": messages, "max_tokens": 2000}
    # json_object response_format only works on some OpenAI models; Claude/Gemini ignore or
    # error on it — we rely on the system prompt instruction instead.
    if json_mode and "openai/" in model:
        kwargs["response_format"] = {"type": "json_object"}

    resp = client.chat.completions.create(**kwargs)
    return resp.choices[0].message.content or ""
