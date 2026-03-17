import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

import aiosmtplib
import httpx
from jinja2 import Template
from sqlalchemy.orm import Session

from app.db import models
from app.emails.template_renderer import inject_tracking


async def send_campaign_email(
    db: Session,
    *,
    api_base_url: str,
    campaign: models.Campaign,
    recipient: models.CampaignRecipient,
    sender: models.Sender,
    subject: str,
    preheader: str | None = None,
) -> None:
    """
    Envía un email de campaña:
    - Renderiza el HTML de la plantilla.
    - Inyecta links de tracking y pixel (open/click).
    - Envía vía API HTTP de Brevo si hay API key; si no, usa SMTP (Gmail/dev).
    """
    template = campaign.template
    if not template:
        raise ValueError("Campaign has no template loaded")

    # 1) Render base HTML con variables del destinatario (Jinja2)
    base_html = template.html_content

    extra = recipient.extra_data or {}
    additional = extra.get("additionalProp1", {}) if isinstance(extra, dict) else {}

    context: dict = {
        "nombre": recipient.nombre,
        "username": recipient.username,
        "email": recipient.email,
        "handle": additional.get("handle") or extra.get("handle", ""),
        "extra": extra,
        "sender_name": sender.full_name,
    }

    jinja_template = Template(base_html)
    rendered_html = jinja_template.render(**context)

    # 2) Tracking (pixel + links)
    html_with_tracking = inject_tracking(
        rendered_html,
        api_base_url=api_base_url,
        campaign_id=str(campaign.id),
        recipient_id=recipient.recipient_id,
    )

    # 2.1) Preheader oculto para vista previa
    if preheader:
        preheader_div = (
            f'<div style="display:none; max-height:0; overflow:hidden; opacity:0;'
            f' color:transparent; visibility:hidden;">{preheader}</div>'
        )
        html_with_tracking = preheader_div + html_with_tracking

    # 3) Envío vía API HTTP de Brevo si hay API key
    brevo_api_key = os.getenv("BREVO_HTTP_API_KEY") or os.getenv("BREVO_API_KEY")
    if brevo_api_key:
        payload = {
            "sender": {
                "name": sender.full_name,
                "email": sender.email,
            },
            "to": [
                {
                    "email": recipient.email,
                    "name": recipient.nombre
                }
            ],
            "subject": subject,
            "textContent": preheader,
            "htmlContent": html_with_tracking,
            # Tag básico para poder filtrar mensajes de esta campaña en Brevo
            "tags": [str(campaign.id)],
            "replyTo": {
                "email": sender.email,
                "name": sender.full_name
            }
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "accept": "application/json",
                    "content-type": "application/json",
                    "api-key": brevo_api_key,
                },
                json=payload,
            )
        if resp.status_code >= 400:
            raise RuntimeError(f"Brevo API error {resp.status_code}: {resp.text}")
        return

    # 4) Fallback SMTP (Gmail/dev)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((sender.full_name, sender.email))
    msg["To"] = recipient.email
    msg["X-MC-Preview-Text"] = preheader

    msg.attach(MIMEText(html_with_tracking, "html", "utf-8"))

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")

    if not smtp_user or not smtp_password:
        raise RuntimeError("SMTP credentials are not configured")

    await aiosmtplib.send(
        msg,
        hostname=smtp_host,
        port=smtp_port,
        start_tls=(smtp_port == 587),
        username=smtp_user,
        password=smtp_password,
    )

