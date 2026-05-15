from __future__ import annotations

from supabase import Client, create_client

from .config import get_settings


def get_db() -> Client:
    # No caching — sharing one httpx connection pool across threads causes
    # WinError 10035 (WSAEWOULDBLOCK) on Windows. Fresh client per call is safe.
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(s.supabase_url, s.supabase_service_key)
