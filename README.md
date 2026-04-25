# ELLIE — Executive Life Logic Intelligence Engine
> Personal command center for AJH. Two modes: the world, and your life.

## Stack
- **Frontend**: React + Vite + React Router
- **Backend**: FastAPI + SQLAlchemy (async)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Clerk
- **Hosting**: Vercel (frontend) + Railway (backend)

## Quick Start

### 1. Install
```bash
# Frontend
cd frontend && npm install

# Backend
cd backend && pip install -r requirements.txt
```

### 2. Environment variables
Copy `.env.example` to `.env` in both directories and fill in your keys.

### 3. Run locally
```bash
# Terminal 1
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

## API Keys Needed
| Service | Purpose | Free Tier |
|---------|---------|-----------|
| Clerk | Auth | Yes |
| Supabase | Database | Yes |
| NewsAPI | World news | Yes |
| OpenWeatherMap | Weather | Yes |
| Polygon.io | Stocks | Yes (delayed) |
| CoinGecko | Crypto | No key needed |
| SportsRadar | Sports | Trial |
| Google Calendar API | Calendar sync | Yes |
| Anthropic | ELLIE AI briefs | Pay-as-you-go |
