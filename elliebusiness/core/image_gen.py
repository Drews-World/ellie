"""
Image generation client — OpenAI direct (GPT Image 2).
No OpenRouter equivalent today; must use OpenAI directly.
"""
from __future__ import annotations

import base64
import httpx

from openai import OpenAI

from .config import get_settings


def get_image_client() -> OpenAI:
    s = get_settings()
    if not s.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY not set. GPT Image 2 requires a direct OpenAI key."
        )
    return OpenAI(api_key=s.openai_api_key)


def generate_image(prompt: str, size: str = "1024x1024") -> bytes:
    """Generate one image and return raw PNG bytes."""
    s = get_settings()
    client = get_image_client()

    response = client.images.generate(
        model=s.image_gen_model,
        prompt=prompt,
        n=1,
        size=size,
        response_format="b64_json",
    )

    b64 = response.data[0].b64_json
    return base64.b64decode(b64)


def generate_images(prompts: list[str], size: str = "1024x1024") -> list[bytes]:
    """Generate multiple images (sequential — rate limit aware)."""
    return [generate_image(p, size) for p in prompts]
