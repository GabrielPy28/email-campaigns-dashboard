"""
Envíos de prueba inmediatos: plantilla HTML en cuerpo, asunto, preheader,
destinatarios desde listas_test o lista manual (mismo shape que recipients de campaña).
El tracking de apertura y clic reutiliza /track (email_opens / email_clicks).
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from jinja2 import Template
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session, joinedload

from app.campaigns.models import RecipientInput
from app.core.security import get_current_user
from app.db.session import get_db
from app.db import models
from app.emails.smtp_client import send_campaign_email
from app.emails.template_renderer import build_jinja_context_from_recipient, render_template_text
from app.lists.creator_utils import creator_to_campaign_recipient


MAX_TEST_RECIPIENTS = 25

campaigns_test_router = APIRouter(prefix="/campaigns-test", tags=["campaigns-test"])


class TestSendRequest(BaseModel):
    subject: str = Field(..., max_length=200, description="Asunto del correo")
    preheader: str | None = Field(
        default=None,
        max_length=255,
        description="Texto de previsualización",
    )
    template_html: str = Field(
        ...,
        min_length=1,
        description="HTML de la plantilla con variables Jinja2 (mismo contexto que envíos reales)",
    )
    sender_ids: list[uuid.UUID] = Field(
        ...,
        min_length=1,
        description="Uno o más remitentes registrados",
    )
    list_test_id: uuid.UUID | None = Field(
        default=None,
        description="UUID de una lista de prueba (listas_test)",
    )
    recipients: list[RecipientInput] | None = Field(
        default=None,
        description="Destinatarios manuales (shape de campaña); alternativa a list_test_id / creator_test_ids",
    )
    creator_test_ids: list[uuid.UUID] | None = Field(
        default=None,
        max_length=MAX_TEST_RECIPIENTS,
        description="UUIDs en creators_test (máx. 25); alternativa a list_test_id / recipients",
    )

    @model_validator(mode="after")
    def exactly_one_target(self):
        has_list = self.list_test_id is not None
        has_rec = self.recipients is not None and len(self.recipients) >= 1
        has_ct = self.creator_test_ids is not None and len(self.creator_test_ids) >= 1
        n = int(has_list) + int(has_rec) + int(has_ct)
        if n != 1:
            raise ValueError(
                "Debe indicar exactamente uno: list_test_id, recipients (no vacío) o creator_test_ids (no vacío)."
            )
        return self


class TestRecipientResult(BaseModel):
    email: str
    recipient_id: str
    status: str
    error: str | None = None


class TestSendResponse(BaseModel):
    campaign_id: str
    template_id: str
    num_recipients: int
    sent: int
    failed: int
    campaign_status: str
    results: list[TestRecipientResult]
    tracking_note: str = Field(
        default="Aperturas y clics se registran en GET /campaigns/ con include_test=true o consultando email_opens/email_clicks por campaign_id.",
    )


class PreviewRequest(BaseModel):
    template_html: str = Field(..., min_length=1, description="HTML con variables Jinja2")
    subject: str = Field(default="", max_length=200)
    preheader: str | None = Field(default=None, max_length=255)
    creator_test_id: uuid.UUID = Field(..., description="Creador en creators_test (datos de ejemplo)")
    sender_id: uuid.UUID | None = Field(
        default=None,
        description="Remitente para {{ sender_name }} en el contexto; si no, se usa un texto genérico",
    )


class PreviewResponse(BaseModel):
    html: str
    subject: str
    preheader: str | None


@campaigns_test_router.post("/preview", response_model=PreviewResponse)
def preview_test_template(
    payload: PreviewRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Renderiza HTML/asunto/preheader con el mismo contexto Jinja2 que el envío real (sin tracking)."""
    creator = (
        db.query(models.CreatorTest)
        .filter(models.CreatorTest.id == payload.creator_test_id)
        .first()
    )
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Creador de prueba no encontrado (GET /creadores-test/).",
        )
    sender_name = "Remitente"
    if payload.sender_id is not None:
        snd = db.query(models.Sender).filter(models.Sender.id == payload.sender_id).first()
        if snd:
            sender_name = snd.full_name
    fake_campaign_id = uuid.uuid4()
    rec = creator_to_campaign_recipient(fake_campaign_id, creator)
    context = build_jinja_context_from_recipient(rec, sender_name)
    rendered_subject = render_template_text(payload.subject, context)
    if rendered_subject is None:
        rendered_subject = payload.subject
    rendered_preheader = render_template_text(payload.preheader, context)
    jinja_template = Template(payload.template_html)
    rendered_html = jinja_template.render(**context)
    return PreviewResponse(
        html=rendered_html,
        subject=rendered_subject,
        preheader=rendered_preheader,
    )


@campaigns_test_router.post("/send", response_model=TestSendResponse)
def send_test_campaign(
    payload: TestSendRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    sender_uuids = list(payload.sender_ids)
    senders_in_db = db.query(models.Sender).filter(models.Sender.id.in_(sender_uuids)).all()
    if len(senders_in_db) != len(sender_uuids):
        found = {s.id for s in senders_in_db}
        missing = [str(s) for s in sender_uuids if s not in found]
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Remitente(s) no encontrado(s): {', '.join(missing)}",
        )

    primary_sender_id = sender_uuids[0]
    created_by = current_user.get("name") or current_user.get("email") or ""

    creators_sorted: list[models.CreatorTest] | None = None

    if payload.list_test_id is not None:
        lista = (
            db.query(models.ListaTest)
            .options(joinedload(models.ListaTest.creators))
            .filter(models.ListaTest.id == payload.list_test_id)
            .first()
        )
        if not lista:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lista de prueba no encontrada (GET /listas-test/).",
            )
        if not lista.creators:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La lista de prueba no tiene creadores.",
            )
        creators_sorted = sorted(lista.creators, key=lambda c: c.email.lower())
        if len(creators_sorted) > MAX_TEST_RECIPIENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Máximo {MAX_TEST_RECIPIENTS} destinatarios por envío de prueba (la lista tiene {len(creators_sorted)}).",
            )
    elif payload.creator_test_ids is not None:
        ids_ordered = list(dict.fromkeys(payload.creator_test_ids))
        if len(ids_ordered) > MAX_TEST_RECIPIENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Máximo {MAX_TEST_RECIPIENTS} destinatarios por envío de prueba.",
            )
        found = (
            db.query(models.CreatorTest)
            .filter(models.CreatorTest.id.in_(ids_ordered))
            .all()
        )
        by_id = {c.id: c for c in found}
        missing = [str(i) for i in ids_ordered if i not in by_id]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Creador(es) de prueba no encontrado(s): {', '.join(missing)}",
            )
        creators_sorted = [by_id[i] for i in ids_ordered]
    else:
        assert payload.recipients is not None
        if len(payload.recipients) > MAX_TEST_RECIPIENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Máximo {MAX_TEST_RECIPIENTS} destinatarios por envío de prueba.",
            )

    now = datetime.utcnow()
    tpl = models.Template(
        name=f"[test] {now.isoformat()}"[:200],
        html_content=payload.template_html,
    )
    db.add(tpl)
    db.flush()

    name = f"Test send {now.isoformat(timespec='seconds')}"[:200]
    db_campaign = models.Campaign(
        name=name,
        subject=payload.subject,
        preheader=payload.preheader,
        template_id=tpl.id,
        sender_id=primary_sender_id,
        scheduled_at=now,
        timezone="UTC",
        wait_min_seconds=1,
        wait_max_seconds=1,
        status="running",
        created_by=created_by,
        list_id=None,
        is_test=True,
    )
    db.add(db_campaign)
    db.flush()

    for sid in sender_uuids:
        db.execute(
            models.campaign_senders.insert().values(
                campaign_id=db_campaign.id,
                sender_id=sid,
            )
        )

    if creators_sorted is not None:
        for i, creator in enumerate(creators_sorted):
            rec = creator_to_campaign_recipient(db_campaign.id, creator)
            rec.sender_id = sender_uuids[i % len(sender_uuids)]
            rec.status = "pending"
            rec.scheduled_send_time = now
            db.add(rec)
    else:
        recipients_sorted = sorted(
            payload.recipients or [],
            key=lambda r: (r.id, r.email),
        )
        for idx, r in enumerate(recipients_sorted):
            required, extra = r.to_required_and_extra()
            db.add(
                models.CampaignRecipient(
                    campaign_id=db_campaign.id,
                    recipient_id=str(required["id"]),
                    email=required["email"],
                    nombre=required["nombre"],
                    username=required["username"],
                    extra_data=extra,
                    sender_id=sender_uuids[idx % len(sender_uuids)],
                    status="pending",
                    scheduled_send_time=now,
                )
            )

    db.commit()
    db.refresh(db_campaign)
    db_campaign = (
        db.query(models.Campaign)
        .options(
            joinedload(models.Campaign.template),
            joinedload(models.Campaign.senders),
            joinedload(models.Campaign.recipients),
        )
        .filter(models.Campaign.id == db_campaign.id)
        .first()
    )
    assert db_campaign is not None

    api_base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
    recipients_sorted = sorted(
        db_campaign.recipients,
        key=lambda r: (r.recipient_id, r.email),
    )

    results: list[TestRecipientResult] = []

    for rec in recipients_sorted:
        rec.status = "sending"
    db.commit()

    for rec in recipients_sorted:
        sender = None
        if rec.sender_id:
            sender = db.get(models.Sender, rec.sender_id)
        if sender is None:
            sender = db_campaign.sender
        if sender is None:
            rec.status = "failed"
            results.append(
                TestRecipientResult(
                    email=rec.email,
                    recipient_id=rec.recipient_id,
                    status="failed",
                    error="Sin remitente",
                )
            )
            continue
        try:
            asyncio.run(
                send_campaign_email(
                    db,
                    api_base_url=api_base_url,
                    campaign=db_campaign,
                    recipient=rec,
                    sender=sender,
                    subject=payload.subject or None,
                    preheader=payload.preheader,
                )
            )
            rec.status = "sent"
            results.append(
                TestRecipientResult(
                    email=rec.email,
                    recipient_id=rec.recipient_id,
                    status="sent",
                )
            )
        except Exception as e:
            rec.status = "failed"
            results.append(
                TestRecipientResult(
                    email=rec.email,
                    recipient_id=rec.recipient_id,
                    status="failed",
                    error=str(e)[:500],
                )
            )
        db.commit()

    sent_n = sum(1 for r in results if r.status == "sent")
    failed_n = len(results) - sent_n
    total = len(results)
    if total > 0 and sent_n >= total:
        db_campaign.status = "sent"
    elif sent_n == 0:
        db_campaign.status = "failed"
    else:
        # Envío de prueba terminado
        db_campaign.status = "sent"

    db.commit()

    return TestSendResponse(
        campaign_id=str(db_campaign.id),
        template_id=str(tpl.id),
        num_recipients=total,
        sent=sent_n,
        failed=failed_n,
        campaign_status=db_campaign.status,
        results=results,
    )
