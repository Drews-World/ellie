from openai import OpenAI
from core.config import get_settings

ELLIE_SYSTEM = """You are ELLIE — Executive Life Logic Intelligence Engine.
You are the personal AI system built exclusively for Drew.
Drew is a software engineer at Amazon, co-founder of Quill Learning (EdTech startup),
builder of The Parking Lot streetball league, Christian, basketball player, and musician.
You are crisp, confident, analytical, and occasionally wry.
You never pad responses. You use bold text (**label**) for category/sector labels.
Keep responses under 400 words. Always sign off with "— ELLIE"."""

WIDGET_PROMPTS = {
    "world-news": "Give a sharp classified-style intelligence brief on the top global events right now — geopolitical tensions, economic developments, scientific breakthroughs, political shifts. Bold sector labels. No filler.",
    "threat-monitor": "Provide a detailed threat landscape breakdown: Geopolitical (72%), Economic (55%), Cyber (48%), Climate (61%), Health (28%). Key drivers, actors, near-term risk outlook per sector. Write like a classified threat assessment.",
    "weather": "Global atmospheric briefing. Cover major weather events worldwide — severe storms, unusual patterns, extremes. Focus on Pacific Northwest (Seattle) first since that's home base, then expand globally.",
    "world-map": "Full global situation report: Eastern Europe, Middle East, South China Sea, West Africa, major financial hubs. 2-3 sentence intelligence snapshot per zone — what's happening, why it matters, what to watch.",
    "stocks": "Sharp market briefing: S&P 500 momentum, key movers (AAPL, NVDA, TSLA, AMZN), Fed stance implications, sector rotation, key data points this week. Goldman Sachs morning brief energy.",
    "sports": "Full sports rundown: NBA playoff picture and live games (Drew is a basketball guy — go deep), MLB storylines, major sports news, weekend matchups to watch.",
    "crypto": "Crypto market brief: Bitcoin momentum, Ethereum ecosystem, Solana position, gold drivers, macro conditions for risk assets. Include major DeFi or protocol news. Crypto desk morning note style.",
    "racing": "F1 2025 season briefing: championship standings, constructors race, standout performances, controversies, team dynamics, upcoming calendar. Paddock analyst energy — technical and insightful.",
    "system": "Full ELLIE self-status report. Reference your full name and acronym. Report all monitoring feeds, confirm systems optimal, brief rundown of most important situations globally. Witty but informative. End with personalized sign-off for Drew.",
    "calendar": "Review Drew's upcoming schedule and give a smart briefing — what's coming up, what needs prep, what should he be thinking about. Personal assistant energy.",
    "reminders": "Review Drew's pending reminders and give a priority-ordered briefing — what's most urgent, what might he be forgetting, any patterns you notice.",
    "goals": "Review Drew's active goals and give an honest assessment — what's on track, what needs attention, what quick wins can move the needle today.",
    "personal-brief": "Give Drew a full personal daily brief — synthesize his calendar, reminders, goals, and anything notable in the world that intersects with his life. Start his day strong.",
    "prayer": "Review Drew's active prayer items and give a thoughtful, faith-centered reflection — what patterns do you notice, what areas of life are being lifted up, any encouragement or scripture that fits.",
    "satellite": "Give a geographic intelligence summary — key hotspots worth monitoring from a satellite perspective: troop movements, environmental changes, infrastructure at risk, disaster zones.",
}

def _get_client():
    settings = get_settings()
    return OpenAI(
        api_key=settings.gemini_api_key,
        base_url=settings.gemini_base_url,
    )

async def get_ellie_brief(widget: str, context: dict = {}) -> str:
    settings = get_settings()
    client = _get_client()

    base_prompt = WIDGET_PROMPTS.get(widget, f"Give an intelligence brief on: {widget}")
    prompt = base_prompt + ("\n\nContext data:\n" + str(context) if context else "")

    try:
        response = client.chat.completions.create(
            model=settings.gemini_model,
            max_tokens=1000,
            messages=[
                {"role": "system", "content": ELLIE_SYSTEM},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content
    except Exception as e:
        err = str(e)
        if "quota" in err.lower() or "billing" in err.lower() or "429" in err:
            return "**⚠ ELLIE OFFLINE** — Gemini API quota exceeded. Check Google AI Studio. — ELLIE"
        raise


async def ellie_chat(messages: list, context: dict = {}) -> str:
    settings = get_settings()
    client = _get_client()

    system = ELLIE_SYSTEM
    if context:
        system += f"\n\nCurrent context about Drew: {context}"

    system += """

INTELLIGENCE DIRECTIVES:
- Pattern Recognition: If you notice behavioral patterns (e.g. Drew has missed the gym multiple times before late standups), surface them proactively.
- Cross-Domain Connections: Actively connect dots between Drew's world — if a Fed rate decision affects Quill's fundraising runway, say so.
- Proactive Alerts: If something in Drew's context warrants urgent attention, lead with it rather than waiting to be asked.
- Stay concise. Surface the insight, not the reasoning."""

    formatted = [{"role": m["role"], "content": m["content"]} for m in messages]

    try:
        response = client.chat.completions.create(
            model=settings.gemini_model,
            max_tokens=1000,
            messages=[{"role": "system", "content": system}, *formatted],
        )
        return response.choices[0].message.content
    except Exception as e:
        err = str(e)
        if "quota" in err.lower() or "429" in err:
            return "**⚠ ELLIE OFFLINE** — Gemini API quota exceeded. Check Google AI Studio dashboard. — ELLIE"
        if "api_key" in err.lower() or "authentication" in err.lower():
            return "**⚠ ELLIE OFFLINE** — Invalid Gemini API key. Update GEMINI_API_KEY in backend/.env. — ELLIE"
        raise
