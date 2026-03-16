from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import get_settings
from app.core.auth import auth_router
from app.campaigns.campaign_service import campaigns_router
from app.templates.template_service import templates_router
from app.senders.sender_service import senders_router
from app.tracking import tracking_router
from app.reports import reports_router
from app.logs.request_logger import RequestLoggingMiddleware
from app.db.session import engine, Base
from app.db import models

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description=settings.description,
    version=settings.version,
    swagger_ui_parameters={"defaultModelsExpandDepth": -1}
)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(templates_router)
app.include_router(senders_router)
app.include_router(campaigns_router)
app.include_router(tracking_router)
app.include_router(reports_router)


@app.on_event("startup")
def ensure_tables():
    """Crea el schema auth (si aplica) y las tablas que falten al arrancar."""
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS auth"))
    Base.metadata.create_all(bind=engine)


@app.get("/health", tags=["health"])
def health_check():
    """
    Simple health/status endpoint for Docker/Kubernetes probes.
    """
    return {
        "status": "run",
        "message": "Hello, I'm running and ready to start sending emails.",
        "version": settings.version,
        "environment": settings.environment,
    }

