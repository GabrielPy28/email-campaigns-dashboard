from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.auth import auth_router
from app.campaigns.campaign_service import campaigns_router
from app.campaigns.test_send import campaigns_test_router
from app.templates.template_service import templates_router
from app.senders.sender_service import senders_router
from app.tracking import tracking_router
from app.reports import reports_router
from app.lists import lists_router
from app.creators import creators_router
from app.creators_test import creators_test_router
from app.lists_test import lists_test_router
from app.qr_codes import qr_codes_router, qr_public_router
from app.logs.request_logger import RequestLoggingMiddleware
from app.db.migrate import bootstrap_schema

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description=settings.description,
    version=settings.version,
    swagger_ui_parameters={"defaultModelsExpandDepth": -1}
)

app.add_middleware(RequestLoggingMiddleware)
_app_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_app_origins if _app_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(templates_router)
app.include_router(senders_router)
app.include_router(campaigns_router)
app.include_router(campaigns_test_router)
app.include_router(tracking_router)
app.include_router(reports_router)
app.include_router(lists_router)
app.include_router(creators_router)
app.include_router(lists_test_router)
app.include_router(creators_test_router)
app.include_router(qr_codes_router)
app.include_router(qr_public_router)


@app.on_event("startup")
def ensure_tables():
    """Crea tablas nuevas y aplica migraciones ligeras (p. ej. columnas añadidas)."""
    bootstrap_schema()


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

