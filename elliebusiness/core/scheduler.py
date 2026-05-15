"""
APScheduler wrapper. Import `scheduler` and call `.start()` from lifespan.
Jobs are registered by each agent module at import time via `add_job`.
"""
from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

scheduler = AsyncIOScheduler(timezone="UTC")
