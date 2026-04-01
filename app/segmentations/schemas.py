from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


SegmentationCriteria = Literal["no_open", "opened_no_click", "opened_and_clicked"]
SegmentationStatus = Literal["activo", "inactivo"]


class SegmentationCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    campaign_ids: list[str] = Field(
        ...,
        min_length=1,
        description="UUIDs de campañas origen en orden.",
    )
    criteria: SegmentationCriteria
    status: SegmentationStatus = "activo"

    @model_validator(mode="after")
    def validate_campaign_ids(self):
        if len(self.campaign_ids) != len(set(self.campaign_ids)):
            raise ValueError("campaign_ids no debe repetir IDs.")
        return self


class SegmentationRead(BaseModel):
    id: str
    nombre: str
    campaign_id: str
    campaign_ids: list[str] = Field(default_factory=list)
    criteria: SegmentationCriteria
    status: SegmentationStatus
    created_at: datetime
    created_by: str
    num_creators: int

    class Config:
        from_attributes = True


class SegmentationUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=255)
    campaign_ids: list[str] | None = Field(default=None, min_length=1)
    criteria: SegmentationCriteria | None = None
    status: SegmentationStatus | None = None

    @model_validator(mode="after")
    def validate_campaign_ids(self):
        if self.campaign_ids is not None and len(self.campaign_ids) != len(set(self.campaign_ids)):
            raise ValueError("campaign_ids no debe repetir IDs.")
        return self
