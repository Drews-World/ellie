from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import get_settings
from routers.ellie import router as ellie_router
from routers.calendar import router as calendar_router
from routers.personal import reminders_router, notes_router, goals_router
from routers.world import router as world_router
from routers.prayer import router as prayer_router
from routers.govee import router as govee_router
from routers.trading import router as trading_router
from routers.business import router as business_router

settings = get_settings()

app = FastAPI(
    title="ELLIE API",
    description="Executive Life Logic Intelligence Engine — Backend",
    version="1.0.0",
)

# CORS — allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(ellie_router)
app.include_router(calendar_router)
app.include_router(reminders_router)
app.include_router(notes_router)
app.include_router(goals_router)
app.include_router(world_router)
app.include_router(prayer_router)
app.include_router(govee_router)
app.include_router(trading_router)
app.include_router(business_router)


@app.get("/health")
async def health():
    return {"status": "online", "system": "ELLIE", "operator": "Drew"}


@app.get("/")
async def root():
    return {
        "name": "ELLIE",
        "full_name": "Executive Life Logic Intelligence Engine",
        "status": "all systems operational",
        "operator": "Drew"
    }
