"""
ELLIE persistent memory — the layer that makes ELLIE "learn".

Backed by the `public.facts` table (migrations/005_pgvector_facts.sql): one row
per durable fact/preference ELLIE knows about Drew. The chat loop loads these
into the system prompt every conversation, and ELLIE curates them herself via
the save/update/delete tools below — that's the mechanism behind "she knows
what I like": say it once, she writes it down, every future chat starts with it.

Design notes
------------
- Every function is best-effort: storage failures return {"error": ...} (or [])
  instead of raising, so a missing table or dead connection never kills chat.
  If the table doesn't exist yet, run migration 005 in the Supabase SQL editor.
- The `embedding` column stays null for now — at personal scale we load all
  facts into the prompt directly; semantic recall can come later.
- All reads/writes are scoped to user_id so memories never cross users.
"""
from __future__ import annotations

import logging

from core.database import get_supabase

logger = logging.getLogger("ellie.memory")

# Mirrors the categories suggested in migration 005, plus the two floors ELLIE
# manages. Free-form values are normalized to "general" rather than rejected.
CATEGORIES = ("preference", "personal", "work", "goal", "business", "trading", "general")

_MISSING_TABLE_HINT = (
    "memory store unavailable — has migrations/005_pgvector_facts.sql been run "
    "in the Supabase SQL editor?"
)

# Keep the prompt injection bounded even if the store grows large.
_LOAD_LIMIT = 80
_MAX_CONTENT_LEN = 500


def _norm_category(category: str | None) -> str:
    c = (category or "general").strip().lower()
    return c if c in CATEGORIES else "general"


def load_memories(user_id: str, limit: int = _LOAD_LIMIT) -> list[dict]:
    """All facts ELLIE remembers about this user, newest-updated first."""
    if not user_id:
        return []
    try:
        res = (
            get_supabase()
            .table("facts")
            .select("id, content, category, updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001 — memory must never kill chat
        logger.warning("load_memories failed: %s", e)
        return []


def format_memories(memories: list[dict]) -> str:
    """Render facts for the system prompt, ids included so the model can
    update/delete a specific memory later."""
    lines = []
    for m in memories:
        lines.append(f"- [id={m['id']}] ({m.get('category', 'general')}) {m['content']}")
    return "\n".join(lines)


def save_memory(user_id: str, content: str, category: str = "general",
                source: str = "chat") -> dict:
    content = (content or "").strip()[:_MAX_CONTENT_LEN]
    if not content:
        return {"error": "memory content is empty"}
    try:
        res = (
            get_supabase()
            .table("facts")
            .insert({
                "user_id": user_id,
                "content": content,
                "category": _norm_category(category),
                "source": source,
            })
            .execute()
        )
        saved = (res.data or [{}])[0]
        return {"saved": True, "id": saved.get("id"), "content": content}
    except Exception as e:  # noqa: BLE001
        logger.warning("save_memory failed: %s", e)
        return {"error": _MISSING_TABLE_HINT, "detail": str(e)[:200]}


def update_memory(user_id: str, memory_id: str, content: str | None = None,
                  category: str | None = None) -> dict:
    patch: dict = {}
    if content and content.strip():
        patch["content"] = content.strip()[:_MAX_CONTENT_LEN]
    if category:
        patch["category"] = _norm_category(category)
    if not patch:
        return {"error": "nothing to update — pass content and/or category"}
    try:
        res = (
            get_supabase()
            .table("facts")
            .update(patch)
            .eq("id", memory_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not res.data:
            return {"error": f"no memory found with id {memory_id}"}
        return {"updated": True, "id": memory_id, **patch}
    except Exception as e:  # noqa: BLE001
        logger.warning("update_memory failed: %s", e)
        return {"error": _MISSING_TABLE_HINT, "detail": str(e)[:200]}


def delete_memory(user_id: str, memory_id: str) -> dict:
    try:
        res = (
            get_supabase()
            .table("facts")
            .delete()
            .eq("id", memory_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not res.data:
            return {"error": f"no memory found with id {memory_id}"}
        return {"deleted": True, "id": memory_id}
    except Exception as e:  # noqa: BLE001
        logger.warning("delete_memory failed: %s", e)
        return {"error": _MISSING_TABLE_HINT, "detail": str(e)[:200]}


# ── OpenAI-compatible tool schemas for the chat loop ─────────────────────────

MEMORY_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "save_memory",
            "description": "Save a durable fact about Drew to your long-term memory: a "
                           "preference, standing decision, business fact, or correction "
                           "worth knowing in every future conversation. One clean sentence "
                           "per memory. Do NOT save secrets or one-off conversational trivia.",
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "The fact, as one plain self-contained sentence.",
                    },
                    "category": {
                        "type": "string",
                        "enum": list(CATEGORIES),
                        "description": "What kind of fact this is.",
                    },
                },
                "required": ["content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_memory",
            "description": "Rewrite an existing long-term memory when it turns out to be "
                           "wrong or outdated. Use the id shown in your memory list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "memory_id": {"type": "string", "description": "The memory's id."},
                    "content": {"type": "string", "description": "The corrected fact."},
                    "category": {
                        "type": "string",
                        "enum": list(CATEGORIES),
                        "description": "New category, if it changed.",
                    },
                },
                "required": ["memory_id", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_memory",
            "description": "Permanently remove a long-term memory that no longer applies "
                           "(Drew said to forget it, or it's stale and not worth fixing).",
            "parameters": {
                "type": "object",
                "properties": {
                    "memory_id": {"type": "string", "description": "The memory's id."},
                },
                "required": ["memory_id"],
            },
        },
    },
]

MEMORY_TOOL_NAMES = {"save_memory", "update_memory", "delete_memory"}


async def dispatch_memory_tool(name: str, arguments: dict | None, user_id: str | None) -> dict:
    """Execute a memory tool for a specific user. Never raises."""
    if not user_id:
        return {"error": "no user bound to this chat session — memory is unavailable"}
    args = arguments or {}
    try:
        if name == "save_memory":
            return save_memory(user_id, args.get("content", ""), args.get("category", "general"))
        if name == "update_memory":
            return update_memory(user_id, args.get("memory_id", ""),
                                 args.get("content"), args.get("category"))
        if name == "delete_memory":
            return delete_memory(user_id, args.get("memory_id", ""))
        return {"error": f"unknown memory tool: {name}"}
    except Exception as e:  # noqa: BLE001
        logger.warning("memory tool '%s' failed: %s", name, e)
        return {"error": str(e)}
