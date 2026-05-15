"""
Nova's AI news digest — weekly summary delivered to Hub activity feed.
Scrapes https://news.smol.ai (or fallback RSS) and summarises with LLM.
"""
from __future__ import annotations

import logging

import httpx

from core.llm import complete

logger = logging.getLogger(__name__)

NEWS_SOURCES = [
    "https://news.smol.ai",
    "https://tldr.tech/ai",
]

DIGEST_SYSTEM = "You are Nova. Write a concise AI news digest for Drew, an indie developer and Etsy seller. Focus on AI tools, image gen, and e-commerce AI. Be brief — 3-5 bullets."

DIGEST_PROMPT = """Here are recent AI news headlines:

{headlines}

Write a 3-5 bullet weekly digest. Each bullet: one line, most relevant news first.
Format: • [topic] — key takeaway"""


def fetch_headlines(limit: int = 20) -> str:
    """Fetch raw text from news sources. Gracefully degrades if offline."""
    texts = []
    for url in NEWS_SOURCES:
        try:
            r = httpx.get(url, timeout=10, follow_redirects=True)
            # Grab just the first 3000 chars — enough for headline extraction
            texts.append(r.text[:3000])
        except Exception:
            continue
    return "\n\n".join(texts) if texts else ""


def generate_digest() -> str:
    """Generate weekly AI news digest. Returns formatted string."""
    raw = fetch_headlines()
    if not raw:
        return "• No news sources available this week."

    try:
        return complete(
            DIGEST_PROMPT.format(headlines=raw[:4000]),
            system=DIGEST_SYSTEM,
            fast=True,
        )
    except Exception as e:
        logger.error(f"Nova: news digest failed: {e}")
        return "• AI news digest unavailable this week."
