import httpx
import json
import anthropic
from datetime import datetime, timedelta
from core.config import get_settings
from core.database import get_supabase

CACHE_TTL_MINUTES = {
    "news": 15,
    "markets": 5,
    "crypto": 5,
    "weather": 30,
    "sports": 2,
    "threat-matrix": 60,
}

async def get_cached_or_fetch(cache_key: str, fetch_fn, ttl_minutes: int = 15):
    """Check Supabase cache, return fresh data or fetch new."""
    supabase = get_supabase()

    try:
        result = supabase.table("world_cache").select("*").eq("cache_key", cache_key).single().execute()
        if result.data:
            fetched = datetime.fromisoformat(result.data["fetched_at"].replace("Z", "+00:00"))
            if datetime.now().astimezone() - fetched < timedelta(minutes=ttl_minutes):
                return result.data["data"]
    except Exception:
        pass

    # Fetch fresh data
    data = await fetch_fn()

    # Upsert cache
    try:
        supabase.table("world_cache").upsert({
            "cache_key": cache_key,
            "data": data,
            "fetched_at": datetime.utcnow().isoformat()
        }).execute()
    except Exception:
        pass

    return data


async def fetch_news(category: str = "general") -> dict:
    settings = get_settings()
    cache_key = f"news_{category}"

    async def _fetch():
        if not settings.news_api_key:
            return {"articles": [], "status": "no_api_key"}
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://newsapi.org/v2/top-headlines",
                params={"category": category, "language": "en", "pageSize": 20},
                headers={"X-Api-Key": settings.news_api_key},
                timeout=10
            )
            return r.json()

    return await get_cached_or_fetch(cache_key, _fetch, CACHE_TTL_MINUTES["news"])


async def fetch_markets() -> dict:
    settings = get_settings()

    async def _fetch():
        if not settings.polygon_api_key:
            return {"tickers": [], "status": "no_api_key"}
        symbols = ["SPY", "AAPL", "NVDA", "TSLA", "AMZN", "MSFT", "GOOGL", "META"]
        async with httpx.AsyncClient() as client:
            results = {}
            for sym in symbols:
                try:
                    r = await client.get(
                        f"https://api.polygon.io/v2/aggs/ticker/{sym}/prev",
                        params={"apiKey": settings.polygon_api_key},
                        timeout=10
                    )
                    data = r.json()
                    if data.get("results"):
                        results[sym] = data["results"][0]
                except Exception:
                    pass
            return {"tickers": results}

    return await get_cached_or_fetch("markets", _fetch, CACHE_TTL_MINUTES["markets"])


async def fetch_crypto() -> dict:
    async def _fetch():
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={
                    "ids": "bitcoin,ethereum,solana,cardano",
                    "vs_currencies": "usd",
                    "include_24hr_change": "true",
                    "include_market_cap": "true"
                },
                timeout=10
            )
            # Also get gold price
            gold = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": "tether-gold", "vs_currencies": "usd", "include_24hr_change": "true"},
                timeout=10
            )
            data = r.json()
            data.update(gold.json())
            return data

    return await get_cached_or_fetch("crypto", _fetch, CACHE_TTL_MINUTES["crypto"])


async def fetch_weather(cities: list[str]) -> dict:
    settings = get_settings()

    async def _fetch():
        if not settings.openweather_api_key:
            return {"cities": {}, "status": "no_api_key"}
        results = {}
        async with httpx.AsyncClient() as client:
            for city in cities:
                try:
                    r = await client.get(
                        "https://api.openweathermap.org/data/2.5/weather",
                        params={"q": city, "appid": settings.openweather_api_key, "units": "imperial"},
                        timeout=10
                    )
                    results[city] = r.json()
                except Exception:
                    pass
        return {"cities": results}

    cache_key = f"weather_{'_'.join(sorted(cities))}"
    return await get_cached_or_fetch(cache_key, _fetch, CACHE_TTL_MINUTES["weather"])


async def fetch_sports(leagues: list[str]) -> dict:
    """
    Uses ESPN's unofficial API endpoints.
    These are public and don't require a key.
    """
    ESPN_ENDPOINTS = {
        "nba":  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
        "nfl":  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
        "mlb":  "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
        "nhl":  "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
    }

    async def _fetch():
        results = {}
        async with httpx.AsyncClient() as client:
            for league in leagues:
                url = ESPN_ENDPOINTS.get(league.lower())
                if not url:
                    continue
                try:
                    r = await client.get(url, timeout=10)
                    results[league] = r.json()
                except Exception:
                    pass
        return results

    cache_key = f"sports_{'_'.join(sorted(leagues))}"
    return await get_cached_or_fetch(cache_key, _fetch, CACHE_TTL_MINUTES["sports"])


async def fetch_zone_intel(zone_id: str, zone_name: str, keywords: list[str]) -> dict:
    """
    Fetch real-time news for a specific conflict/threat zone and run
    a Claude threat assessment against the articles.

    Sources (in priority order):
      1. NewsAPI /everything  — targeted keyword search (requires news_api_key)
      2. GDELT Doc API        — free, no key, real-time geopolitical events
    """
    settings  = get_settings()
    cache_key = f"zone_intel_{zone_id}"

    async def _fetch():
        articles: list[dict] = []

        # ── 1. NewsAPI /everything ──────────────────────────────────────────
        if settings.news_api_key:
            q = " OR ".join(f'"{kw}"' for kw in keywords[:5])
            since = (datetime.utcnow() - timedelta(days=5)).strftime("%Y-%m-%d")
            try:
                async with httpx.AsyncClient(timeout=12) as client:
                    r = await client.get(
                        "https://newsapi.org/v2/everything",
                        params={
                            "q":        q,
                            "language": "en",
                            "sortBy":   "publishedAt",
                            "pageSize": 12,
                            "from":     since,
                        },
                        headers={"X-Api-Key": settings.news_api_key},
                    )
                    data = r.json()
                    articles = [
                        a for a in data.get("articles", [])
                        if a.get("title") and "[Removed]" not in a.get("title", "")
                    ]
            except Exception:
                pass

        # ── 2. GDELT fallback (free, no key) ────────────────────────────────
        if not articles:
            q_gdelt = " OR ".join(keywords[:4])
            try:
                async with httpx.AsyncClient(timeout=12) as client:
                    r = await client.get(
                        "https://api.gdeltproject.org/api/v2/doc/doc",
                        params={
                            "query":      q_gdelt,
                            "mode":       "ArtList",
                            "maxrecords": 12,
                            "format":     "json",
                            "timespan":   "5days",
                        },
                    )
                    data = r.json()
                    raw = data.get("articles") or []
                    articles = [
                        {
                            "title":       a.get("title", ""),
                            "description": "",
                            "url":         a.get("url", ""),
                            "urlToImage":  a.get("socialimage"),
                            "source":      {"name": a.get("domain", "Unknown").replace("www.", "")},
                            "publishedAt": a.get("seendate", ""),
                        }
                        for a in raw
                        if a.get("title") and a.get("url")
                    ]
            except Exception:
                pass

        # ── 3. Claude threat assessment ──────────────────────────────────────
        assessment      = None
        threat_level    = None
        key_developments: list[str] = []

        if articles and settings.anthropic_api_key:
            headlines = "\n".join([
                f"- {a['title']}  [{a.get('source', {}).get('name', '')}]"
                for a in articles[:10]
            ])
            prompt = f"""You are ELLIE, an executive intelligence analyst. Based on these recent news headlines about {zone_name}, provide a concise intelligence assessment.

Headlines:
{headlines}

Respond ONLY with valid JSON (no markdown, no extra text):
{{
  "threat_level": "critical|elevated|moderate|low",
  "assessment": "2-3 sentence situation summary focused on the threat",
  "key_developments": ["development 1", "development 2", "development 3"]
}}

Base threat_level on actual current conditions: critical = active armed conflict/imminent attack, elevated = heightened tensions/recent incidents, moderate = ongoing instability, low = stable."""

            try:
                ai = anthropic.Anthropic(api_key=settings.anthropic_api_key)
                msg = ai.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=400,
                    messages=[{"role": "user", "content": prompt}],
                )
                text = msg.content[0].text.strip()
                # Extract JSON block
                start = text.find("{")
                end   = text.rfind("}") + 1
                if start != -1 and end > start:
                    parsed = json.loads(text[start:end])
                    threat_level     = parsed.get("threat_level")
                    assessment       = parsed.get("assessment")
                    key_developments = parsed.get("key_developments", [])
            except Exception:
                pass

        return {
            "zone_id":          zone_id,
            "zone_name":        zone_name,
            "articles":         articles[:8],
            "assessment":       assessment,
            "threat_level":     threat_level,
            "key_developments": key_developments,
            "article_count":    len(articles),
            "fetched_at":       datetime.utcnow().isoformat(),
        }

    return await get_cached_or_fetch(cache_key, _fetch, 30)  # 30-min cache


async def fetch_threat_matrix() -> dict:
    """
    Threat matrix scores — computed from news sentiment + geopolitical indicators.
    For now returns a curated static model; hook into GDELT or similar for full dynamic version.
    """
    async def _fetch():
        return {
            "geopolitical": {"score": 72, "level": "elevated", "key_regions": ["Eastern Europe", "Middle East", "South China Sea"]},
            "economic":     {"score": 55, "level": "moderate", "key_factors": ["Fed rates", "inflation", "supply chains"]},
            "cyber":        {"score": 48, "level": "moderate", "key_factors": ["state actors", "ransomware", "critical infrastructure"]},
            "climate":      {"score": 61, "level": "elevated", "key_factors": ["extreme weather events", "drought", "sea level"]},
            "health":       {"score": 28, "level": "low",      "key_factors": ["no active global threat"]},
            "updated_at":   datetime.utcnow().isoformat()
        }

    return await get_cached_or_fetch("threat-matrix", _fetch, CACHE_TTL_MINUTES["threat-matrix"])
