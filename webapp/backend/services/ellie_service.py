import asyncio
import json
import logging
import os

from services.model_router import complete, get_model_client
from services.ellie_tools import TOOLS, dispatch_tool

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

# ── Hermes — the hosted brain ────────────────────────────────────────────────
# When Hermes is installed on this host, route chat through it: one `hermes -z`
# call runs the full agent (with the ellie-floors MCP tools) and returns the
# final answer. If Hermes is absent (e.g. local dev) or errors/times out, we
# fall back to the in-process tool-calling brain so chat never goes dark.
# Master switch. Hermes is fully installed + tooled on the host, but one-shot
# mode intermittently returns a narration stub instead of completing tool calls,
# which would degrade the chat. Keep it OFF until that's resolved; the proven
# in-process tool brain serves chat meanwhile. Flip HERMES_ENABLED=1 to promote
# Hermes to the primary brain.
HERMES_ENABLED = os.environ.get("HERMES_ENABLED", "").strip().lower() in ("1", "true", "yes", "on")
HERMES_BIN = os.environ.get("HERMES_BIN", "/home/ellie/hermes/.venv/bin/hermes")
# Sonnet is reliable at tool-calling; gpt-4o-mini drops the MCP tools.
HERMES_MODEL = os.environ.get("HERMES_MODEL", "anthropic/claude-sonnet-4.5")
HERMES_CWD = os.environ.get("HERMES_CWD", "/home/ellie/hermes")
# One-shot only loads the "cli" profile by default; name the MCP floors toolset
# explicitly so Hermes can actually see sales / trading / business tools.
HERMES_TOOLSETS = os.environ.get("HERMES_TOOLSETS", "ellie-floors")
HERMES_TIMEOUT = float(os.environ.get("HERMES_TIMEOUT", "180"))


def _build_hermes_prompt(system: str, messages: list) -> str:
    """Flatten persona + conversation into a single one-shot prompt for Hermes."""
    lines = [system, "", "--- Conversation so far ---"]
    for m in messages:
        role = str(m.get("role", "user")).upper()
        lines.append(f"{role}: {m.get('content', '')}")
    lines.append(
        "\nYou are ELLIE answering the latest USER message. CRITICAL: for any "
        "business, sales, design, pipeline, spend, or trading numbers you MUST "
        "actually CALL your ellie-floors tools and wait for their results before "
        "replying. Do NOT output 'let me check' or narrate your plan — silently "
        "run the tools, then return ONLY your final answer with the real figures. "
        "Never guess numbers. Sign off with '— ELLIE'."
    )
    return "\n".join(lines)


def _run_hermes_blocking(prompt: str) -> str | None:
    """Blocking Hermes one-shot. Runs in a thread so asyncio's subprocess
    child-watcher doesn't interfere with Hermes spawning its own MCP subprocess
    (which silently truncates the agent loop). stdin is /dev/null so Hermes
    doesn't block waiting on input."""
    import subprocess
    try:
        r = subprocess.run(
            [HERMES_BIN, "-z", prompt,
             "--provider", "openrouter", "-m", HERMES_MODEL, "-t", HERMES_TOOLSETS],
            cwd=HERMES_CWD, capture_output=True, text=True,
            timeout=HERMES_TIMEOUT, stdin=subprocess.DEVNULL,
        )
        out = (r.stdout or "").strip()
        if r.returncode == 0 and out:
            return out
        logger.warning("hermes oneshot rc=%s err=%s", r.returncode, (r.stderr or "")[:300])
    except subprocess.TimeoutExpired:
        logger.warning("hermes oneshot timed out after %ss", HERMES_TIMEOUT)
    except Exception as e:  # noqa: BLE001
        logger.warning("hermes oneshot failed: %s", e)
    return None


async def _hermes_oneshot(prompt: str) -> str | None:
    """Run Hermes in one-shot mode (off-thread); return its final answer or None."""
    if not os.path.exists(HERMES_BIN):
        return None
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _run_hermes_blocking, prompt)


async def ellie_chat(messages: list, context: dict = {}) -> str:
    # Interactive conversation with live tool access → "the cohesive brain".
    system = ELLIE_SYSTEM
    if context:
        system += f"\n\nCurrent context about Drew: {context}"
    system += CHAT_DIRECTIVES

    # Primary brain: Hermes (hosted agent with floor tools via MCP) — opt-in.
    if HERMES_ENABLED:
        answer = await _hermes_oneshot(_build_hermes_prompt(system, messages))
        if answer:
            return answer
        logger.info("ellie_chat: Hermes unavailable, using in-process tool brain")

    formatted = [{"role": m["role"], "content": m["content"]} for m in messages]
    convo = [{"role": "system", "content": system}, *formatted]

    try:
        return await _chat_with_tools(convo)
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


async def _chat_with_tools(convo: list) -> str:
    """Run the model with function-calling, executing tools until it answers.

    Uses the `fast` tier (Llama 3.3 70B) — confirmed tool-capable on the current
    OpenRouter account — for the orchestration. `complete()` only returns text
    and can't surface tool_calls, so we drive the client directly here.
    """
    client, model = get_model_client("fast")

    for _ in range(_MAX_TOOL_ROUNDS):
        resp = client.chat.completions.create(
            model=model,
            messages=convo,
            tools=TOOLS,
            tool_choice="auto",
            max_tokens=1000,
        )
        msg = resp.choices[0].message
        tool_calls = getattr(msg, "tool_calls", None)

        if not tool_calls:
            return msg.content or "— ELLIE"

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
            result = await dispatch_tool(name, args)
            convo.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result, default=str)[:6000],
            })

    # Hit the round cap — ask for a final answer with whatever it has gathered.
    final = client.chat.completions.create(
        model=model, messages=convo, max_tokens=1000,
    )
    return final.choices[0].message.content or "— ELLIE"
