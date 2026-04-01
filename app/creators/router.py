"""Creadores maestros (`creators`): CRUD y carga masiva sin pasar por una lista."""

from __future__ import annotations
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session
from app.core.security import get_current_user
from app.lists.creator_utils import apply_creator_fields
from app.creators.io_helpers import (
    bulk_rows_carry_email,
    group_bulk_rows_by_email,
    iter_csv_dict_rows,
    iter_xlsx_dict_rows,
    platform_slug_to_id_map,
    row_to_creator_bulk_kwargs,
)
from app.creators.schemas import CreatorCreate, CreatorRead, CreatorUpdate, PlatformRead
from app.creators.service import (
    count_campaigns_for_creator,
    create_creator_strict,
    creator_to_read,
    load_account_profile_reads,
    save_creator_account_profiles,
    sync_legacy_creator_profile_fields,
    upsert_creator_from_payload,
)
from app.db.session import get_db
from app.db import models


creators_router = APIRouter(prefix="/creadores", tags=["creadores"])


@creators_router.get("/plataformas", response_model=list[PlatformRead])
def list_platforms(
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    rows = db.query(models.Platform).order_by(models.Platform.nombre.asc()).all()
    return [
        PlatformRead(id=str(p.id), nombre=p.nombre, created_at=p.created_at) for p in rows
    ]


def _get_creator_or_404(db: Session, creator_id: uuid.UUID) -> models.Creator:
    c = db.query(models.Creator).filter(models.Creator.id == creator_id).first()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador no encontrado")
    return c


def _count_filtered_creators(db: Session, q) -> int:
    """Cuenta creadores sin usar `q.count()` (puede mutar el Query y romper el `.all()` posterior)."""
    subq = (
        q.with_entities(models.Creator.id)
        .distinct()
        .subquery(name="creators_filtered_ids")
    )
    n = db.query(func.count()).select_from(subq).scalar()
    return int(n or 0)


@creators_router.get("/", response_model=list[CreatorRead])
def list_creators(
    response: Response,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: str | None = Query(None, description="Buscar en email, nombre, username o ID (contiene)"),
    id_contains: str | None = Query(None),
    email_contains: str | None = Query(None),
    first_name_contains: str | None = Query(None),
    last_name_contains: str | None = Query(None),
    username_contains: str | None = Query(None),
    platform_ids: Annotated[list[uuid.UUID] | None, Query(description="Creadores con cuenta en todas estas plataformas (account_profiles)")] = None,
    facebook_page_contains: str | None = Query(None),
    status: str | None = Query(None, description="activo | inactivo"),
    min_campaigns: int | None = Query(None, ge=0),
    max_campaigns: int | None = Query(None, ge=0),
):
    rec_ct = (
        db.query(
            models.CampaignRecipient.recipient_id.label("rid"),
            func.count(models.CampaignRecipient.id).label("cnt"),
        )
        .group_by(models.CampaignRecipient.recipient_id)
    ).subquery()

    nc_expr = func.coalesce(rec_ct.c.cnt, 0)
    q = db.query(models.Creator, nc_expr.label("num_campaigns")).outerjoin(
        rec_ct, rec_ct.c.rid == cast(models.Creator.id, String)
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(
                models.Creator.email.ilike(term),
                models.Creator.full_name.ilike(term),
                models.Creator.first_name.ilike(term),
                models.Creator.last_name.ilike(term),
                models.Creator.username.ilike(term),
                cast(models.Creator.id, String).ilike(term),
            )
        )

    if id_contains and id_contains.strip():
        q = q.filter(cast(models.Creator.id, String).ilike(f"%{id_contains.strip()}%"))
    if email_contains and email_contains.strip():
        q = q.filter(models.Creator.email.ilike(f"%{email_contains.strip()}%"))
    if first_name_contains and first_name_contains.strip():
        q = q.filter(models.Creator.first_name.ilike(f"%{first_name_contains.strip()}%"))
    if last_name_contains and last_name_contains.strip():
        q = q.filter(models.Creator.last_name.ilike(f"%{last_name_contains.strip()}%"))
    if username_contains and username_contains.strip():
        q = q.filter(models.Creator.username.ilike(f"%{username_contains.strip()}%"))
    if platform_ids:
        for pid in platform_ids:
            q = q.filter(
                models.Creator.account_profiles.any(models.AccountProfile.platform_id == pid)
            )
    if facebook_page_contains and facebook_page_contains.strip():
        q = q.filter(models.Creator.facebook_page.ilike(f"%{facebook_page_contains.strip()}%"))

    if status and status.strip() in ("activo", "inactivo"):
        q = q.filter(models.Creator.status == status.strip())

    if min_campaigns is not None:
        q = q.filter(nc_expr >= min_campaigns)
    if max_campaigns is not None:
        q = q.filter(nc_expr <= max_campaigns)

    total = _count_filtered_creators(db, q)
    response.headers["X-Total-Count"] = str(total)
    rows = q.order_by(models.Creator.email.asc()).offset(skip).limit(limit).all()
    return [
        creator_to_read(c, num_campaigns=int(nc or 0), account_profiles=[])
        for c, nc in rows
    ]


@creators_router.get("/{creator_id}", response_model=CreatorRead)
def get_creator(
    creator_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(creator_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador no encontrado")
    c = _get_creator_or_404(db, cid)
    return creator_to_read(
        c,
        num_campaigns=count_campaigns_for_creator(db, c.id),
        account_profiles=load_account_profile_reads(db, c.id),
    )


@creators_router.post("/", response_model=CreatorRead, status_code=status.HTTP_201_CREATED)
def register_creator_master(
    payload: CreatorCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        c = create_creator_strict(db, payload)
    except ValueError as e:
        msg = str(e)
        if msg.startswith("platform_not_found"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Una o más plataformas no existen.",
            )
        if msg == "account_profiles_need_username_or_url":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cada cuenta guardada debe incluir usuario o URL del perfil. "
                "Indica al menos una plataforma con uno de esos datos.",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un creador con ese email.",
        )
    db.commit()
    db.refresh(c)
    return creator_to_read(
        c,
        num_campaigns=0,
        account_profiles=load_account_profile_reads(db, c.id),
    )


def _apply_creator_update(
    db: Session,
    creator: models.Creator,
    payload: CreatorUpdate,
) -> CreatorRead:
    data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    account_profiles = data.pop("account_profiles", None)
    if not data and account_profiles is None:
        return creator_to_read(
            creator,
            num_campaigns=count_campaigns_for_creator(db, creator.id),
            account_profiles=load_account_profile_reads(db, creator.id),
        )
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
    if data:
        apply_creator_fields(creator, **data)
    if account_profiles is not None:
        try:
            save_creator_account_profiles(db, creator.id, account_profiles)
        except ValueError as e:
            msg = str(e)
            if msg.startswith("platform_not_found"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Una o más plataformas no existen.",
                )
            if msg == "account_profiles_need_username_or_url":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cada cuenta guardada debe incluir usuario o URL del perfil. "
                    "Indica al menos una plataforma con uno de esos datos.",
                )
            raise
        sync_legacy_creator_profile_fields(db, creator)
    db.commit()
    db.refresh(creator)
    return creator_to_read(
        creator,
        num_campaigns=count_campaigns_for_creator(db, creator.id),
        account_profiles=load_account_profile_reads(db, creator.id),
    )


@creators_router.patch("/{creator_id}", response_model=CreatorRead)
def update_creator(
    creator_id: str,
    payload: CreatorUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(creator_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador no encontrado")
    creator = _get_creator_or_404(db, cid)
    return _apply_creator_update(db, creator, payload)


@creators_router.put("/{creator_id}", response_model=CreatorRead)
def edit_creator(
    creator_id: str,
    payload: CreatorUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(creator_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador no encontrado")
    creator = _get_creator_or_404(db, cid)
    return _apply_creator_update(db, creator, payload)


@creators_router.delete("/{creator_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_creator(
    creator_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(creator_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador no encontrado")
    creator = _get_creator_or_404(db, cid)
    db.delete(creator)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@creators_router.post("/upload", response_model=dict)
async def upload_creators_file(
    file: UploadFile = File(
        ...,
        description="CSV o XLSX con columna email. Cuentas: {plataforma}_username/url/followers/... "
        "(plataforma = nombre normalizado, ej. instagram). Misma persona: dejar email vacío "
        "hereda el de la fila anterior; varias filas con el mismo email se fusionan.",
    ),
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
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

    ok = 0
    skipped_no_email = len(skipped_carry)
    errors: list[str] = []

    for line_nos, merged in grouped:
        label = f"Fila {line_nos[0]}" if len(line_nos) == 1 else f"Filas {','.join(map(str, line_nos))}"
        try:
            kwargs = row_to_creator_bulk_kwargs(merged, slug_to_id)
            if not kwargs.get("email"):
                skipped_no_email += 1
                continue
            payload = CreatorCreate(**kwargs)
            upsert_creator_from_payload(db, payload)
            ok += 1
        except ValueError as e:
            errors.append(f"{label}: {e}")
        except Exception as e:
            errors.append(f"{label}: {e}")

    db.commit()
    return {
        "rows_upserted": ok,
        "skipped_empty_email": skipped_no_email,
        "errors": errors[:100],
    }
