import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.db.models import campaign_senders
from app.senders.models import SenderCreate, SenderRead, SenderUpdate
from app.core.security import get_current_user


senders_router = APIRouter(prefix="/senders", tags=["senders"])


def _get_sender_by_id(db: Session, sender_id: str):
    try:
        sid = uuid.UUID(sender_id)
    except ValueError:
        return None
    return db.query(models.Sender).filter(models.Sender.id == sid).first()


def _sender_in_use(db: Session, sender_id: uuid.UUID) -> bool:
    """True si el sender está en uso en alguna campaña programada o en ejecución."""
    active_statuses = ["scheduled", "running", "pending", "sending"]
    # Como remitente principal de una campaña activa
    if db.query(models.Campaign).filter(
        models.Campaign.sender_id == sender_id,
        models.Campaign.status.in_(active_statuses),
    ).first():
        return True
    # Como remitente asociado en campaign_senders de una campaña activa
    subq = select(campaign_senders.c.campaign_id).where(campaign_senders.c.sender_id == sender_id)
    if db.query(models.Campaign).filter(
        models.Campaign.id.in_(subq),
        models.Campaign.status.in_(active_statuses),
    ).first():
        return True
    return False


@senders_router.post("/", response_model=SenderRead, status_code=status.HTTP_201_CREATED)
def create_sender(
    payload: SenderCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Registra un remitente: nombre completo y dirección de correo."""
    existing = db.query(models.Sender).filter(models.Sender.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un remitente con ese correo",
        )
    db_sender = models.Sender(full_name=payload.full_name.strip(), email=payload.email)
    db.add(db_sender)
    db.commit()
    db.refresh(db_sender)
    return db_sender


@senders_router.get("/", response_model=List[SenderRead])
def list_senders(
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Lista todos los remitentes registrados."""
    return db.query(models.Sender).order_by(models.Sender.created_at.desc()).all()


@senders_router.get("/{sender_id}", response_model=SenderRead)
def get_sender(
    sender_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Devuelve un remitente por id."""
    sender = _get_sender_by_id(db, sender_id)
    if not sender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sender not found")
    return sender


@senders_router.put("/{sender_id}", response_model=SenderRead)
def update_sender(
    sender_id: str,
    payload: SenderUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Actualiza un remitente (nombre y/o email). Solo se actualizan los campos enviados."""
    sender = _get_sender_by_id(db, sender_id)
    if not sender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sender not found")
    if payload.full_name is not None:
        sender.full_name = payload.full_name.strip()
    if payload.email is not None:
        email = payload.email.strip().lower()
        other = db.query(models.Sender).filter(models.Sender.email == email, models.Sender.id != sender.id).first()
        if other:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe otro remitente con ese correo")
        sender.email = email
    db.add(sender)
    db.commit()
    db.refresh(sender)
    return sender


@senders_router.delete("/{sender_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sender(
    sender_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Elimina un remitente. No se puede eliminar si está en uso en campañas programadas o en ejecución."""
    sender = _get_sender_by_id(db, sender_id)
    if not sender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sender not found")
    if _sender_in_use(db, sender.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar el remitente porque está en uso en una o más campañas programadas o en ejecución",
        )
    db.delete(sender)
    db.commit()
    return None
