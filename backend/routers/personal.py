from fastapi import APIRouter, Depends, HTTPException
from models.schemas import ReminderCreate, ReminderUpdate, NoteCreate, NoteUpdate, GoalCreate, GoalUpdate
from core.auth import get_current_user
from core.database import get_supabase
from datetime import datetime

# ── Reminders ──
reminders_router = APIRouter(prefix="/reminders", tags=["reminders"])

@reminders_router.get("")
async def get_reminders(
    completed: bool = None,
    user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    query = supabase.table("reminders").select("*").eq("user_id", user["id"])
    if completed is not None:
        query = query.eq("completed", completed)
    result = query.order("due_date", nulls_first=False).execute()
    return result.data

@reminders_router.post("")
async def create_reminder(
    reminder: ReminderCreate,
    user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    data = {**reminder.model_dump(), "user_id": user["id"]}
    data["due_date"] = data["due_date"].isoformat() if data["due_date"] else None
    data["due_time"] = str(data["due_time"]) if data["due_time"] else None
    result = supabase.table("reminders").insert(data).execute()
    return result.data[0]

@reminders_router.put("/{reminder_id}")
async def update_reminder(
    reminder_id: str,
    reminder: ReminderUpdate,
    user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    data = {k: v for k, v in reminder.model_dump().items() if v is not None}
    if data.get("due_date"):
        data["due_date"] = data["due_date"].isoformat()
    if data.get("due_time"):
        data["due_time"] = str(data["due_time"])
    if data.get("completed") is True:
        data["completed_at"] = datetime.utcnow().isoformat()

    result = supabase.table("reminders") \
        .update(data).eq("id", reminder_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return result.data[0]

@reminders_router.delete("/{reminder_id}")
async def delete_reminder(reminder_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("reminders").delete().eq("id", reminder_id).eq("user_id", user["id"]).execute()
    return {"deleted": reminder_id}


# ── Notes ──
notes_router = APIRouter(prefix="/notes", tags=["notes"])

@notes_router.get("")
async def get_notes(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = supabase.table("notes").select("*").eq("user_id", user["id"]) \
        .order("pinned", desc=True).order("updated_at", desc=True).execute()
    return result.data

@notes_router.post("")
async def create_note(note: NoteCreate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    data = {**note.model_dump(), "user_id": user["id"]}
    result = supabase.table("notes").insert(data).execute()
    return result.data[0]

@notes_router.put("/{note_id}")
async def update_note(note_id: str, note: NoteUpdate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    data = {k: v for k, v in note.model_dump().items() if v is not None}
    result = supabase.table("notes").update(data).eq("id", note_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Note not found")
    return result.data[0]

@notes_router.delete("/{note_id}")
async def delete_note(note_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("notes").delete().eq("id", note_id).eq("user_id", user["id"]).execute()
    return {"deleted": note_id}


# ── Goals ──
goals_router = APIRouter(prefix="/goals", tags=["goals"])

@goals_router.get("")
async def get_goals(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = supabase.table("goals").select("*").eq("user_id", user["id"]) \
        .eq("completed", False).order("target_date", nulls_first=False).execute()
    return result.data

@goals_router.post("")
async def create_goal(goal: GoalCreate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    data = {**goal.model_dump(), "user_id": user["id"]}
    data["target_date"] = data["target_date"].isoformat() if data["target_date"] else None
    data["milestones"] = [m.model_dump() for m in goal.milestones]
    result = supabase.table("goals").insert(data).execute()
    return result.data[0]

@goals_router.put("/{goal_id}")
async def update_goal(goal_id: str, goal: GoalUpdate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    data = {k: v for k, v in goal.model_dump().items() if v is not None}
    if data.get("target_date"):
        data["target_date"] = data["target_date"].isoformat()
    if data.get("milestones"):
        data["milestones"] = [m.model_dump() if hasattr(m, 'model_dump') else m for m in data["milestones"]]
    if data.get("completed") is True:
        data["completed_at"] = datetime.utcnow().isoformat()

    result = supabase.table("goals").update(data).eq("id", goal_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Goal not found")
    return result.data[0]

@goals_router.delete("/{goal_id}")
async def delete_goal(goal_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("goals").delete().eq("id", goal_id).eq("user_id", user["id"]).execute()
    return {"deleted": goal_id}
