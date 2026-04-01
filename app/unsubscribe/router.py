"""Formulario público de baja de creadores (sin autenticación)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models

unsubscribe_public_router = APIRouter(prefix="/public", tags=["public"])


class CreatorUnsubscribeIn(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    note: str | None = Field(None, max_length=4000)


class CreatorUnsubscribeOut(BaseModel):
    message: str
    creator_deactivated: bool


@unsubscribe_public_router.post(
    "/creator-unsubscribe",
    response_model=CreatorUnsubscribeOut,
    status_code=status.HTTP_200_OK,
)
def register_creator_unsubscribe(
    body: CreatorUnsubscribeIn,
    db: Session = Depends(get_db),
):
    """
    Registra la baja, guarda fila en `unsubscribed_creator` y marca el creador
    en `creators` como inactivo si el email coincide (directorio de producción).
    """
    email_norm = body.email.strip().lower()
    full_name = body.full_name.strip()
    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter your name.",
        )

    creator = (
        db.query(models.Creator)
        .filter(func.lower(models.Creator.email) == email_norm)
        .first()
    )
    creator_id = creator.id if creator else None

    row = models.UnsubscribedCreator(
        full_name=full_name,
        email=body.email.strip(),
        note=(body.note.strip() if body.note and body.note.strip() else None),
        creator_id=creator_id,
    )
    db.add(row)

    deactivated = False
    if creator is not None:
        creator.status = "inactivo"
        deactivated = True

    db.commit()

    return CreatorUnsubscribeOut(
        message="Your request has been recorded. Thank you for your time with us.",
        creator_deactivated=deactivated,
    )
