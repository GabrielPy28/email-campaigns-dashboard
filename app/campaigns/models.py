from datetime import datetime
from typing import List
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


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
        description="Lista de UUIDs de remitentes (uno o más)",
        min_length=1,
    )
    recipients: List[RecipientInput] | None = Field(
        default=None,
        description="Destinatarios manuales (CSV/API)",
    )
    list_id: UUID | None = Field(
        default=None,
        description="UUID de lista de creadores; carga todos los miembros de la lista.",
    )
    creator_ids: List[UUID] | None = Field(
        default=None,
        description="UUIDs de creadores registrados; se usa creator_to_campaign_recipient por fila.",
    )
    segmentation_id: UUID | None = Field(
        default=None,
        description="UUID de segmentación existente para usar sus creadores como destinatarios.",
    )

    @field_validator("creator_ids")
    @classmethod
    def creator_ids_not_empty_if_present(cls, v: List[UUID] | None) -> List[UUID] | None:
        if v is None:
            return None
        if len(v) < 1:
            raise ValueError("creator_ids no puede ser una lista vacía.")
        return v

    @model_validator(mode="after")
    def exactly_one_recipient_source(self):
        has_list = self.list_id is not None
        has_recip = bool(self.recipients and len(self.recipients) > 0)
        has_creators = bool(self.creator_ids and len(self.creator_ids) > 0)
        has_segmentation = self.segmentation_id is not None
        n = sum(1 for x in (has_list, has_recip, has_creators, has_segmentation) if x)
        if n != 1:
            raise ValueError(
                "Indique exactamente un origen de destinatarios: list_id, recipients (no vacío), creator_ids (no vacío) o segmentation_id."
            )
        return self


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
    list_id: str | None = Field(
        default=None,
        description="Lista de creadores usada al crear la campaña (si aplica).",
    )
    segmentation_id: str | None = Field(
        default=None,
        description="Segmentación usada al crear la campaña (si aplica).",
    )
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
