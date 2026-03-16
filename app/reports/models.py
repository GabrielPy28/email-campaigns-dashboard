from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class CampaignOpenRecipient(BaseModel):
    recipient_id: str
    email: str
    opens: int = Field(..., description="Número total de aperturas")
    last_opened_at: datetime | None = Field(
        default=None, description="Fecha/hora de la última apertura"
    )


class CampaignOpensReport(BaseModel):
    campaign_id: str
    total_recipients: int
    unique_open_recipients: int
    total_opens: int
    recipients: List[CampaignOpenRecipient]


class CampaignClickSummary(BaseModel):
    campaign_id: str
    recipient_id: str | None = Field(
        default=None, description="ID del destinatario (si se filtró)"
    )
    button_id: str | None = Field(
        default=None, description="ID lógico del botón (si se filtró)"
    )
    total_clicks: int


class CampaignRecipientClicks(BaseModel):
    recipient_id: str
    email: str
    clicks: int = Field(..., description="Número total de clics del destinatario")


class CampaignClicksByRecipientReport(BaseModel):
    campaign_id: str
    recipients: List[CampaignRecipientClicks]


class DeviceCount(BaseModel):
    device: str = Field(..., description="desktop | mobile | tablet | other")
    count: int = 0


class CampaignDevicesReport(BaseModel):
    campaign_id: str
    devices: List[DeviceCount]


class LocationCount(BaseModel):
    country_code: str = Field(..., description="Código ISO del país")
    country_name: str = Field(default="", description="Nombre del país")
    count: int = 0


class CampaignLocationsReport(BaseModel):
    campaign_id: str
    locations: List[LocationCount]


class ButtonClicks(BaseModel):
    button_id: str = Field(..., description="ID del botón en la plantilla")
    clicks: int = Field(..., description="Número de clics en el botón")


class CampaignClicksByButtonReport(BaseModel):
    campaign_id: str
    buttons: List[ButtonClicks]


class BrevoInternalMetricsCompare(BaseModel):
    campaign_id: str
    # Fechas usadas para la consulta en Brevo (para trazabilidad)
    start_date: str
    end_date: str

    internal_unique_opens: int
    internal_total_opens: int
    internal_total_clicks: int

    brevo_unique_opens: int
    brevo_total_opens: int
    brevo_total_clicks: int


