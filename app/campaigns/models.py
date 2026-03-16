from datetime import datetime
from typing import List
from uuid import UUID

from pydantic import BaseModel, Field


class RecipientInput(BaseModel):
    """Cada destinatario: campos obligatorios id, email, nombre, username; el resto va en extras."""
    id: str = Field(..., description="Identificador del destinatario")
    email: str = Field(..., description="Correo del destinatario")
    nombre: str = Field(..., description="Nombre del destinatario")
    username: str = Field(..., description="Username del destinatario")

    class Config:
        extra = "allow"

    def to_required_and_extra(self) -> tuple[dict, dict]:
        """Devuelve (campos obligatorios, extras como dict)."""
        required = {"id": self.id, "email": self.email, "nombre": self.nombre, "username": self.username}
        extra = {k: v for k, v in self.model_dump().items() if k not in required}
        return required, extra


class CampaignBase(BaseModel):
    name: str = Field(..., max_length=200)
    subject: str | None = Field(
        default=None, max_length=200, description="Asunto del email de la campaña"
    )
    preheader: str | None = Field(
        default=None,
        max_length=255,
        description="Texto de vista previa (preheader) que muestran algunos clientes de correo",
    )
    template_id: UUID = Field(..., description="UUID de la plantilla a usar (GET /templates/)")
    scheduled_at: datetime
    timezone: str = Field(..., max_length=20)
    wait_min_seconds: int = Field(..., ge=1)
    wait_max_seconds: int = Field(..., ge=1)


class CampaignCreate(CampaignBase):
    sender_ids: List[UUID] = Field(
        ...,
        description="Lista de UUIDs de remitentes (uno o más). GET /senders/ para obtener ids.",
        min_length=1,
    )
    recipients: List[RecipientInput] = Field(
        ...,
        description="Lista de destinatarios (id, email, nombre, username + opcionales: vertical, personalized_paragraph, followers, etc.)",
        min_length=1,
    )


class CampaignUpdate(BaseModel):
    """Campos editables de una campaña existente (sin tocar destinatarios)."""

    name: str | None = Field(default=None, max_length=200)
    subject: str | None = Field(
        default=None, max_length=200, description="Asunto del email de la campaña"
    )
    preheader: str | None = Field(
        default=None,
        max_length=255,
        description="Texto de vista previa (preheader)",
    )
    template_id: UUID | None = Field(
        default=None, description="UUID de la plantilla a usar (GET /templates/)"
    )
    scheduled_at: datetime | None = None
    timezone: str | None = Field(default=None, max_length=20)
    wait_min_seconds: int | None = Field(default=None, ge=1)
    wait_max_seconds: int | None = Field(default=None, ge=1)


class RecipientRead(BaseModel):
    id: str
    email: str
    nombre: str
    username: str
    extra: dict = Field(default_factory=dict, description="Campos adicionales: vertical, personalized_paragraph, followers, etc.")


class CampaignRead(CampaignBase):
    id: str
    status: str
    created_by: str
    created_at: datetime
    sender_id: str = Field(..., description="Remitente principal (primero de la lista)")
    sender_name: str = Field(..., description="Nombre del remitente principal")
    sender_ids: List[str] = Field(default_factory=list, description="Todos los sender IDs de la campaña")
    recipients: List[RecipientRead] = Field(default_factory=list, description="Destinatarios con id, email, nombre, username y extras")

    class Config:
        from_attributes = True


class CampaignListRow(BaseModel):
    """Fila para listado/table de campañas con métricas."""
    id: str
    name: str
    sender_name: str
    subject: str | None
    preheader: str | None
    template_name: str | None
    num_recipients: int = 0
    sent_at: datetime | None = None
    total_opens: int = 0
    total_clicks: int = 0
    open_rate_pct: float = 0.0
    click_rate_pct: float = 0.0
    status: str
    created_by: str
    created_at: datetime
    scheduled_at: datetime | None = None
