from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.creators.schemas import CreatorRead

ListaStatus = Literal["activo", "inactivo"]


class ListaCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    status: ListaStatus = Field(default="activo", description="activo | inactivo")


class ListaUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=255)
    status: ListaStatus | None = None


class ListaRead(BaseModel):
    id: str
    nombre: str
    status: str = Field(default="activo", description="activo | inactivo")
    created_at: datetime
    created_by: str
    num_creators: int = Field(0, description="Creadores asociados a la lista")

    class Config:
        from_attributes = True


class ListaDetailRead(ListaRead):
    """Lista con creadores embebidos (opcional)."""

    creators: list[CreatorRead] = Field(default_factory=list)


class LinkManyCreatorsToListBody(BaseModel):
    creator_ids: list[str] = Field(
        ...,
        min_length=1,
        description="UUIDs de creadores existentes para asociar a la lista.",
    )
