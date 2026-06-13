import json
import logging
import re as _re

from services.model_router import complete, get_model_client
from services.ellie_tools import TOOLS, dispatch_tool
from services.ellie_memory import (
    MEMORY_TOOLS,
    MEMORY_TOOL_NAMES,
    dispatch_memory_tool,
    format_memories,
    load_memories,
)

logger = logging.getLogger("ellie.chat")

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

async def get_ellie_brief(widget: str, context: dict = {}) -> str:
    # Widget briefs are routine summarization → "brief" task (bulk tier).
    base_prompt = WIDGET_PROMPTS.get(widget, f"Give an intelligence brief on: {widget}")
    prompt = base_prompt + ("\n\nContext data:\n" + str(context) if context else "")

    try:
        return complete(
            "brief",
            max_tokens=1000,
            messages=[
                {"role": "system", "content": ELLIE_SYSTEM},
                {"role": "user", "content": prompt},
            ],
        )
    except Exception as e:
        err = str(e)
        if "quota" in err.lower() or "billing" in err.lower() or "429" in err:
            return "**⚠ ELLIE OFFLINE** — model provider quota exceeded. Check your OpenRouter / Gemini billing. — ELLIE"
        raise


CHAT_DIRECTIVES = """

YOU HAVE LIVE TOOLS. You are not a generic assistant — you are the brain of
Drew's whole operation, with direct read access to every floor of the Hub:
- The Etsy print-on-demand business (agent crew, pipeline, designs, realized sales, spend)
- The autonomous trading fund (account, positions, P&L)
- Drew's business registry (Quill Learning, The Parking Lot, and the above)

When Drew asks anything about his businesses, sales, money, designs, the pipeline,
or the trading fund — CALL THE RELEVANT TOOL and answer with the real numbers.
Never say "no data" or "I don't have access" without first calling a tool. For a
broad "how are my businesses doing" question, call list_businesses, then the live
tool for each venture, and synthesize one cohesive briefing.

YOU CAN ACT ON THE TRADING FUND — you are not read-only there. The fund runs on a
paper Alpaca account, so you have authority to execute when Drew tells you to:
- To buy or sell a specific ticker now ("get some SPCX", "sell half my NVDA"):
  call get_trading_status first to see cash/buying power, size the order sensibly
  if Drew didn't give a size, then call place_trade, and confirm the fill with
  get_recent_orders. Report what you actually did with the real order details.
- To "get the agents working" / "put the fund to work": call launch_fund_cycle
  (discover → analyze → buy) or trigger_fund_review to re-evaluate holdings.
- To make the fund aware of an IPO/earnings/event: call scan_catalysts.
- To stop or restart the fund: call set_fund_paused.
NEVER tell Drew you "can't place orders" or "have no execution capability" — you
do. Just act, then report. If an order is large or ambiguous, place a sensible
size and say what you chose, rather than refusing.

LONG-TERM MEMORY: You also have a persistent memory store — the facts you keep
about Drew across every conversation.
- When Drew states a durable preference, decision, business fact, or correction
  worth knowing forever ("I hate X", "always do Y", "Quill's runway target is Z"),
  call save_memory with one clean self-contained sentence. Don't ask permission.
- When a memory in your list turns out to be wrong or outdated, call update_memory
  (or delete_memory) using that memory's id.
- Never store secrets (passwords, keys) or one-off conversational trivia.

INTELLIGENCE DIRECTIVES:
- Pattern Recognition: surface behavioral patterns proactively.
- Cross-Domain Connections: connect dots across Drew's world (e.g. if a Fed move affects Quill's runway, say so).
- Proactive Alerts: lead with anything urgent rather than waiting to be asked.
- Stay concise. Surface the insight, not the reasoning."""

# Used only on the degraded (no-tools) path: a confused model must not invent
# business metrics. Better to admit the floor is unreachable than to fabricate.
NO_DATA_GUARD = """

IMPORTANT: Your live data tools are currently UNAVAILABLE. You must NOT invent or
estimate any business numbers (sales, revenue, units, positions, P&L, spend). If
Drew asks for figures you can't retrieve, say plainly that the live data floor is
unreachable right now and offer to try again — never make numbers up."""

# Cap tool-calling rounds so a confused model can't loop forever.
_MAX_TOOL_ROUNDS = 5

# A "stub" is a non-answer we should retry instead of serving: the model
# narrating intent ("I'll call the tool…") and stopping, a fake [placeholder]
# template instead of real tool data, or essentially-empty (just the signoff).
_STUB_RE = _re.compile(
    r"\b(i['’]?ll|i will|let me|i need to|i['’]?m going to|allow me to)\b"
    r".{0,50}?\b(call|check|retrieve|query|use|pull|look up|fetch|get|access)\b",
    _re.IGNORECASE,
)
# Bracketed placeholders the model writes when it templates instead of calling tools.
_PLACEHOLDER_RE = _re.compile(r"\[[A-Za-z][^\]]{2,40}\]")
_SIGNOFF_RE = _re.compile(r"[—\-–]\s*ELLIE\s*$")


def _looks_like_stub(text: str) -> bool:
    t = (text or "").strip()
    # Essentially-empty: nothing left once the signoff is stripped.
    body = _SIGNOFF_RE.sub("", t).strip()
    if len(body) < 12:
        return True
    # Fake template: bracketed placeholders instead of real tool data.
    if _PLACEHOLDER_RE.search(t):
        return True
    # Short narration-of-intent that never delivered.
    if len(t) <= 400 and _STUB_RE.search(t):
        return True
    return False


async def ellie_chat(messages: list, context: dict = {}, user_id: str | None = None) -> str:
    # Interactive conversation with live tool access → "the cohesive brain".
    system = ELLIE_SYSTEM
    if context:
        system += f"\n\nCurrent context about Drew: {context}"
    system += CHAT_DIRECTIVES

    # Long-term memory: everything ELLIE has saved about Drew, every conversation.
    memories = load_memories(user_id) if user_id else []
    if memories:
        system += (
            "\n\nWHAT YOU CURRENTLY REMEMBER ABOUT DREW (long-term memory):\n"
            + format_memories(memories)
        )

    formatted = [{"role": m["role"], "content": m["content"]} for m in messages]
    convo = [{"role": "system", "content": system}, *formatted]

    try:
        return await _chat_with_tools(convo, user_id)
    except Exception as e:
        err = str(e)
        if "quota" in err.lower() or "429" in err:
            return "**⚠ ELLIE OFFLINE** — model provider quota exceeded. Check your OpenRouter / Gemini billing. — ELLIE"
        if "api_key" in err.lower() or "authentication" in err.lower():
            return "**⚠ ELLIE OFFLINE** — invalid model provider key. Update OPENROUTER_API_KEY (or GEMINI_API_KEY) in backend/.env. — ELLIE"
        # Tool-calling can fail on providers/models that don't support it. Fall
        # back to a plain completion so the chat still answers — but HARD-FORBID
        # inventing data, since a hallucinated revenue figure is worse than an
        # honest "the floor is unreachable".
        logger.warning("ellie_chat tool loop failed (%s); falling back to plain completion", e)
        safe_convo = [
            {"role": "system", "content": ELLIE_SYSTEM + NO_DATA_GUARD},
            *[m for m in convo if m.get("role") in ("user", "assistant") and m.get("content")],
        ]
        try:
            return complete("chat", max_tokens=1000, messages=safe_convo)
        except Exception:
            raise


# Honest message when the model keeps returning empty (vs. a blank "— ELLIE").
_EMPTY_REPLY = "I hit a snag generating that one — mind asking again? — ELLIE"

# Floors tools + memory tools = the full tool surface of the brain.
_ALL_TOOLS = TOOLS + MEMORY_TOOLS


def _create_msg(client, model, convo, with_tools: bool):
    """One completion, retrying when the model returns an unusable message —
    no tool calls AND content that's empty or just a stub (e.g. only the
    '— ELLIE' signoff)."""
    msg = None
    for _ in range(4):
        kw = {"model": model, "messages": convo, "max_tokens": 1000}
        if with_tools:
            kw["tools"] = _ALL_TOOLS
            kw["tool_choice"] = "auto"
        msg = client.chat.completions.create(**kw).choices[0].message
        if getattr(msg, "tool_calls", None):
            return msg
        content = (msg.content or "").strip()
        if content and not _looks_like_stub(content):
            return msg
        logger.info("empty/stub completion, retrying")
    return msg


def _final_text(msg) -> str:
    """Extract a real answer from a message, or the honest snag message."""
    content = (getattr(msg, "content", None) or "").strip()
    if not content or _looks_like_stub(content):
        return _EMPTY_REPLY
    return content


async def _chat_with_tools(convo: list, user_id: str | None = None) -> str:
    """Run the brain model with function-calling, executing tools until it answers.

    Uses the `brain` tier (Claude Sonnet 4.6 via OpenRouter) — strong, reliable
    tool-calling for the floors tools and memory curation. `complete()` only
    returns text and can't surface tool_calls, so we drive the client directly.
    """
    client, model = get_model_client("brain")

    for _ in range(_MAX_TOOL_ROUNDS):
        msg = _create_msg(client, model, convo, with_tools=True)
        tool_calls = getattr(msg, "tool_calls", None)

        if not tool_calls:
            return _final_text(msg)

        # Record the assistant turn (with its tool calls) before answering them.
        convo.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in tool_calls
            ],
        })

        for tc in tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except (ValueError, TypeError):
                args = {}
            logger.info("ellie_chat: tool call %s(%s)", name, args)
            if name in MEMORY_TOOL_NAMES:
                result = await dispatch_memory_tool(name, args, user_id)
            else:
                result = await dispatch_tool(name, args)
            convo.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result, default=str)[:6000],
            })

    # Hit the round cap — ask for a final answer with whatever it has gathered.
    final = _create_msg(client, model, convo, with_tools=False)
    return _final_text(final)
