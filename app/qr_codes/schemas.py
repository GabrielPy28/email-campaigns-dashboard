from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class QrCodeCreate(BaseModel):
    name: str | None = Field(default=None, max_length=200, description="Nombre descriptivo")
    target_url: str = Field(..., max_length=2048, description="URL a la que redirige el escaneo")

    @field_validator("target_url")
    @classmethod
    def must_be_http(cls, v: str) -> str:
        s = (v or "").strip()
        if not s.lower().startswith(("http://", "https://")):
            raise ValueError("target_url debe comenzar con http:// o https://")
        return s


class QrCodeUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    target_url: str | None = Field(default=None, max_length=2048)
    clear_custom_image: bool | None = Field(
        default=None,
        description="Si es true, elimina la imagen subida y vuelve a generar el QR en el servidor.",
    )

    @field_validator("target_url")
    @classmethod
    def must_be_http_if_set(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        if not s.lower().startswith(("http://", "https://")):
            raise ValueError("target_url debe comenzar con http:// o https://")
        return s


class QrCodeRead(BaseModel):
    id: str
    name: str | None
    target_url: str
    scan_count: int
    created_at: datetime
    created_by: str
    """generated: PNG generado con la URL de tracking; uploaded: archivo subido por ti."""
    image_mode: Literal["generated", "uploaded"]
    """URL que debe codificar el QR para contar escaneos (GET /qr/{id}/go)."""
    tracking_url: str
    """Ruta relativa para obtener la imagen del QR (GET sin auth)."""
    image_path: str
    """URL absoluta de la imagen (misma base que `API_BASE_URL`)."""
    image_url: str
    """Se incrementa al subir o quitar imagen personalizada; va en `image_url` como query `r` para evitar caché obsoleta."""
    image_revision: int
    """Ruta relativa que registra el escaneo y redirige (GET sin auth)."""
    scan_redirect_path: str

    class Config:
        from_attributes = True


class QrCodeScanDayRow(BaseModel):
    """Día en UTC (YYYY-MM-DD) y escaneos ese día."""

    day: str
    count: int


class QrCodeScanCount(BaseModel):
    qr_code_id: str
    scan_count: int
    scans_by_day: list[QrCodeScanDayRow] = Field(
        default_factory=list,
        description="Histórico por día (UTC), más reciente primero.",
    )


class QrCodeReadList(BaseModel):
    id: str
    name: str | None
    target_url: str
    scan_count: int
    created_at: datetime
    image_mode: Literal["generated", "uploaded"]
    tracking_url: str
    image_path: str
    image_url: str
    image_revision: int

    class Config:
        from_attributes = True
