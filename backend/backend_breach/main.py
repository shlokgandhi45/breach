"""
main.py — FastAPI application entry point

Run:
  uvicorn main:app --reload --port 8000

Docs available at:
  http://localhost:8000/docs   (Swagger UI — great for hackathon demo)
  http://localhost:8000/redoc
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models.schema import Base, engine
from routes.ingest import router as ingest_router
from routes.search import router as search_router
from routes.intelligence import router as intelligence_router
from routes.candidates_route import router as candidates_router
from routes.dashboard_route import router as dashboard_router
from routes.pipeline_route import router as pipeline_router
from routes.scheduling_route import router as scheduling_router
from routes.ai_config_route import router as ai_config_router
from routes.job_roles_route import router as job_roles_router
from routes.dedup_route import router as dedup_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title       = "Unified Recruitment Platform API",
    description = "Resume ingestion, AI-powered search, and candidate intelligence",
    version     = "1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)

# Auto-create tables on startup (gracefully handle failures if DB is offline)
@app.on_event("startup")
def startup():
    try:
        Base.metadata.create_all(engine)
        logging.getLogger(__name__).info("DB tables verified on startup.")
    except Exception as e:
        logging.getLogger(__name__).warning(f"DB connection failed on startup: {e}. Services will use mock fallbacks.")

# ── Register all route modules ────────────────────────────────────────────────
app.include_router(ingest_router)         # /api/ingest/*
app.include_router(search_router)         # /api/search/*
app.include_router(intelligence_router)   # /api/intelligence/*
app.include_router(candidates_router)     # /api/candidates/*
app.include_router(dashboard_router)      # /api/dashboard/*
app.include_router(pipeline_router)       # /api/pipeline/*
app.include_router(scheduling_router)     # /api/scheduling/*
app.include_router(ai_config_router)      # /api/ai-config
app.include_router(job_roles_router)      # /api/job-roles
app.include_router(dedup_router)           # /api/deduplicate

@app.get("/")
def root():
    return {
        "service": "Unified Recruitment Platform",
        "docs":    "/docs",
        "endpoints": {
            "ingest":       "/api/ingest/status",
            "search":       "/api/search",
            "intelligence": "/api/intelligence/health",
        },
    }

