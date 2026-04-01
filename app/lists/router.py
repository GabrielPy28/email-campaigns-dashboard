"""API de listas y creadores (destinatarios reutilizables para campañas)."""

from __future__ import annotations

import re
import uuid
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from openpyxl import Workbook
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user
from app.creators.io_helpers import (
    bulk_rows_carry_email,
    group_bulk_rows_by_email,
    iter_csv_dict_rows,
    iter_xlsx_dict_rows,
    platform_slug_to_id_map,
    row_to_creator_bulk_kwargs,
)
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
from app.lists.schemas import (
    LinkManyCreatorsToListBody,
    ListaCreate,
    ListaRead,
    ListaUpdate,
)


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
    file: UploadFile = File(
        ...,
        description="CSV o XLSX con columna email. Si el creador existe se actualiza y se asocia; si no existe, se crea y se asocia.",
    ),
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
    name = (file.filename or "").lower()
    rows_iter: list[tuple[int, dict]]
    if name.endswith(".xlsx") or name.endswith(".xlsm"):
        rows_iter = list(iter_xlsx_dict_rows(raw))
    elif name.endswith(".csv"):
        rows_iter = list(iter_csv_dict_rows(raw))
    else:
        content_type = (file.content_type or "").lower()
        if "spreadsheet" in content_type or "excel" in content_type:
            rows_iter = list(iter_xlsx_dict_rows(raw))
        elif "csv" in content_type or "text" in content_type:
            rows_iter = list(iter_csv_dict_rows(raw))
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato no soportado. Use .csv o .xlsx",
            )

    if not rows_iter:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin filas de datos")

    sample_keys = set(rows_iter[0][1].keys())
    if "email" not in sample_keys:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe incluir una columna 'email' (cabecera).",
        )

    slug_to_id = platform_slug_to_id_map(db)
    skipped_carry, carried = bulk_rows_carry_email(rows_iter)
    grouped = group_bulk_rows_by_email(carried)

    linked_new = 0
    already_in_list = 0
    created_creators = 0
    updated_creators = 0
    skipped_empty_email = len(skipped_carry)
    errors: list[str] = []

    for line_nos, merged in grouped:
        label = f"Fila {line_nos[0]}" if len(line_nos) == 1 else f"Filas {','.join(map(str, line_nos))}"
        try:
            kwargs = row_to_creator_bulk_kwargs(merged, slug_to_id)
            email = str(kwargs.get("email") or "").strip().lower()
            if not email:
                skipped_empty_email += 1
                continue
            existed = (
                db.query(models.Creator.id)
                .filter(func.lower(models.Creator.email) == email)
                .first()
                is not None
            )
            payload = CreatorCreate(**kwargs)
            c = upsert_creator_from_payload(db, payload)
            if existed:
                updated_creators += 1
            else:
                created_creators += 1
            if link_creator_to_list(db, lista, c):
                linked_new += 1
            else:
                already_in_list += 1
        except Exception as e:
            errors.append(f"{label}: {e}")

    db.commit()
    return {
        "list_id": str(lista.id),
        "rows_upserted": created_creators + updated_creators,
        "creators_created": created_creators,
        "creators_updated": updated_creators,
        "linked_new": linked_new,
        "already_in_list": already_in_list,
        "skipped_empty_email": skipped_empty_email,
        "errors": errors[:100],
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
    if (creator.status or "activo") != "activo":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El creador está inactivo y no puede añadirse a listas.",
        )
    added = link_creator_to_list(db, lista, creator)
    db.commit()
    return {
        "list_id": str(lista.id),
        "creator_id": str(creator.id),
        "linked": added,
        "message": "Ya estaba en la lista" if not added else "Creador añadido a la lista",
    }


@lists_router.post("/{list_id}/recipients/link-many", response_model=dict)
def link_many_creators_to_list_endpoint(
    list_id: str,
    body: LinkManyCreatorsToListBody,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no válida")
    lista = _get_list_or_404(db, lid)

    linked_new = 0
    already_in_list = 0
    skipped_inactive = 0
    not_found: list[str] = []

    for raw_id in body.creator_ids:
        try:
            cid = uuid.UUID(raw_id)
        except ValueError:
            not_found.append(raw_id)
            continue
        creator = db.query(models.Creator).filter(models.Creator.id == cid).first()
        if not creator:
            not_found.append(raw_id)
            continue
        if (creator.status or "activo") != "activo":
            skipped_inactive += 1
            continue
        if link_creator_to_list(db, lista, creator):
            linked_new += 1
        else:
            already_in_list += 1

    db.commit()
    return {
        "list_id": str(lista.id),
        "requested": len(body.creator_ids),
        "linked_new": linked_new,
        "already_in_list": already_in_list,
        "skipped_inactive": skipped_inactive,
        "not_found": not_found[:100],
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
