import asyncio
import os
import random
from datetime import datetime, timedelta

from worker.celery_app import celery
from app.db.session import SessionLocal
from app.db import models
from app.emails.smtp_client import send_campaign_email


def _parse_timezone_offset(tz: str) -> timedelta:
    """
    Convierte strings tipo 'UTC-4', 'UTC+5:30' en un timedelta de offset.
    Regla: local_time = utc + offset  ⇒  utc = local_time - offset.
    """
    if not tz or not tz.startswith("UTC"):
        return timedelta(0)

    s = tz[3:]
    if not s:
        return timedelta(0)

    sign = 1
    if s[0] == "+":
        sign = 1
        s = s[1:]
    elif s[0] == "-":
        sign = -1
        s = s[1:]

    if not s:
        return timedelta(0)

    if ":" in s:
        h_str, m_str = s.split(":", 1)
    else:
        h_str, m_str = s, "0"

    try:
        hours = int(h_str)
        minutes = int(m_str)
    except ValueError:
        return timedelta(0)

    return sign * timedelta(hours=hours, minutes=minutes)


@celery.task(name="worker.tasks.process_email_queue_task")
def process_email_queue_task(batch_size: int = 50) -> None:
    """
    Scheduler principal:
    - Prepara campañas programadas (asigna sender_id, scheduled_send_time, status=pending).
    - Selecciona destinatarios pending y listos (scheduled_send_time <= now).
    - Marca cada uno como 'sending' mientras se envía.
    - Actualiza a 'sent' o 'failed' según resultado.
    """
    db = SessionLocal()
    try:
        now = datetime.utcnow()

        # 1) Preparar campañas con estado scheduled (la lógica de hora real se aplica en Python).
        campaigns = (
            db.query(models.Campaign)
            .filter(models.Campaign.status == "scheduled")
            .all()
        )

        for campaign in campaigns:
            if not campaign.recipients or not campaign.scheduled_at:
                continue

            # Convertir scheduled_at (almacenado en hora local de la campaña) a UTC
            offset = _parse_timezone_offset(campaign.timezone or "")
            scheduled_utc = campaign.scheduled_at - offset

            # Si todavía no es hora (en UTC), saltamos esta campaña por ahora
            if scheduled_utc > now:
                continue

            sender_ids = [s.id for s in campaign.senders] or [campaign.sender_id]
            if not sender_ids:
                continue

            recipients_sorted = sorted(
                campaign.recipients, key=lambda r: (r.recipient_id, r.email)
            )

            # Asignar sender_id y status=pending
            for idx, rec in enumerate(recipients_sorted):
                rec.sender_id = sender_ids[idx % len(sender_ids)]
                rec.status = "pending"

            # Calcular scheduled_send_time por destinatario en UTC
            current_time = scheduled_utc

            for idx, rec in enumerate(recipients_sorted):
                if idx == 0:
                    rec.scheduled_send_time = current_time
                else:
                    delta_seconds = random.randint(
                        campaign.wait_min_seconds,
                        campaign.wait_max_seconds,
                    )
                    current_time = current_time + timedelta(seconds=delta_seconds)
                    rec.scheduled_send_time = current_time

            # Marcar campaña como en ejecución
            campaign.status = "running"

        db.commit()

        # 2) Seleccionar destinatarios pending listos para envío
        recipients = (
            db.query(models.CampaignRecipient)
            .filter(
                models.CampaignRecipient.status == "pending",
                models.CampaignRecipient.scheduled_send_time <= now,
            )
            .order_by(models.CampaignRecipient.scheduled_send_time.asc())
            .limit(batch_size)
            .with_for_update(skip_locked=True)
            .all()
        )

        if not recipients:
            return

        api_base_url = os.getenv("API_BASE_URL", "http://localhost:8000")

        for rec in recipients:
            rec.status = "sending"
        db.commit()

        for rec in recipients:
            campaign = rec.campaign

            # Elegir el sender correcto:
            # 1) Si el recipient tiene sender_id asignado (distribución equitativa), usar ese.
            # 2) Si no, caer al sender principal de la campaña.
            sender = None
            if rec.sender_id:
                sender = db.query(models.Sender).get(rec.sender_id)
            if sender is None and campaign is not None:
                sender = campaign.sender

            if not campaign or not sender:
                rec.status = "failed"
                continue

            try:
                asyncio.run(
                    send_campaign_email(
                        db,
                        api_base_url=api_base_url,
                        campaign=campaign,
                        recipient=rec,
                        sender=sender,
                        subject=campaign.subject or campaign.name,
                        preheader=campaign.preheader,
                    )
                )
                rec.status = "sent"
            except Exception:
                rec.status = "failed"

        db.commit()

        # 3) Si alguna campaña tiene todos sus recipientes en 'sent', marcar campaña como 'sent'
        campaign_ids_processed = {rec.campaign_id for rec in recipients}
        for cid in campaign_ids_processed:
            campaign = db.query(models.Campaign).filter(models.Campaign.id == cid).first()
            if not campaign:
                continue
            total = db.query(models.CampaignRecipient).filter(
                models.CampaignRecipient.campaign_id == cid,
            ).count()
            sent_count = db.query(models.CampaignRecipient).filter(
                models.CampaignRecipient.campaign_id == cid,
                models.CampaignRecipient.status == "sent",
            ).count()
            if total > 0 and sent_count >= total:
                campaign.status = "sent"
        db.commit()
    finally:
        db.close()

