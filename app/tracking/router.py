from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response, RedirectResponse
from sqlalchemy.orm import Session

from app.core.client_ip import get_client_ip
from app.core.ip_country_lookup import resolve_ip_country
from app.db.session import get_db
from app.db import models
from app.tracking.device_category import classify_device_from_user_agent


tracking_router = APIRouter(prefix="/track", tags=["tracking"])


def _get_client_info(request: Request) -> tuple[str | None, str | None]:
    ip = get_client_ip(request)
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
    device = classify_device_from_user_agent(ua)

    db.add(
        models.EmailOpen(
            campaign_id=campaign_id,
            recipient_id=recipient_id,
            ip_address=ip,
            user_agent=ua,
            device_category=device,
        )
    )
    db.commit()

    try:
        resolve_ip_country(db, ip)
        db.commit()
    except Exception:
        db.rollback()

    # PNG 1x1 transparente
    pixel_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\x0bIDAT\x08\xd7c```\x00\x00\x00\x05\x00\x01"
        b"\x0d\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    # Evitar que el cliente (o un CDN intermedio) sirva el pixel desde caché:
    # sin esto, varias “aperturas” pueden generar solo 1 GET al servidor.
    # Nota: Gmail/Outlook suelen proxificar imágenes y pueden seguir contando 1
    # aunque el usuario abra el correo varias veces.
    return Response(
        content=pixel_bytes,
        media_type="image/png",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, private",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


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
    device = classify_device_from_user_agent(ua)

    db.add(
        models.EmailClick(
            campaign_id=campaign_id,
            recipient_id=recipient_id,
            button_id=button_id,
            url=url,
            ip_address=ip,
            user_agent=ua,
            device_category=device,
        )
    )
    db.commit()

    try:
        resolve_ip_country(db, ip)
        db.commit()
    except Exception:
        db.rollback()

    return RedirectResponse(url=url, status_code=302)

