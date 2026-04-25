from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime, date, time
from uuid import UUID

# ── Calendar Events ──
class CalendarEventCreate(BaseModel):
    title: str
    notes: Optional[str] = None
    location: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    all_day: bool = False
    color: str = "hud"
    category: str = "general"
    google_id: Optional[str] = None

class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    all_day: Optional[bool] = None
    color: Optional[str] = None
    category: Optional[str] = None

class CalendarEvent(CalendarEventCreate):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

# ── Reminders ──
class ReminderCreate(BaseModel):
    title: str
    notes: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    priority: str = "medium"
    category: str = "general"

class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    priority: Optional[str] = None
    completed: Optional[bool] = None
    category: Optional[str] = None

class Reminder(ReminderCreate):
    id: UUID
    user_id: UUID
    completed: bool
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

# ── Notes ──
class NoteCreate(BaseModel):
    title: str
    content: Optional[str] = None
    tags: List[str] = []
    pinned: bool = False
    category: str = "general"

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    pinned: Optional[bool] = None
    category: Optional[str] = None

class Note(NoteCreate):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

# ── Goals ──
class Milestone(BaseModel):
    title: str
    completed: bool = False
    date: Optional[date] = None

class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "general"
    target_date: Optional[date] = None
    progress: int = Field(default=0, ge=0, le=100)
    milestones: List[Milestone] = []

class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    target_date: Optional[date] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    completed: Optional[bool] = None
    milestones: Optional[List[Milestone]] = None

class Goal(GoalCreate):
    id: UUID
    user_id: UUID
    completed: bool
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

# ── ELLIE ──
class EllieRequest(BaseModel):
    widget: str
    context: dict = {}

class EllieChatMessage(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str

class EllieChatRequest(BaseModel):
    messages: List[EllieChatMessage]
    context: dict = {}

class EllieResponse(BaseModel):
    brief: str
    widget: str

# ── Profile ──
class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    timezone: Optional[str] = None
    ellie_memory: Optional[dict] = None
