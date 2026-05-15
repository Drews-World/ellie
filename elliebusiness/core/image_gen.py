"""
Image generation — OpenAI direct required (DALL-E 3 or GPT Image 2).
OpenRouter does not proxy image generation endpoints.
Set OPENAI_API_KEY in .env to activate Forge image generation.
"""
from __future__ import annotations

import base64
from openai import OpenAI
from .config import get_settings


def _get_client() -> tuple[OpenAI, str]:
    s = get_settings()
    if not s.openai_api_key:
        raise RuntimeError(
            "Image generation requires OPENAI_API_KEY in .env — "
            "OpenRouter does not support image generation. "
            "Get a key at platform.openai.com (DALL-E 3 costs ~$0.04/image)."
        )
    return OpenAI(api_key=s.openai_api_key), s.image_gen_model


def generate_image(prompt: str, size: str = "1024x1024") -> bytes:
    client, model = _get_client()
    response = client.images.generate(
        model=model,
        prompt=prompt,
        n=1,
        size=size,
        response_format="b64_json",
    )
    return base64.b64decode(response.data[0].b64_json)


def generate_images(prompts: list[str], size: str = "1024x1024") -> list[bytes]:
    return [generate_image(p, size) for p in prompts]
