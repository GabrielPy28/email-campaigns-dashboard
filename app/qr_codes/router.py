"""
Códigos QR: alta (auth), imagen pública y redirección con conteo de escaneos.
Imagen: generada en servidor o PNG/JPEG/WEBP subido por el usuario.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Literal
from io import BytesIO

import qrcode
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import get_current_user
from app.db.session import get_db
from app.db import models
from app.qr_codes.schemas import (
    QrCodeCreate,
    QrCodeRead,
    QrCodeReadList,
    QrCodeScanCount,
    QrCodeScanDayRow,
    QrCodeUpdate,
)

_MAX_IMAGE_BYTES = 2 * 1024 * 1024  # 2 MiB


def _api_public_base() -> str:
    return (os.getenv("API_BASE_URL") or "http://localhost:8000").rstrip("/")


def _scan_url_for_qr(qr_id: uuid.UUID) -> str:
    return f"{_api_public_base()}/qr/{qr_id}/go"


def _scan_bucket_date() -> datetime.date:
    tz_name = (get_settings().qr_scan_timezone or "").strip()
    if tz_name:
        try:
            return datetime.now(ZoneInfo(tz_name)).date()
        except Exception:
            pass
    # Fallback: hora local del sistema donde corre la API.
    return datetime.now().date()


def _image_mode(row: models.QrCode) -> Literal["generated", "uploaded"]:
    return "uploaded" if row.custom_image_data else "generated"


def _bump_image_revision(row: models.QrCode) -> None:
    row.image_revision = int(row.image_revision or 0) + 1


def _to_read(row: models.QrCode) -> QrCodeRead:
    rid = str(row.id)
    base = _api_public_base()
    rev = int(row.image_revision or 0)
    return QrCodeRead(
        id=rid,
        name=row.name,
        target_url=row.target_url,
        scan_count=row.scan_count,
        created_at=row.created_at,
        created_by=row.created_by,
        image_mode=_image_mode(row),
        tracking_url=_scan_url_for_qr(row.id),
        image_path=f"/qr/{rid}/image.png",
        image_url=f"{base}/qr/{rid}/image.png?r={rev}",
        image_revision=rev,
        scan_redirect_path=f"/qr/{rid}/go",
    )


def _to_list_row(row: models.QrCode) -> QrCodeReadList:
    rid = str(row.id)
    base = _api_public_base()
    rev = int(row.image_revision or 0)
    return QrCodeReadList(
        id=rid,
        name=row.name,
        target_url=row.target_url,
        scan_count=row.scan_count,
        created_at=row.created_at,
        image_mode=_image_mode(row),
        tracking_url=_scan_url_for_qr(row.id),
        image_path=f"/qr/{rid}/image.png",
        image_url=f"{base}/qr/{rid}/image.png?r={rev}",
        image_revision=rev,
    )


def _qr_png_bytes(payload: str) -> bytes:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _parse_uploaded_image(raw: bytes) -> tuple[bytes, str]:
    if len(raw) > _MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Imagen demasiado grande (máximo {_MAX_IMAGE_BYTES // (1024 * 1024)} MiB).",
        )
    if len(raw) < 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archivo de imagen inválido o vacío.",
        )
    if raw[:8] == b"\x89PNG\r\n\x1a\n":
        return raw, "image/png"
    if raw[:3] == b"\xff\xd8\xff":
        return raw, "image/jpeg"
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return raw, "image/webp"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Formato no soportado. Use PNG, JPEG o WEBP.",
    )


def _validate_target_url(url: str) -> str:
    s = (url or "").strip()
    if not s.lower().startswith(("http://", "https://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="target_url debe comenzar con http:// o https://",
        )
    return s


qr_codes_router = APIRouter(prefix="/qr-codes", tags=["qr-codes"])

qr_public_router = APIRouter(prefix="/qr", tags=["qr-public"])


@qr_codes_router.post("/", response_model=QrCodeRead, status_code=status.HTTP_201_CREATED)
def create_qr_code(
    payload: QrCodeCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    created_by = current_user.get("name") or current_user.get("email") or ""
    row = models.QrCode(
        name=(payload.name.strip() if payload.name else None) or None,
        target_url=payload.target_url.strip(),
        created_by=created_by,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_read(row)


@qr_codes_router.post("/multipart", response_model=QrCodeRead, status_code=status.HTTP_201_CREATED)
async def create_qr_code_multipart(
    target_url: str = Form(..., description="URL de destino tras el escaneo (vía /go)"),
    name: str | None = Form(None),
    image: UploadFile | None = File(None, description="Imagen del QR (PNG/JPEG/WEBP); opcional"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Alta con formulario multipart: misma lógica que POST / pero permite adjuntar una imagen.
    Si subes imagen, se sirve tal cual en GET /qr/{id}/image.png (el QR impreso debe codificar `tracking_url` para contar escaneos).
    """
    url = _validate_target_url(target_url)
    custom_data = None
    custom_mime = None
    if image is not None and (image.filename or "").strip():
        raw = await image.read()
        if raw:
            custom_data, custom_mime = _parse_uploaded_image(raw)
    created_by = current_user.get("name") or current_user.get("email") or ""
    row = models.QrCode(
        name=(name.strip() if name else None) or None,
        target_url=url,
        created_by=created_by,
        custom_image_data=custom_data,
        custom_image_mime=custom_mime,
        image_revision=1 if custom_data else 0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_read(row)


@qr_codes_router.get("/", response_model=list[QrCodeReadList])
def list_qr_codes(
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    rows = (
        db.query(models.QrCode)
        .order_by(models.QrCode.created_at.desc())
        .all()
    )
    return [_to_list_row(r) for r in rows]


@qr_codes_router.get("/{qr_code_id}", response_model=QrCodeRead)
def get_qr_code(
    qr_code_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        uid = uuid.UUID(qr_code_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    row = db.query(models.QrCode).filter(models.QrCode.id == uid).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    return _to_read(row)


@qr_codes_router.get("/{qr_code_id}/scans", response_model=QrCodeScanCount)
def get_qr_code_scan_count(
    qr_code_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Devuelve cuántas veces se ha escaneado el QR (cada visita a /qr/{id}/go)."""
    try:
        uid = uuid.UUID(qr_code_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    row = db.query(models.QrCode).filter(models.QrCode.id == uid).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    day_rows = (
        db.query(models.QrCodeScanDay)
        .filter(models.QrCodeScanDay.qr_code_id == uid)
        .order_by(models.QrCodeScanDay.scan_date.desc())
        .all()
    )
    return QrCodeScanCount(
        qr_code_id=str(row.id),
        scan_count=row.scan_count,
        scans_by_day=[
            QrCodeScanDayRow(day=d.scan_date.isoformat(), count=d.count) for d in day_rows
        ],
    )


@qr_codes_router.patch("/{qr_code_id}", response_model=QrCodeRead)
def update_qr_code(
    qr_code_id: str,
    payload: QrCodeUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        uid = uuid.UUID(qr_code_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    row = db.query(models.QrCode).filter(models.QrCode.id == uid).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    if payload.name is not None:
        row.name = payload.name.strip() or None
    if payload.target_url is not None:
        row.target_url = payload.target_url.strip()
    if payload.clear_custom_image is True:
        row.custom_image_data = None
        row.custom_image_mime = None
        _bump_image_revision(row)
    db.commit()
    db.refresh(row)
    return _to_read(row)


@qr_codes_router.put("/{qr_code_id}/custom-image", response_model=QrCodeRead)
async def set_qr_custom_image(
    qr_code_id: str,
    image: UploadFile = File(..., description="PNG, JPEG o WEBP"),
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        uid = uuid.UUID(qr_code_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    row = db.query(models.QrCode).filter(models.QrCode.id == uid).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    raw = await image.read()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archivo vacío.",
        )
    data, mime = _parse_uploaded_image(raw)
    row.custom_image_data = data
    row.custom_image_mime = mime
    _bump_image_revision(row)
    db.commit()
    db.refresh(row)
    return _to_read(row)


@qr_codes_router.delete("/{qr_code_id}/custom-image", response_model=QrCodeRead)
def remove_qr_custom_image(
    qr_code_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        uid = uuid.UUID(qr_code_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    row = db.query(models.QrCode).filter(models.QrCode.id == uid).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    row.custom_image_data = None
    row.custom_image_mime = None
    _bump_image_revision(row)
    db.commit()
    db.refresh(row)
    return _to_read(row)


@qr_codes_router.delete("/{qr_code_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_qr_code(
    qr_code_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        uid = uuid.UUID(qr_code_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    row = db.query(models.QrCode).filter(models.QrCode.id == uid).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    db.delete(row)
    db.commit()
    return None


@qr_public_router.get("/{qr_id}/go")
def qr_scan_redirect(
    qr_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """
    URL codificada en el QR: incrementa el contador total y suma el día actual
    en `qr_code_scan_days` y redirige a `target_url`.
    No requiere autenticación (lectores de QR abren el enlace directamente).
    """
    row = db.query(models.QrCode).filter(models.QrCode.id == qr_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    target = row.target_url
    today = _scan_bucket_date()

    db.execute(
        update(models.QrCode)
        .where(models.QrCode.id == qr_id)
        .values(scan_count=models.QrCode.scan_count + 1)
    )

    day_tbl = models.QrCodeScanDay.__table__
    upsert = pg_insert(day_tbl).values(qr_code_id=qr_id, scan_date=today, count=1)
    upsert = upsert.on_conflict_do_update(
        index_elements=[day_tbl.c.qr_code_id, day_tbl.c.scan_date],
        set_={"count": day_tbl.c.count + 1},
    )
    db.execute(upsert)
    db.commit()
    return RedirectResponse(url=target, status_code=302)


@qr_public_router.get("/{qr_id}/image.png")
def qr_image_png(
    qr_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """
    Imagen del QR: si hay archivo subido, se devuelve tal cual; si no, PNG generado
    con la URL absoluta de `/qr/{id}/go` (usa `API_BASE_URL` en el servidor).
    """
    row = db.query(models.QrCode).filter(models.QrCode.id == qr_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR no encontrado")
    if row.custom_image_data:
        media = row.custom_image_mime or "image/png"
        body = row.custom_image_data
    else:
        media = "image/png"
        body = _qr_png_bytes(_scan_url_for_qr(qr_id))
    return Response(
        content=body,
        media_type=media,
        headers={
            # La imagen cambia al subir diseño; sin must-revalidate el navegador reutiliza PNG antiguo con la misma URL.
            "Cache-Control": "private, max-age=0, must-revalidate",
        },
    )
