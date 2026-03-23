"""Creadores maestros de prueba (`creators_test`)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.creators.io_helpers import (
    bulk_rows_carry_email,
    group_bulk_rows_by_email,
    iter_csv_dict_rows,
    iter_xlsx_dict_rows,
    platform_slug_to_id_map,
    row_to_creator_bulk_kwargs,
)
from app.creators.schemas import CreatorCreate, CreatorRead, CreatorUpdate
from app.creators_test.service import (
    create_creator_strict,
    creator_to_read,
    upsert_creator_from_payload,
)
from app.db.session import get_db
from app.db import models
from app.lists.creator_utils import apply_creator_fields


creators_test_router = APIRouter(prefix="/creadores-test", tags=["creadores-test"])


def _get_creator_or_404(db: Session, creator_id: uuid.UUID) -> models.CreatorTest:
    c = db.query(models.CreatorTest).filter(models.CreatorTest.id == creator_id).first()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador de prueba no encontrado")
    return c


@creators_test_router.get("/", response_model=list[CreatorRead])
def list_creators_test(
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: str | None = Query(None, description="Buscar en email, nombre, username o ID (contiene)"),
    id_contains: str | None = Query(None),
    email_contains: str | None = Query(None),
    first_name_contains: str | None = Query(None),
    last_name_contains: str | None = Query(None),
    username_contains: str | None = Query(None),
    facebook_page_contains: str | None = Query(None),
    status: str | None = Query(None, description="ignorado en test: no hay columna status en creators_test"),
    min_campaigns: int | None = Query(None, ge=0),
    max_campaigns: int | None = Query(None, ge=0),
):
    """Listado alineado con `GET /creadores/`; `num_campaigns` siempre 0; sin `account_profiles`."""
    if min_campaigns is not None and min_campaigns > 0:
        return []
    if max_campaigns is not None and max_campaigns < 0:
        return []

    q = db.query(models.CreatorTest)

    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(
                models.CreatorTest.email.ilike(term),
                models.CreatorTest.full_name.ilike(term),
                models.CreatorTest.first_name.ilike(term),
                models.CreatorTest.last_name.ilike(term),
                models.CreatorTest.username.ilike(term),
                cast(models.CreatorTest.id, String).ilike(term),
            )
        )

    if id_contains and id_contains.strip():
        q = q.filter(cast(models.CreatorTest.id, String).ilike(f"%{id_contains.strip()}%"))
    if email_contains and email_contains.strip():
        q = q.filter(models.CreatorTest.email.ilike(f"%{email_contains.strip()}%"))
    if first_name_contains and first_name_contains.strip():
        q = q.filter(models.CreatorTest.first_name.ilike(f"%{first_name_contains.strip()}%"))
    if last_name_contains and last_name_contains.strip():
        q = q.filter(models.CreatorTest.last_name.ilike(f"%{last_name_contains.strip()}%"))
    if username_contains and username_contains.strip():
        q = q.filter(models.CreatorTest.username.ilike(f"%{username_contains.strip()}%"))
    if facebook_page_contains and facebook_page_contains.strip():
        q = q.filter(
            models.CreatorTest.facebook_page.ilike(f"%{facebook_page_contains.strip()}%")
        )

    rows = q.order_by(models.CreatorTest.email.asc()).offset(skip).limit(limit).all()
    return [creator_to_read(c) for c in rows]


@creators_test_router.get("/{creator_id}", response_model=CreatorRead)
def get_creator_test(
    creator_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(creator_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador de prueba no encontrado")
    return creator_to_read(_get_creator_or_404(db, cid))


@creators_test_router.post("/", response_model=CreatorRead, status_code=status.HTTP_201_CREATED)
def register_creator_master_test(
    payload: CreatorCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        c = create_creator_strict(db, payload)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un creador de prueba con ese email.",
        )
    db.commit()
    db.refresh(c)
    return creator_to_read(c)


def _apply_creator_update_test(
    db: Session,
    creator: models.CreatorTest,
    payload: CreatorUpdate,
) -> CreatorRead:
    data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not data:
        return creator_to_read(creator)
    if "email" in data and data["email"] != creator.email:
        taken = (
            db.query(models.CreatorTest)
            .filter(
                models.CreatorTest.email == data["email"],
                models.CreatorTest.id != creator.id,
            )
            .first()
        )
        if taken:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe otro creador de prueba con ese email.",
            )
    apply_creator_fields(creator, **data)
    db.commit()
    db.refresh(creator)
    return creator_to_read(creator)


@creators_test_router.patch("/{creator_id}", response_model=CreatorRead)
def update_creator_test(
    creator_id: str,
    payload: CreatorUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(creator_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador de prueba no encontrado")
    creator = _get_creator_or_404(db, cid)
    return _apply_creator_update_test(db, creator, payload)


@creators_test_router.put("/{creator_id}", response_model=CreatorRead)
def edit_creator_test(
    creator_id: str,
    payload: CreatorUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(creator_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador de prueba no encontrado")
    creator = _get_creator_or_404(db, cid)
    return _apply_creator_update_test(db, creator, payload)


@creators_test_router.delete("/{creator_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_creator_test(
    creator_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(creator_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador de prueba no encontrado")
    creator = _get_creator_or_404(db, cid)
    db.delete(creator)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@creators_test_router.post("/upload", response_model=dict)
async def upload_creators_file_test(
    file: UploadFile = File(..., description="Archivo .csv o .xlsx; columna requerida: email"),
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
        "scope": "creators_test",
    }
