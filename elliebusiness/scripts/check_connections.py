# -*- coding: utf-8 -*-
"""
Connection checker + Supabase table probe.
Run from the elliebusiness/ directory:
    python scripts/check_connections.py
"""
from __future__ import annotations
import os, sys, pathlib
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(pathlib.Path(__file__).parent.parent / ".env")

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
GEMINI_API_KEY       = os.environ.get("GEMINI_API_KEY", "")
GEMINI_BASE_URL      = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
GEMINI_MODEL         = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
OPENROUTER_API_KEY   = os.environ.get("OPENROUTER_API_KEY", "")
ETSY_API_KEY         = os.environ.get("ETSY_API_KEY", "")
PRINTIFY_API_TOKEN   = os.environ.get("PRINTIFY_API_TOKEN", "")
DISCORD_WEBHOOK_URL  = os.environ.get("DISCORD_WEBHOOK_URL", "")

import httpx

results = {}

# ── 1. Supabase ───────────────────────────────────────────────────────────────
print("\n[1/6] Supabase...")
try:
    r = httpx.get(
        f"{SUPABASE_URL}/rest/v1/designs?limit=1",
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        },
        timeout=10,
    )
    if r.status_code == 200:
        results["supabase"] = "OK  -- connected, designs table exists"
    elif r.status_code == 404 or "does not exist" in r.text:
        results["supabase"] = "WARN -- connected but designs table missing (run migration SQL in Supabase Studio)"
    else:
        results["supabase"] = f"WARN -- HTTP {r.status_code}: {r.text[:120]}"
except Exception as e:
    results["supabase"] = f"FAIL -- {e}"
print(f"   {results['supabase']}")

# ── 2. Gemini ─────────────────────────────────────────────────────────────────
print("\n[2/6] Gemini...")
try:
    from openai import OpenAI
    client = OpenAI(api_key=GEMINI_API_KEY, base_url=GEMINI_BASE_URL + "/")
    resp = client.chat.completions.create(
        model=GEMINI_MODEL,
        messages=[{"role": "user", "content": "Reply with exactly the word: ELLIE_OK"}],
        max_tokens=10,
    )
    reply = resp.choices[0].message.content.strip()
    results["gemini"] = f"OK  -- {reply}"
except Exception as e:
    results["gemini"] = f"FAIL -- {e}"
print(f"   {results['gemini']}")

# ── 3. OpenRouter ─────────────────────────────────────────────────────────────
print("\n[3/6] OpenRouter...")
if not OPENROUTER_API_KEY:
    results["openrouter"] = "SKIP -- no key set"
else:
    try:
        from openai import OpenAI
        or_client = OpenAI(api_key=OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1/")
        resp = or_client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[{"role": "user", "content": "Reply: OK"}],
            max_tokens=5,
        )
        results["openrouter"] = f"OK  -- {resp.choices[0].message.content.strip()}"
    except Exception as e:
        err = str(e)
        if "402" in err or "insufficient" in err.lower() or "credit" in err.lower() or "balance" in err.lower():
            results["openrouter"] = "WARN -- key valid, no credits yet (add funds at openrouter.ai)"
        elif "401" in err:
            results["openrouter"] = "FAIL -- invalid key"
        else:
            results["openrouter"] = f"WARN -- {err[:150]}"
print(f"   {results['openrouter']}")

# ── 4. Etsy ───────────────────────────────────────────────────────────────────
print("\n[4/6] Etsy read-only...")
if not ETSY_API_KEY:
    results["etsy"] = "SKIP -- no key"
else:
    try:
        r = httpx.get(
            "https://openapi.etsy.com/v3/application/listings/active",
            params={"limit": 1, "keywords": "mountain mug"},
            headers={"x-api-key": ETSY_API_KEY},
            timeout=15,
        )
        if r.status_code == 200:
            count = r.json().get("count", "?")
            results["etsy"] = f"OK  -- {count} listings for 'mountain mug'"
        else:
            results["etsy"] = f"FAIL -- HTTP {r.status_code}: {r.text[:120]}"
    except Exception as e:
        results["etsy"] = f"FAIL -- {e}"
print(f"   {results['etsy']}")

# ── 5. Printify ───────────────────────────────────────────────────────────────
print("\n[5/6] Printify...")
if not PRINTIFY_API_TOKEN:
    results["printify"] = "SKIP -- no token"
else:
    try:
        r = httpx.get(
            "https://api.printify.com/v1/shops.json",
            headers={"Authorization": f"Bearer {PRINTIFY_API_TOKEN}"},
            timeout=15,
        )
        if r.status_code == 200:
            shops = r.json()
            if shops:
                shop = shops[0]
                results["printify"] = f"OK  -- shop '{shop['title']}' id={shop['id']}"
                results["printify_shop_id"] = str(shop["id"])
            else:
                results["printify"] = "WARN -- token valid, no shops found (create one in Printify first)"
        else:
            results["printify"] = f"FAIL -- HTTP {r.status_code}: {r.text[:120]}"
    except Exception as e:
        results["printify"] = f"FAIL -- {e}"
print(f"   {results['printify']}")

# ── 6. Discord ────────────────────────────────────────────────────────────────
print("\n[6/6] Discord webhook...")
if not DISCORD_WEBHOOK_URL:
    results["discord"] = "SKIP -- no webhook URL"
else:
    try:
        r = httpx.post(
            DISCORD_WEBHOOK_URL,
            json={"content": "ELLIE Business -- connection check passed. All systems go."},
            timeout=10,
        )
        if r.status_code in (200, 204):
            results["discord"] = "OK  -- message sent to #EllieBusiness"
        else:
            results["discord"] = f"FAIL -- HTTP {r.status_code}: {r.text[:100]}"
    except Exception as e:
        results["discord"] = f"FAIL -- {e}"
print(f"   {results['discord']}")

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SUMMARY")
print("="*60)
for k, v in results.items():
    if k == "printify_shop_id":
        continue
    print(f"  {k:<20} {v}")

# Auto-write Printify shop ID to .env if discovered
if "printify_shop_id" in results:
    env_path = pathlib.Path(__file__).parent.parent / ".env"
    env_text = env_path.read_text(encoding="utf-8")
    shop_id = results["printify_shop_id"]
    if f"PRINTIFY_SHOP_ID={shop_id}" not in env_text:
        env_text = env_text.replace("PRINTIFY_SHOP_ID=", f"PRINTIFY_SHOP_ID={shop_id}")
        env_path.write_text(env_text, encoding="utf-8")
        print(f"\n  Auto-wrote PRINTIFY_SHOP_ID={shop_id} to .env")
