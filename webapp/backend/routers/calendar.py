from fastapi import APIRouter, Depends, HTTPException
from models.schemas import CalendarEventCreate, CalendarEventUpdate
from core.auth import get_current_user
from core.database import get_supabase

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events")
async def get_events(
    start: str = None,
    end: str = None,
    user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    query = supabase.table("calendar_events").select("*").eq("user_id", user["id"])

    if start:
        query = query.gte("start_time", start)
    if end:
        query = query.lte("start_time", end)

    result = query.order("start_time").execute()
    return result.data


@router.post("/events")
async def create_event(
    event: CalendarEventCreate,
    user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    data = {**event.model_dump(), "user_id": user["id"]}
    # Convert datetime to ISO string
    data["start_time"] = data["start_time"].isoformat() if data["start_time"] else None
    data["end_time"] = data["end_time"].isoformat() if data["end_time"] else None

    result = supabase.table("calendar_events").insert(data).execute()
    return result.data[0]


@router.put("/events/{event_id}")
async def update_event(
    event_id: str,
    event: CalendarEventUpdate,
    user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    data = {k: v for k, v in event.model_dump().items() if v is not None}

    if "start_time" in data and data["start_time"]:
        data["start_time"] = data["start_time"].isoformat()
    if "end_time" in data and data["end_time"]:
        data["end_time"] = data["end_time"].isoformat()

    result = supabase.table("calendar_events") \
        .update(data) \
        .eq("id", event_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    return result.data[0]


@router.delete("/events/{event_id}")
async def delete_event(
    event_id: str,
    user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    supabase.table("calendar_events") \
        .delete() \
        .eq("id", event_id) \
        .eq("user_id", user["id"]) \
        .execute()
    return {"deleted": event_id}
