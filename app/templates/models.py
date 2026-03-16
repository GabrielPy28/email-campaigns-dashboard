from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class TemplateCreate(BaseModel):
    name: str = Field(..., max_length=200, description="Nombre de la plantilla")


class TemplateCreateFromHtml(BaseModel):
    name: str = Field(..., max_length=200, description="Nombre de la plantilla")
    html_content: str = Field(..., description="Contenido HTML de la plantilla")


class TemplateUpdate(BaseModel):
    """Campos opcionales para actualizar una plantilla."""
    name: Optional[str] = Field(None, max_length=200, description="Nombre de la plantilla")
    html_content: Optional[str] = Field(None, description="Contenido HTML de la plantilla")


class TemplateRead(BaseModel):
    id: str
    name: Optional[str] = None
    created_at: datetime

    @field_validator("id", mode="before")
    @classmethod
    def id_to_str(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True


class TemplateDetail(TemplateRead):
    html_content: str = ""

    class Config:
        from_attributes = True
