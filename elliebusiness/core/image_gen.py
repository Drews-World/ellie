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


# Prepended to every prompt to prevent the model generating product mockups instead of flat artwork
_FLAT_ART_PREFIX = (
    "Flat 2D print-ready artwork on a plain white background. "
    "No product mockups, no 3D renders, no mugs, no shirts, no hands, no props, no scenery behind the design. "
    "Just the design artwork itself as a clean flat file. "
)

# Product-type words stripped from prompts — they confuse the safety filter and contradict the prefix
_PRODUCT_WORDS = {
    "t-shirt", "tshirt", "t shirt", "tee", "shirt", "hoodie", "sweatshirt",
    "mug", "cup", "tumbler", "poster", "canvas", "tote bag", "tote", "pillow",
    "phone case", "sticker", "notebook", "product", "mockup",
}


def _sanitize_prompt(prompt: str) -> str:
    """Remove product-type words that trigger safety filters and contradict the flat-art prefix."""
    import re
    result = prompt
    for word in _PRODUCT_WORDS:
        result = re.sub(rf"\b{re.escape(word)}\b", "", result, flags=re.IGNORECASE)
    return re.sub(r"\s{2,}", " ", result).strip()


def generate_image(prompt: str, size: str = "1024x1024") -> bytes:
    import httpx as _httpx
    client, model = _get_client()
    full_prompt = _FLAT_ART_PREFIX + _sanitize_prompt(prompt)
    kwargs: dict = {"model": model, "prompt": full_prompt, "n": 1, "size": size}
    if model == "gpt-image-1":
        # gpt-image-1 natively supports transparent backgrounds
        kwargs["background"] = "transparent"
        kwargs["output_format"] = "png"
        kwargs["response_format"] = "b64_json"
    response = client.images.generate(**kwargs)
    item = response.data[0]
    if getattr(item, "b64_json", None):
        return base64.b64decode(item.b64_json)
    return _httpx.get(item.url, timeout=60).content


def remove_background(image_bytes: bytes) -> bytes:
    """
    Remove white background from flat 2D artwork using connected-component flood-fill.
    Labels connected near-white regions; only regions touching the image corners are
    treated as background. White elements fully enclosed by the design are preserved.
    Falls back to original bytes on any error.
    """
    try:
        from PIL import Image
        import io
        import numpy as np
        from scipy import ndimage

        img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        data = np.array(img)
        r, g, b = data[:, :, 0].astype(float), data[:, :, 1].astype(float), data[:, :, 2].astype(float)

        # Near-white mask
        near_white = (r >= 240) & (g >= 240) & (b >= 240)

        # Label connected components in the near-white region
        labeled, n_features = ndimage.label(near_white)

        h, w = labeled.shape
        # Find component IDs that touch any corner pixel
        corner_ids = {
            labeled[0, 0], labeled[0, w - 1],
            labeled[h - 1, 0], labeled[h - 1, w - 1],
        } - {0}  # 0 = not near-white

        # Background mask = only the corner-connected near-white components
        bg_mask = np.isin(labeled, list(corner_ids))

        result = data.copy()
        result[:, :, 3] = np.where(bg_mask, 0, 255)

        out = Image.fromarray(result, "RGBA")
        buf = io.BytesIO()
        out.save(buf, format="PNG")
        return buf.getvalue()
    except Exception:
        return image_bytes


def generate_images(prompts: list[str], size: str = "1024x1024") -> list[bytes]:
    return [generate_image(p, size) for p in prompts]
