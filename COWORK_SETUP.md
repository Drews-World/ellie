# ELLIE Setup Instructions for Cowork Agent
# Hand this file to Cowork and say: "Follow these instructions to set up the ELLIE project"

## What This Is
ELLIE (Executive Life Logic Intelligence Engine) is a full-stack personal command center app.
- Frontend: React + Vite (in /frontend)
- Backend: FastAPI + Python (in /backend)
- Database: Supabase (PostgreSQL, hosted)

## Step 1 — Install Frontend Dependencies
```bash
cd frontend
npm install
```

## Step 2 — Install Backend Dependencies
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Mac/Linux
# OR: venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

## Step 3 — Set Up Environment Variables

Copy the example files:
```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Then fill in the values (ask the user for these):
- SUPABASE_URL → from supabase.com → Project Settings → API
- SUPABASE_ANON_KEY → from same page
- SUPABASE_SERVICE_KEY → from same page (service_role key)
- ANTHROPIC_API_KEY → from console.anthropic.com
- NEWS_API_KEY → from newsapi.org (free account)
- POLYGON_API_KEY → from polygon.io (free account)
- OPENWEATHER_API_KEY → from openweathermap.org (free account)

## Step 4 — Set Up Supabase Database
1. Go to supabase.com → your project → SQL Editor
2. Open backend/core/schema.sql
3. Copy the entire contents and paste into SQL Editor
4. Click Run

## Step 5 — Enable Supabase Google Auth
1. Go to supabase.com → your project → Authentication → Providers
2. Enable Google
3. Add OAuth credentials from console.cloud.google.com
   - Authorized redirect URI: https://your-project.supabase.co/auth/v1/callback

## Step 6 — Run Locally
```bash
# Terminal 1 — Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Frontend runs at: http://localhost:5173
Backend runs at:  http://localhost:8000
API docs at:      http://localhost:8000/docs

## Step 7 — Deploy (when ready)

### Frontend → Vercel
```bash
cd frontend
npm run build
# Connect repo to vercel.com, set env vars, deploy
```

### Backend → Railway
- Go to railway.app → New Project → Deploy from GitHub
- Point to /backend folder
- Add all env vars from backend/.env
- Start command: uvicorn main:app --host 0.0.0.0 --port $PORT

## Troubleshooting
- CORS errors → make sure CORS_ORIGINS in backend/.env includes your frontend URL
- Auth errors → make sure Supabase URL and keys match in both .env files
- "No module named X" → run pip install -r requirements.txt again in venv
- API keys returning empty data → that's fine, ELLIE degrades gracefully with stub data
