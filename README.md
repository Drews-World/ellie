# ELLIE Hub 
### Executive Life Logic Intelligence Engine

> Drew's personal command center. A **web app** that's the hub for ELLIE's growing crew: ellietrading, elliebusiness, and Drew's own life. Navigate it like an open office — pick a door, enter a room.

## Layout

```
ellie/
├── webapp/             ← THE REAL ELLIE HUB
│   ├── backend/        FastAPI (Clerk auth, Supabase DB, Gemini-powered chat)
│   ├── frontend/       React + Vite (the office UI)
│   └── README.md
│
├── elliebusiness/      ← FastAPI service for the "Ultron / Forge / Nova" agent crew.
│                         Stub today; real agents in Phase 2.
│
├── references/
│   └── openhuman/      ← tinyhumansai/openhuman source — UI/architecture reference only.
│
├── hub/                ← OBSOLETE — leftover OpenHuman copy, duplicates references/openhuman/.
│                         Run: Remove-Item -Recurse -Force hub  (Cowork sandbox couldn't delete it).
│
├── archive/            ← Junk folder (old-misnamed-folder).
│
├── docs/
│   ├── ELLIE_REBUILD_PLAN.md      ← The full build plan (read first).
│   ├── DESIGN_LANGUAGE.md         ← Visual brief for the rebrand.
│   ├── SUBSYSTEM_CONTRACT.md      ← Contract every sub-system implements.
│   └── CLAUDE_CODE_HANDOFF.md     ← Where the previous session left off.
│
├── README.md           ← this file
└── COWORK_SETUP.md
```

Sibling repo (separate, not in this monorepo):
- **`ellietrading`** — fork of TauricResearch/TradingAgents at `C:\Users\humes\Desktop\Projects\ellietrading\`. Tracked separately so we can pull upstream updates.

## Quick start

### 1. Run the elliebusiness stub
```powershell
cd elliebusiness
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```
Test: `curl http://localhost:8001/health` → `{"ok": true, ...}`

### 2. Run ELLIE Hub (web app)
```powershell
# Backend (FastAPI)
cd webapp/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# In another terminal — Frontend (Vite)
cd webapp/frontend
npm install
npm run dev
```
Open http://localhost:5173. You'll need `.env` files in both `webapp/backend/` and `webapp/frontend/` — see `docs/ELLIE_REBUILD_PLAN.md` for keys.

## Status

- Plan v4 written (web app, office metaphor, Gemini-direct).
- Design language spec written.
- `elliebusiness/` stub running, contract-compliant.
- `webapp/` is the existing ELLIE codebase (formerly `archive/`). Works as-is; rebrand pending.
- Next: rebrand pass (theme tokens, Lobby page, sub-system rooms) — Claude Code's job.

## Read these first if you're picking this up

1. `docs/ELLIE_REBUILD_PLAN.md` — what we're building and why
2. `docs/DESIGN_LANGUAGE.md` — what it should look like
3. `docs/SUBSYSTEM_CONTRACT.md` — how the hub talks to ellietrading + elliebusiness
4. `docs/CLAUDE_CODE_HANDOFF.md` — running state of the work
