import uuid
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, status, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.db import models
from app.templates.models import TemplateRead, TemplateDetail, TemplateCreateFromHtml, TemplateUpdate
from app.core.security import get_current_user


templates_router = APIRouter(prefix="/templates", tags=["templates"])


@templates_router.post("/", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
def create_template(
    name: str = Form(..., description="Nombre de la plantilla"),
    file: UploadFile = File(..., description="Archivo HTML"),
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Registra una plantilla: nombre + archivo HTML. El sistema asigna el id."""
    if not file.filename or not file.filename.lower().endswith((".html", ".htm")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se debe subir un archivo .html o .htm",
        )
    content = file.file.read()
    try:
        html_content = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe estar codificado en UTF-8",
        )

    db_template = models.Template(name=name.strip() or None, html_content=html_content)
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


@templates_router.post("/from-html", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
def create_template_from_html(
    payload: TemplateCreateFromHtml,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Registra una plantilla con contenido HTML enviado en JSON (p. ej. desde editor en Nueva Campaña)."""
    db_template = models.Template(
        name=payload.name.strip() or None,
        html_content=payload.html_content,
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


@templates_router.get("/", response_model=List[TemplateRead])
def list_templates(
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Lista todas las plantillas (id, nombre, created_at)."""
    return db.query(models.Template).order_by(models.Template.created_at.desc()).all()


def _get_template_by_id(db: Session, template_id: str):
    try:
        tid = uuid.UUID(template_id)
    except ValueError:
        return None
    return db.query(models.Template).filter(models.Template.id == tid).first()


@templates_router.get("/{template_id}/download")
def download_template_html(
    template_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Devuelve el archivo HTML de la plantilla para descarga."""
    template = _get_template_by_id(db, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    filename = f"plantilla-{template_id}.html"
    return Response(
        content=template.html_content or "",
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@templates_router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Elimina una plantilla. No se puede eliminar si está en uso por alguna campaña."""
    template = _get_template_by_id(db, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    in_use = db.query(func.count(models.Campaign.id)).filter(models.Campaign.template_id == template.id).scalar()
    if in_use and in_use > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar la plantilla porque está en uso por una o más campañas",
        )
    db.delete(template)
    db.commit()
    return None


@templates_router.put("/{template_id}", response_model=TemplateRead)
def update_template(
    template_id: str,
    payload: TemplateUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Actualiza una plantilla (nombre y/o contenido HTML). Solo se actualizan los campos enviados."""
    template = _get_template_by_id(db, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    if payload.name is not None:
        template.name = payload.name.strip() or None
    if payload.html_content is not None:
        template.html_content = payload.html_content
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@templates_router.get("/{template_id}", response_model=TemplateDetail)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Devuelve una plantilla por id, incluyendo el contenido HTML."""
    template = _get_template_by_id(db, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template
