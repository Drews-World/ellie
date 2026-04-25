from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from core.auth import get_current_user
from core.database import get_supabase

router = APIRouter(prefix="/prayer", tags=["prayer"])


class PrayerItemCreate(BaseModel):
    title: str
    notes: Optional[str] = None
    category: str = "general"


class PrayerItemUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None  # 'active' | 'answered'
    category: Optional[str] = None


@router.get("")
async def list_prayer_items(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = supabase.table("prayer_items") \
        .select("*") \
        .eq("user_id", user["id"]) \
        .order("created_at", desc=True) \
        .execute()
    return result.data or []


@router.post("")
async def create_prayer_item(item: PrayerItemCreate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = supabase.table("prayer_items").insert({
        "user_id": user["id"],
        "title": item.title,
        "notes": item.notes,
        "category": item.category,
        "status": "active",
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create prayer item")
    return result.data[0]


@router.put("/{item_id}")
async def update_prayer_item(item_id: str, update: PrayerItemUpdate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    payload = {k: v for k, v in update.model_dump().items() if v is not None}
    if update.status == "answered":
        from datetime import datetime
        payload["answered_at"] = datetime.utcnow().isoformat()
    result = supabase.table("prayer_items") \
        .update(payload) \
        .eq("id", item_id) \
        .eq("user_id", user["id"]) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Prayer item not found")
    return result.data[0]


@router.delete("/{item_id}")
async def delete_prayer_item(item_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("prayer_items") \
        .delete() \
        .eq("id", item_id) \
        .eq("user_id", user["id"]) \
        .execute()
    return {"ok": True}
