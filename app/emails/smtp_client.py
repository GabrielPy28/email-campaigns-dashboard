import os
import html
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

import aiosmtplib
import httpx
from jinja2 import Template
from sqlalchemy.orm import Session, joinedload

from app.db import models
from app.emails.template_renderer import (
    build_jinja_context_from_recipient,
    coerce_extra_data_to_dict,
    inject_tracking,
    render_template_text,
)
from app.lists.creator_utils import creator_to_extra_dict


def _merged_extra_for_send(db: Session, recipient: models.CampaignRecipient) -> dict:
    """
    `campaign_recipients.extra_data` puede quedar vacío o desactualizado.
    Si `recipient_id` es el UUID de `creators.id`, releemos la fila (y
    `account_profiles`) y fusionamos: **los valores de la tabla creators
    pisan** las claves homónimas en el JSON guardado; el resto del JSON
    (p. ej. columnas de CSV) se conserva.
    """
    base = coerce_extra_data_to_dict(recipient.extra_data)
    try:
        uid = uuid.UUID(str(recipient.recipient_id))
    except (ValueError, TypeError, AttributeError):
        return base
    creator = (
        db.query(models.Creator)
        .options(joinedload(models.Creator.account_profiles))
        .filter(models.Creator.id == uid)
        .first()
    )
    if creator is None:
        return base
    fresh = creator_to_extra_dict(creator)
    merged = dict(base)
    merged.update(fresh)
    return merged


async def send_campaign_email(
    db: Session,
    *,
    api_base_url: str,
    campaign: models.Campaign,
    recipient: models.CampaignRecipient,
    sender: models.Sender,
    subject: str | None = None,
    preheader: str | None = None,
) -> None:
    """
    Envía un email de campaña:
    - Renderiza el HTML de la plantilla.
    - Renderiza asunto y preheader con el mismo contexto Jinja2 (variables como {first_name} o {{ first_name }}).
    - Inyecta links de tracking y pixel (open/click).
    - Envía vía API HTTP de Brevo si hay API key; si no, usa SMTP (Gmail/dev).
    """
    template = campaign.template
    if not template:
        raise ValueError("Campaign has no template loaded")

    # 1) Render base HTML con variables del destinatario (Jinja2)
    base_html = template.html_content

    merged_extra = _merged_extra_for_send(db, recipient)
    context = build_jinja_context_from_recipient(
        recipient, sender.full_name, extra_data=merged_extra
    )

    # Asunto: mismo render Jinja que el cuerpo; si viene vacío usamos campaign.subject y luego name.
    raw_subject = subject
    if raw_subject is None or not str(raw_subject).strip():
        raw_subject = campaign.subject
    if raw_subject is None or not str(raw_subject).strip():
        raw_subject = campaign.name or ""
    rendered_subject = render_template_text(str(raw_subject), context)
    if rendered_subject is None:
        rendered_subject = str(raw_subject)
    rendered_preheader = render_template_text(preheader, context)

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
    if rendered_preheader is not None and rendered_preheader.strip():
        safe_ph = html.escape(rendered_preheader, quote=True)
        preheader_div = (
            f'<div style="display:none; max-height:0; overflow:hidden; opacity:0;'
            f' color:transparent; visibility:hidden;">{safe_ph}</div>'
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
            "subject": rendered_subject,
            "textContent": rendered_preheader or "",
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

    # 4) Fallback SMTP
    msg = MIMEMultipart("alternative")
    msg["Subject"] = rendered_subject
    msg["From"] = formataddr((sender.full_name, sender.email))
    msg["To"] = recipient.email
    if rendered_preheader is not None:
        msg["X-MC-Preview-Text"] = rendered_preheader

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

