import os
import requests
import uuid
from datetime import date, datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from user_agents import parse as parse_user_agent

from app.reports.models import (
    CampaignOpensReport,
    CampaignOpenRecipient,
    CampaignClickSummary,
    CampaignRecipientClicks,
    CampaignClicksByRecipientReport,
    ButtonClicks,
    CampaignClicksByButtonReport,
    CampaignDevicesReport,
    DeviceCount,
    CampaignLocationsReport,
    LocationCount,
    BrevoInternalMetricsCompare,
)


reports_router = APIRouter(prefix="/reports", tags=["reports"])


@reports_router.get(
    "/campaigns/{campaign_id}/opens", response_model=CampaignOpensReport
)
def get_campaign_opens(
    campaign_id: str,
    db: Session = Depends(get_db),
):
    """
    Reporte de aperturas por campaña:
    - total de destinatarios
    - destinatarios únicos que han abierto
    - total de aperturas
    - detalle por destinatario
    """
    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    campaign = db.query(models.Campaign).filter(models.Campaign.id == cid).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    # Total de destinatarios de la campaña
    total_recipients = (
        db.query(func.count(models.CampaignRecipient.id))
        .filter(models.CampaignRecipient.campaign_id == cid)
        .scalar()
    ) or 0

    # Agregar detalle por destinatario: email + aperturas
    rows = (
        db.query(
            models.CampaignRecipient.recipient_id,
            models.CampaignRecipient.email,
            func.count(models.EmailOpen.id).label("opens"),
            func.max(models.EmailOpen.opened_at).label("last_opened_at"),
        )
        .outerjoin(
            models.EmailOpen,
            (models.EmailOpen.campaign_id == cid)
            & (
                models.EmailOpen.recipient_id
                == models.CampaignRecipient.recipient_id
            ),
        )
        .filter(models.CampaignRecipient.campaign_id == cid)
        .group_by(
            models.CampaignRecipient.recipient_id,
            models.CampaignRecipient.email,
        )
        .all()
    )

    recipients = [
        CampaignOpenRecipient(
            recipient_id=r.recipient_id,
            email=r.email,
            opens=int(r.opens or 0),
            last_opened_at=r.last_opened_at,
        )
        for r in rows
    ]

    unique_open_recipients = sum(1 for r in recipients if r.opens > 0)
    total_opens = sum(r.opens for r in recipients)

    return CampaignOpensReport(
        campaign_id=str(cid),
        total_recipients=total_recipients,
        unique_open_recipients=unique_open_recipients,
        total_opens=total_opens,
        recipients=recipients,
    )


@reports_router.get(
    "/campaigns/{campaign_id}/clicks", response_model=CampaignClickSummary
)
def get_campaign_clicks(
    campaign_id: str,
    recipient_id: str | None = None,
    button_id: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Reporte simple de clicks por campaña.
    - campaign_id (requerido)
    - recipient_id (opcional)
    - button_id (opcional)
    """
    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    q = db.query(func.count(models.EmailClick.id)).filter(
        models.EmailClick.campaign_id == cid
    )

    if recipient_id:
        q = q.filter(models.EmailClick.recipient_id == recipient_id)

    if button_id:
        q = q.filter(models.EmailClick.button_id == button_id)

    total_clicks = int(q.scalar() or 0)

    return CampaignClickSummary(
        campaign_id=str(cid),
        recipient_id=recipient_id,
        button_id=button_id,
        total_clicks=total_clicks,
    )


@reports_router.get(
    "/campaigns/{campaign_id}/clicks-by-recipient",
    response_model=CampaignClicksByRecipientReport,
)
def get_campaign_clicks_by_recipient(
    campaign_id: str,
    db: Session = Depends(get_db),
):
    """
    Clics por destinatario para una campaña (para gráficos combinados con aperturas).
    """
    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )
    campaign = db.query(models.Campaign).filter(models.Campaign.id == cid).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    rows = (
        db.query(
            models.CampaignRecipient.recipient_id,
            models.CampaignRecipient.email,
            func.count(models.EmailClick.id).label("clicks"),
        )
        .outerjoin(
            models.EmailClick,
            (models.EmailClick.campaign_id == cid)
            & (models.EmailClick.recipient_id == models.CampaignRecipient.recipient_id),
        )
        .filter(models.CampaignRecipient.campaign_id == cid)
        .group_by(
            models.CampaignRecipient.recipient_id,
            models.CampaignRecipient.email,
        )
        .all()
    )

    recipients = [
        CampaignRecipientClicks(
            recipient_id=r.recipient_id,
            email=r.email or "",
            clicks=int(r.clicks or 0),
        )
        for r in rows
    ]

    return CampaignClicksByRecipientReport(
        campaign_id=str(cid),
        recipients=recipients,
    )


@reports_router.get(
    "/campaigns/{campaign_id}/clicks-by-button",
    response_model=CampaignClicksByButtonReport,
)
def get_campaign_clicks_by_button(
    campaign_id: str,
    db: Session = Depends(get_db),
):
    """
    Clics por botón de la plantilla para una campaña (Benchmarking por botón).
    """
    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )
    campaign = db.query(models.Campaign).filter(models.Campaign.id == cid).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    rows = (
        db.query(
            models.EmailClick.button_id,
            func.count(models.EmailClick.id).label("clicks"),
        )
        .filter(models.EmailClick.campaign_id == cid)
        .group_by(models.EmailClick.button_id)
        .all()
    )

    buttons = [
        ButtonClicks(
            button_id=r.button_id or "(sin botón)",
            clicks=int(r.clicks or 0),
        )
        for r in rows
    ]

    return CampaignClicksByButtonReport(
        campaign_id=str(cid),
        buttons=buttons,
    )


def _device_category(user_agent_str: str | None) -> str:
    if not user_agent_str:
        return "other"
    ua = parse_user_agent(user_agent_str)
    if ua.is_tablet and not ua.is_mobile:
        return "tablet"
    if ua.is_mobile:
        return "mobile"
    if ua.is_pc:
        return "desktop"
    return "other"


@reports_router.get(
    "/campaigns/{campaign_id}/devices", response_model=CampaignDevicesReport
)
def get_campaign_devices(
    campaign_id: str,
    db: Session = Depends(get_db),
):
    """Desglose de aperturas por tipo de dispositivo (desktop, mobile, tablet, other)."""
    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )
    campaign = db.query(models.Campaign).filter(models.Campaign.id == cid).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )
    rows = (
        db.query(models.EmailOpen.user_agent)
        .filter(models.EmailOpen.campaign_id == cid)
        .all()
    )
    counts: dict[str, int] = {"desktop": 0, "mobile": 0, "tablet": 0, "other": 0}
    for r in rows:
        cat = _device_category(r.user_agent)
        counts[cat] = counts.get(cat, 0) + 1
    devices = [DeviceCount(device=k, count=v) for k, v in counts.items()]
    return CampaignDevicesReport(campaign_id=str(cid), devices=devices)


@reports_router.get(
    "/campaigns/{campaign_id}/locations", response_model=CampaignLocationsReport
)
def get_campaign_locations(
    campaign_id: str,
    db: Session = Depends(get_db),
):
    """Aperturas por país (código ISO). Requiere GeoLite2-Country.mmdb (env GEOIP2_COUNTRY_DB)."""
    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )
    campaign = db.query(models.Campaign).filter(models.Campaign.id == cid).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )
    rows = (
        db.query(models.EmailOpen.ip_address)
        .filter(models.EmailOpen.campaign_id == cid, models.EmailOpen.ip_address.isnot(None))
        .all()
    )
    country_counts: dict[str, int] = {}
    country_names: dict[str, str] = {}

    api_key = os.getenv("IPGEOLOCATION_API_KEY")

    # Normalizamos IPs y eliminamos duplicados
    ips = {
        (r.ip_address or "").strip()
        for r in rows
        if (r.ip_address or "").strip()
    }

    # 1) Cargar cache existente para estas IPs
    if ips:
        cached = (
            db.query(models.IpGeolocationCache)
            .filter(models.IpGeolocationCache.ip.in_(list(ips)))
            .all()
        )
    else:
        cached = []

    cache_map: dict[str, tuple[str, str]] = {
        c.ip: (c.country_code, c.country_name) for c in cached
    }

    # 2) Resolver IPs faltantes contra la API, con límite de peticiones
    missing_ips = [ip for ip in ips if ip not in cache_map and not ip.startswith("127.") and ip != "::1"]
    max_api_lookups = 300
    looked_up = 0

    if api_key:
        for ip in missing_ips:
            if looked_up >= max_api_lookups:
                break
            try:
                resp = requests.get(
                    "https://api.ipgeolocation.io/v3/ipgeo",
                    params={"apiKey": api_key, "ip": ip},
                    timeout=3,
                )
                if resp.ok:
                    data = resp.json()
                    loc = data.get("location") or {}
                    code = (loc.get("country_code2") or "XX").upper()
                    name = loc.get("country_name") or code
                else:
                    code = "XX"
                    name = "Unknown"
            except Exception:
                code = "XX"
                name = "Unknown"

            cache_map[ip] = (code, name)
            looked_up += 1

            # Guardar/actualizar en cache
            existing = next((c for c in cached if c.ip == ip), None)
            if existing:
                existing.country_code = code
                existing.country_name = name
                existing.last_seen_at = datetime.utcnow()
            else:
                db.add(
                    models.IpGeolocationCache(
                        ip=ip,
                        country_code=code,
                        country_name=name,
                        last_seen_at=datetime.utcnow(),
                    )
                )

        if looked_up > 0:
            db.commit()

    # 3) Contabilizar todos los opens usando cache + reglas locales
    for r in rows:
        ip = (r.ip_address or "").strip()
        if not ip or ip.startswith("127.") or ip == "::1":
            code, name = "XX", "Local"
        else:
            code, name = cache_map.get(ip, ("XX", "Unknown"))

        country_counts[code] = country_counts.get(code, 0) + 1
        if code not in country_names:
            country_names[code] = name
    locations = [
        LocationCount(country_code=code, country_name=country_names.get(code, code), count=n)
        for code, n in sorted(country_counts.items(), key=lambda x: -x[1])
    ]
    return CampaignLocationsReport(campaign_id=str(cid), locations=locations)


@reports_router.get(
    "/campaigns/{campaign_id}/brevo-compare",
    response_model=BrevoInternalMetricsCompare,
)
def compare_internal_with_brevo(
    campaign_id: str,
    start_date: str = Query(
        default_factory=lambda: date.today().isoformat(),
        description="Fecha inicio (YYYY-MM-DD) para consultar estadísticas en Brevo",
    ),
    end_date: str = Query(
        default_factory=lambda: date.today().isoformat(),
        description="Fecha fin (YYYY-MM-DD) para consultar estadísticas en Brevo",
    ),
    db: Session = Depends(get_db),
):
    """
    Compara métricas internas vs métricas de Brevo para una campaña:
    - Aperturas únicas, aperturas totales, clicks totales.

    Brevo: se consulta `GET /v3/smtp/statistics/reports` filtrando por tag = campaign_id.
    """
    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    campaign = db.query(models.Campaign).filter(models.Campaign.id == cid).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    # --- Métricas internas ---
    # Opens (usamos la misma lógica que get_campaign_opens)
    rows_opens = (
        db.query(
            models.EmailOpen.recipient_id,
            func.count(models.EmailOpen.id).label("opens"),
        )
        .filter(models.EmailOpen.campaign_id == cid)
        .group_by(models.EmailOpen.recipient_id)
        .all()
    )
    internal_total_opens = sum(int(r.opens or 0) for r in rows_opens)
    internal_unique_opens = sum(1 for r in rows_opens if int(r.opens or 0) > 0)

    # Clicks
    internal_total_clicks = (
        db.query(func.count(models.EmailClick.id))
        .filter(models.EmailClick.campaign_id == cid)
        .scalar()
        or 0
    )

    # --- Métricas Brevo ---
    brevo_api_key = os.getenv("BREVO_HTTP_API_KEY") or os.getenv("BREVO_API_KEY")
    if not brevo_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Brevo API key not configured (BREVO_HTTP_API_KEY / BREVO_API_KEY).",
        )

    params = {
        "startDate": start_date,
        "endDate": end_date,
        "tag": str(campaign.id),
    }

    try:
        resp = httpx.get(
            "https://api.brevo.com/v3/smtp/statistics/reports",
            headers={
                "accept": "application/json",
                "api-key": brevo_api_key,
            },
            params=params,
            timeout=30.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error calling Brevo API: {exc}",
        )

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Brevo API error {resp.status_code}: {resp.text}",
        )

    data = resp.json()
    reports = data.get("reports") or []
    if reports:
        # Agregamos por si Brevo devolviera varias fechas en el rango
        brevo_total_opens = sum(int(r.get("opens", 0)) for r in reports)
        brevo_unique_opens = sum(int(r.get("uniqueOpens", 0)) for r in reports)
        brevo_total_clicks = sum(int(r.get("clicks", 0)) for r in reports)
    else:
        brevo_total_opens = 0
        brevo_unique_opens = 0
        brevo_total_clicks = 0

    return BrevoInternalMetricsCompare(
        campaign_id=str(cid),
        start_date=start_date,
        end_date=end_date,
        internal_unique_opens=internal_unique_opens,
        internal_total_opens=internal_total_opens,
        internal_total_clicks=int(internal_total_clicks),
        brevo_unique_opens=brevo_unique_opens,
        brevo_total_opens=brevo_total_opens,
        brevo_total_clicks=brevo_total_clicks,
    )

