from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response, RedirectResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models


tracking_router = APIRouter(prefix="/track", tags=["tracking"])


def _get_client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return ip, ua


@tracking_router.get("/open/{campaign_id}/{recipient_id}/logo.png")
def track_open(
    campaign_id: UUID,
    recipient_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Pixel de apertura: registra el open y devuelve un PNG 1x1 transparente."""
    ip, ua = _get_client_info(request)

    db.add(
        models.EmailOpen(
            campaign_id=campaign_id,
            recipient_id=recipient_id,
            ip_address=ip,
            user_agent=ua,
        )
    )
    db.commit()

    # PNG 1x1 transparente
    pixel_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\x0bIDAT\x08\xd7c```\x00\x00\x00\x05\x00\x01"
        b"\x0d\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    return Response(content=pixel_bytes, media_type="image/png")


@tracking_router.get("/click")
def track_click(
    campaign_id: UUID,
    recipient_id: str,
    url: str,
    request: Request,
    button_id: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Tracking de clicks genérico:
    - Registra el click en email_clicks.
    - Redirige al URL original.
    """
    ip, ua = _get_client_info(request)

    db.add(
        models.EmailClick(
            campaign_id=campaign_id,
            recipient_id=recipient_id,
            button_id=button_id,
            url=url,
            ip_address=ip,
            user_agent=ua,
        )
    )
    db.commit()

    return RedirectResponse(url=url, status_code=302)

