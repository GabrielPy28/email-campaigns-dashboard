from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class SenderCreate(BaseModel):
    full_name: str = Field(..., max_length=255, description="Nombre completo del remitente")
    email: EmailStr = Field(..., description="Dirección de correo del remitente")


class SenderUpdate(BaseModel):
    """Campos opcionales para actualizar un remitente."""
    full_name: Optional[str] = Field(None, max_length=255, description="Nombre completo del remitente")
    email: Optional[EmailStr] = Field(None, description="Dirección de correo del remitente")


class SenderRead(BaseModel):
    id: str
    full_name: str
    email: str
    created_at: datetime

    @field_validator("id", mode="before")
    @classmethod
    def id_to_str(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True
