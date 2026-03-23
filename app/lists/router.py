"""API de listas y creadores (destinatarios reutilizables para campañas)."""

from __future__ import annotations

import csv
import io
import re
import uuid
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from openpyxl import Workbook
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user
from app.creators.io_helpers import normalize_csv_header, normalize_row_keys, row_to_creator_kwargs
from app.creators.schemas import (
    CreatorCreate,
    CreatorRead,
    CreatorUpdate,
    LinkCreatorToListBody,
)
from app.creators.service import (
    count_campaigns_for_creator,
    creator_to_read,
    link_creator_to_list,
    load_account_profile_reads,
    upsert_creator_from_payload,
)
from app.db.session import get_db
from app.db import models
from app.lists.creator_utils import apply_creator_fields
from app.lists.schemas import ListaCreate, ListaRead, ListaUpdate


lists_router = APIRouter(prefix="/listas", tags=["listas"])


def _get_list_or_404(db: Session, list_id: uuid.UUID) -> models.Lista:
    lista = db.query(models.Lista).filter(models.Lista.id == list_id).first()
    if not lista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")
    return lista


def _count_creators(db: Session, list_id: uuid.UUID) -> int:
    return (
        db.query(func.count())
        .select_from(models.creators_list)
        .filter(models.creators_list.c.list_id == list_id)
        .scalar()
        or 0
    )


def _lista_read(db: Session, lista: models.Lista) -> ListaRead:
    return ListaRead(
        id=str(lista.id),
        nombre=lista.nombre,
        status=getattr(lista, "status", None) or "activo",
        created_at=lista.created_at,
        created_by=lista.created_by,
        num_creators=_count_creators(db, lista.id),
    )


@lists_router.post("/", response_model=ListaRead, status_code=status.HTTP_201_CREATED)
def create_list(
    payload: ListaCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    created_by = current_user.get("name") or current_user.get("email") or ""
    lista = models.Lista(
        nombre=payload.nombre.strip(),
        created_by=created_by,
        status=payload.status,
    )
    db.add(lista)
    db.commit()
    db.refresh(lista)
    return _lista_read(db, lista)


@lists_router.get("/", response_model=list[ListaRead])
def get_lists(
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
    search: str | None = Query(
        None,
        description="Buscar por nombre o ID de lista (contiene)",
    ),
    nombre_contains: str | None = Query(None),
    id_contains: str | None = Query(None),
    status: str | None = Query(None, description="activo | inactivo"),
):
    q = db.query(models.Lista)
    term = (search or "").strip()
    if term:
        t = f"%{term}%"
        q = q.filter(
            or_(
                models.Lista.nombre.ilike(t),
                cast(models.Lista.id, String).ilike(t),
            )
        )
    if nombre_contains and nombre_contains.strip():
        q = q.filter(models.Lista.nombre.ilike(f"%{nombre_contains.strip()}%"))
    if id_contains and id_contains.strip():
        q = q.filter(cast(models.Lista.id, String).ilike(f"%{id_contains.strip()}%"))
    if status and status.strip() in ("activo", "inactivo"):
        q = q.filter(models.Lista.status == status.strip())
    rows = q.order_by(models.Lista.created_at.desc()).all()
    return [_lista_read(db, lista) for lista in rows]


@lists_router.patch("/{list_id}", response_model=ListaRead)
def update_list(
    list_id: str,
    payload: ListaUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")
    lista = _get_list_or_404(db, lid)
    data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not data:
        return _lista_read(db, lista)
    if "nombre" in data and data["nombre"] is not None:
        lista.nombre = data["nombre"].strip()
    if "status" in data and data["status"] is not None:
        lista.status = data["status"]
    db.commit()
    db.refresh(lista)
    return _lista_read(db, lista)


@lists_router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(
    list_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")
    lista = _get_list_or_404(db, lid)
    db.delete(lista)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@lists_router.get("/{list_id}/recipients", response_model=list[CreatorRead])
def get_recipients_of_list(
    list_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")
    lista = (
        db.query(models.Lista)
        .options(joinedload(models.Lista.creators))
        .filter(models.Lista.id == lid)
        .first()
    )
    if not lista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")
    creators_sorted = sorted(lista.creators, key=lambda c: c.email.lower())
    return [
        creator_to_read(
            c,
            num_campaigns=count_campaigns_for_creator(db, c.id),
            account_profiles=load_account_profile_reads(db, c.id),
        )
        for c in creators_sorted
    ]


def _safe_filename_part(s: str, max_len: int = 40) -> str:
    t = re.sub(r"[^\w\s\-]", "", s, flags=re.UNICODE).strip()
    t = re.sub(r"\s+", "-", t)[:max_len]
    return t or "lista"


@lists_router.get("/{list_id}/recipients/export")
def export_list_recipients_excel(
    list_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")
    lista = (
        db.query(models.Lista)
        .options(joinedload(models.Lista.creators))
        .filter(models.Lista.id == lid)
        .first()
    )
    if not lista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")
    creators_sorted = sorted(lista.creators, key=lambda c: c.email.lower())

    headers = [
        "id",
        "email",
        "first_name",
        "last_name",
        "full_name",
        "username",
        "status",
        "instagram_username",
        "tiktok_username",
        "youtube_channel",
        "instagram_url",
        "tiktok_url",
        "youtube_channel_url",
        "max_followers",
        "main_platform",
        "category",
        "facebook_page",
        "personalized_paragraph",
    ]
    wb = Workbook()
    ws = wb.active
    ws.title = "Creadores"
    ws.append(headers)
    for c in creators_sorted:
        ws.append(
            [
                str(c.id),
                c.email,
                c.first_name or "",
                c.last_name or "",
                c.full_name or "",
                c.username or "",
                getattr(c, "status", None) or "activo",
                c.instagram_username or "",
                c.tiktok_username or "",
                c.youtube_channel or "",
                c.instagram_url or "",
                c.tiktok_url or "",
                c.youtube_channel_url or "",
                c.max_followers if c.max_followers is not None else "",
                getattr(c, "main_platform", None) or "",
                c.category or "",
                c.facebook_page or "",
                c.personalized_paragraph or "",
            ]
        )
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    name_part = _safe_filename_part(lista.nombre)
    filename = f"lista-{name_part}-{lid}.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@lists_router.post("/{list_id}/recipients/upload", response_model=dict)
async def upload_recipients_to_list(
    list_id: str,
    file: UploadFile = File(..., description="CSV con cabecera; columna requerida: email"),
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")
    lista = _get_list_or_404(db, lid)

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivo vacío")
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV sin cabecera")

    fieldmap = {normalize_csv_header(h): h for h in reader.fieldnames if h}
    if "email" not in fieldmap:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El CSV debe incluir una columna 'email'.",
        )

    linked_new = 0
    already_in_list = 0
    skipped_empty_email = 0
    errors: list[str] = []

    for i, row in enumerate(reader, start=2):
        norm = normalize_row_keys(dict(row))
        kwargs = row_to_creator_kwargs(norm)
        if not kwargs.get("email"):
            skipped_empty_email += 1
            continue
        try:
            payload = CreatorCreate(**kwargs)
            c = upsert_creator_from_payload(db, payload)
            if link_creator_to_list(db, lista, c):
                linked_new += 1
            else:
                already_in_list += 1
        except Exception as e:
            errors.append(f"Fila {i}: {e}")

    db.commit()
    return {
        "list_id": str(lista.id),
        "linked_new": linked_new,
        "already_in_list": already_in_list,
        "skipped_empty_email": skipped_empty_email,
        "errors": errors[:50],
    }


@lists_router.post(
    "/{list_id}/recipients",
    response_model=CreatorRead,
    status_code=status.HTTP_201_CREATED,
)
def register_recipient(
    list_id: str,
    payload: CreatorCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")
    lista = _get_list_or_404(db, lid)
    creator = upsert_creator_from_payload(db, payload)
    link_creator_to_list(db, lista, creator)
    db.commit()
    db.refresh(creator)
    return creator_to_read(
        creator,
        num_campaigns=count_campaigns_for_creator(db, creator.id),
        account_profiles=load_account_profile_reads(db, creator.id),
    )


@lists_router.post("/{list_id}/recipients/link", response_model=dict)
def link_creator_to_list_endpoint(
    list_id: str,
    body: LinkCreatorToListBody,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Asocia un creador ya existente (tabla `creators`) a la lista, sin editar sus datos."""
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no válida")
    cid = body.creator_id
    lista = _get_list_or_404(db, lid)
    creator = db.query(models.Creator).filter(models.Creator.id == cid).first()
    if not creator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador no encontrado")
    added = link_creator_to_list(db, lista, creator)
    db.commit()
    return {
        "list_id": str(lista.id),
        "creator_id": str(creator.id),
        "linked": added,
        "message": "Ya estaba en la lista" if not added else "Creador añadido a la lista",
    }


@lists_router.get("/{list_id}/recipients/{creator_id}", response_model=CreatorRead)
def get_recipient(
    list_id: str,
    creator_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
        cid = uuid.UUID(creator_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado")
    lista = (
        db.query(models.Lista)
        .options(joinedload(models.Lista.creators))
        .filter(models.Lista.id == lid)
        .first()
    )
    if not lista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")
    creator = next((c for c in lista.creators if c.id == cid), None)
    if not creator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador no está en esta lista")
    return creator_to_read(
        creator,
        num_campaigns=count_campaigns_for_creator(db, creator.id),
        account_profiles=load_account_profile_reads(db, creator.id),
    )


def _update_recipient_impl(
    list_id: str,
    creator_id: str,
    payload: CreatorUpdate,
    db: Session,
) -> CreatorRead:
    try:
        lid = uuid.UUID(list_id)
        cid = uuid.UUID(creator_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado")
    lista = (
        db.query(models.Lista)
        .options(joinedload(models.Lista.creators))
        .filter(models.Lista.id == lid)
        .first()
    )
    if not lista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")
    creator = next((c for c in lista.creators if c.id == cid), None)
    if not creator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador no está en esta lista")

    data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if data:
        if "email" in data and data["email"] != creator.email:
            taken = (
                db.query(models.Creator)
                .filter(
                    models.Creator.email == data["email"],
                    models.Creator.id != creator.id,
                )
                .first()
            )
            if taken:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe otro creador con ese email.",
                )
        apply_creator_fields(creator, **data)
    db.commit()
    db.refresh(creator)
    return creator_to_read(
        creator,
        num_campaigns=count_campaigns_for_creator(db, creator.id),
        account_profiles=load_account_profile_reads(db, creator.id),
    )


@lists_router.patch("/{list_id}/recipients/{creator_id}", response_model=CreatorRead)
def update_recipient(
    list_id: str,
    creator_id: str,
    payload: CreatorUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    return _update_recipient_impl(list_id, creator_id, payload, db)


@lists_router.put("/{list_id}/recipients/{creator_id}", response_model=CreatorRead)
def edit_recipient(
    list_id: str,
    creator_id: str,
    payload: CreatorUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Misma lógica que PATCH (campos parciales con exclude_unset)."""
    return _update_recipient_impl(list_id, creator_id, payload, db)


@lists_router.delete("/{list_id}/recipients/{creator_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipient(
    list_id: str,
    creator_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
        cid = uuid.UUID(creator_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado")
    lista = (
        db.query(models.Lista)
        .options(joinedload(models.Lista.creators))
        .filter(models.Lista.id == lid)
        .first()
    )
    if not lista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")
    creator = next((c for c in lista.creators if c.id == cid), None)
    if not creator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador no está en esta lista")

    lista.creators.remove(creator)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@lists_router.get("/{list_id}", response_model=ListaRead)
def get_list(
    list_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Metadatos de una lista por UUID."""
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")
    lista = _get_list_or_404(db, lid)
    return _lista_read(db, lista)
