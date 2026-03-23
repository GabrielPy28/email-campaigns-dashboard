import os
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session
from app.core.client_ip import is_public_routable_ip
from app.core.ip_country_lookup import resolve_ip_country
from app.db.session import get_db
from app.db import models
from app.tracking.device_category import classify_device_from_user_agent

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


def _device_for_report_row(
    stored_category: str | None, user_agent: str | None
) -> str:
    """Filas antiguas sin `device_category`: se reclasifica desde UA con la misma lógica que /track."""
    if stored_category in ("desktop", "mobile", "tablet", "other"):
        return stored_category
    return classify_device_from_user_agent(user_agent)


@reports_router.get(
    "/campaigns/{campaign_id}/devices", response_model=CampaignDevicesReport
)
def get_campaign_devices(
    campaign_id: str,
    db: Session = Depends(get_db),
):
    """
    Por destinatario: se toma el evento de seguimiento más reciente (apertura o clic)
    y su `device_category` (guardada en /track/open y /track/click). Filas legacy
    sin columna rellena se reclasifican con la misma función que el tracking.
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
    open_rows = (
        db.query(
            models.EmailOpen.recipient_id,
            models.EmailOpen.opened_at,
            models.EmailOpen.user_agent,
            models.EmailOpen.device_category,
        )
        .filter(models.EmailOpen.campaign_id == cid)
        .order_by(
            models.EmailOpen.recipient_id,
            desc(models.EmailOpen.opened_at),
        )
        .distinct(models.EmailOpen.recipient_id)
        .all()
    )
    click_rows = (
        db.query(
            models.EmailClick.recipient_id,
            models.EmailClick.clicked_at,
            models.EmailClick.user_agent,
            models.EmailClick.device_category,
        )
        .filter(models.EmailClick.campaign_id == cid)
        .order_by(
            models.EmailClick.recipient_id,
            desc(models.EmailClick.clicked_at),
        )
        .distinct(models.EmailClick.recipient_id)
        .all()
    )

    best: dict[str, tuple[datetime, str]] = {}
    for r in open_rows:
        cat = _device_for_report_row(r.device_category, r.user_agent)
        ts = r.opened_at
        rid = r.recipient_id
        prev = best.get(rid)
        if prev is None or ts >= prev[0]:
            best[rid] = (ts, cat)

    for r in click_rows:
        cat = _device_for_report_row(r.device_category, r.user_agent)
        ts = r.clicked_at
        rid = r.recipient_id
        prev = best.get(rid)
        if prev is None or ts >= prev[0]:
            best[rid] = (ts, cat)

    counts: dict[str, int] = {"desktop": 0, "mobile": 0, "tablet": 0, "other": 0}
    for _, cat in best.values():
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
    """Eventos por país (aperturas + clics): agrupa IPs de `email_opens` y `email_clicks`."""
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
    open_rows = (
        db.query(models.EmailOpen.ip_address)
        .filter(
            models.EmailOpen.campaign_id == cid,
            models.EmailOpen.ip_address.isnot(None),
        )
        .all()
    )
    click_rows = (
        db.query(models.EmailClick.ip_address)
        .filter(
            models.EmailClick.campaign_id == cid,
            models.EmailClick.ip_address.isnot(None),
        )
        .all()
    )
    country_counts: dict[str, int] = {}
    country_names: dict[str, str] = {}

    # IPs únicas a resolver (aperturas + clics)
    ips = {
        (r.ip_address or "").strip()
        for r in (*open_rows, *click_rows)
        if (r.ip_address or "").strip()
    }

    # 1) Caché existente
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

    # 2) Faltantes: MaxMind local (GEOIP2_*) y/o ipgeolocation.io (máx. 300 HTTP/campaña)
    missing_ips = [
        ip for ip in ips if ip not in cache_map and is_public_routable_ip(ip)
    ]
    http_budget = [300]
    for ip in missing_ips:
        code, name = resolve_ip_country(db, ip, http_budget=http_budget)
        cache_map[ip] = (code, name)

    if missing_ips:
        db.commit()

    # 3) Contabilizar cada apertura y cada clic (misma IP -> mismo país en cache)
    def _count_ip(ip_raw: str | None) -> None:
        ip = (ip_raw or "").strip()
        if not ip:
            code, name = "XX", "Unknown"
        elif not is_public_routable_ip(ip):
            code, name = "XX", "Private / non-routable"
        else:
            code, name = cache_map.get(ip, ("XX", "Unknown"))
        country_counts[code] = country_counts.get(code, 0) + 1
        if code not in country_names:
            country_names[code] = name

    for r in open_rows:
        _count_ip(r.ip_address)
    for r in click_rows:
        _count_ip(r.ip_address)
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
    db: Session = Depends(get_db),
):
    """
    Compara métricas internas vs métricas de Brevo para una campaña:
    - Aperturas / clics: internos (BD) vs Brevo.
    - Entrega / rebotes / spam: solo Brevo (`aggregatedReport`); la app no los
      infiere por opens; para estado por destinatario hace falta webhook + guardar eventos.

    Brevo: `GET /v3/smtp/statistics/aggregatedReport` con `tag` y `days=31`.
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

    try:
        resp = httpx.get(
            "https://api.brevo.com/v3/smtp/statistics/aggregatedReport",
            headers={
                "accept": "application/json",
                "api-key": brevo_api_key,
            },
            params={
                "tag": str(campaign.id),
                "days": 31,
            },
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
    brevo_total_opens = int(data.get("opens") or 0)
    brevo_unique_opens = int(data.get("uniqueOpens") or 0)
    brevo_total_clicks = int(data.get("clicks") or 0)
    brevo_delivered = int(data.get("delivered") or 0)
    brevo_hard_bounces = int(data.get("hardBounces") or 0)
    brevo_soft_bounces = int(data.get("softBounces") or 0)
    brevo_spam_reports = int(data.get("spamReports") or 0)

    return BrevoInternalMetricsCompare(
        campaign_id=str(cid),
        internal_unique_opens=internal_unique_opens,
        internal_total_opens=internal_total_opens,
        internal_total_clicks=int(internal_total_clicks),
        brevo_unique_opens=brevo_unique_opens,
        brevo_total_opens=brevo_total_opens,
        brevo_total_clicks=brevo_total_clicks,
        brevo_delivered=brevo_delivered,
        brevo_hard_bounces=brevo_hard_bounces,
        brevo_soft_bounces=brevo_soft_bounces,
        brevo_spam_reports=brevo_spam_reports,
    )

