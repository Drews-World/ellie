from fastapi import APIRouter, Depends, HTTPException
from models.schemas import EllieRequest, EllieChatRequest, EllieResponse
from services.ellie_service import get_ellie_brief, ellie_chat
from core.auth import get_current_user
from core.database import get_supabase

router = APIRouter(prefix="/ellie", tags=["ellie"])


@router.post("/brief", response_model=EllieResponse)
async def ellie_brief(
    req: EllieRequest,
    user: dict = Depends(get_current_user)
):
    """Get an ELLIE intelligence brief for a specific widget."""
    try:
        brief = await get_ellie_brief(req.widget, req.context)

        # Save to conversation history
        supabase = get_supabase()
        supabase.table("ellie_conversations").insert({
            "user_id": user["id"],
            "widget": req.widget,
            "role": "assistant",
            "content": brief,
        }).execute()

        return EllieResponse(brief=brief, widget=req.widget)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def ellie_chat_endpoint(
    req: EllieChatRequest,
    user: dict = Depends(get_current_user)
):
    """Multi-turn chat with ELLIE."""
    try:
        supabase = get_supabase()

        # Fetch user profile for base context (may not exist yet — safe to skip)
        context = {}
        try:
            profile = supabase.table("profiles").select("ellie_memory").eq("id", user["id"]).limit(1).execute()
            if profile.data:
                context = profile.data[0].get("ellie_memory", {}) or {}
        except Exception:
            pass

        # Inject live calendar events (today)
        try:
            from datetime import date
            today = date.today().isoformat()
            tomorrow = date.fromordinal(date.today().toordinal() + 1).isoformat()
            events_res = supabase.table("calendar_events") \
                .select("title, start_time, end_time, location") \
                .eq("user_id", user["id"]) \
                .gte("start_time", today) \
                .lt("start_time", tomorrow) \
                .order("start_time") \
                .execute()
            if events_res.data:
                context["calendar_today"] = [
                    f"{e['title']} @ {e['start_time']}" + (f" ({e['location']})" if e.get('location') else "")
                    for e in events_res.data
                ]
        except Exception:
            pass

        # Inject pending reminders
        try:
            reminders_res = supabase.table("reminders") \
                .select("title, due_date, priority") \
                .eq("user_id", user["id"]) \
                .eq("completed", False) \
                .order("due_date") \
                .limit(10) \
                .execute()
            if reminders_res.data:
                context["pending_reminders"] = [
                    f"{r['title']}" + (f" (due {r['due_date']}, {r['priority']} priority)" if r.get('due_date') else f" ({r['priority']} priority)")
                    for r in reminders_res.data
                ]
        except Exception:
            pass

        # Inject active goals
        try:
            goals_res = supabase.table("goals") \
                .select("title, category, target_date, progress") \
                .eq("user_id", user["id"]) \
                .eq("status", "active") \
                .order("target_date") \
                .limit(5) \
                .execute()
            if goals_res.data:
                context["active_goals"] = [
                    f"{g['title']}" + (f" [{g['category']}]" if g.get('category') else "") + (f" — {g['progress']}% done" if g.get('progress') is not None else "")
                    for g in goals_res.data
                ]
        except Exception:
            pass

        context.update(req.context)

        response = await ellie_chat(
            [m.model_dump() for m in req.messages],
            context,
            user_id=user["id"],
        )

        # Save user's last message and ELLIE's response (best-effort)
        try:
            msgs = req.messages
            if msgs:
                supabase.table("ellie_conversations").insert([
                    {"user_id": user["id"], "role": msgs[-1].role, "content": msgs[-1].content},
                    {"user_id": user["id"], "role": "assistant", "content": response},
                ]).execute()
        except Exception:
            pass

        return {"response": response}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/memories")
async def list_memories(
    user: dict = Depends(get_current_user)
):
    """Everything ELLIE remembers about this user (the facts table)."""
    from services.ellie_memory import load_memories
    return {"memories": load_memories(user["id"])}


@router.delete("/memories/{memory_id}")
async def remove_memory(
    memory_id: str,
    user: dict = Depends(get_current_user)
):
    """Manually delete one of ELLIE's long-term memories."""
    from services.ellie_memory import delete_memory
    result = delete_memory(user["id"], memory_id)
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/history")
async def get_history(
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get recent ELLIE conversation history."""
    supabase = get_supabase()
    result = supabase.table("ellie_conversations") \
        .select("*") \
        .eq("user_id", user["id"]) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()
    return result.data
