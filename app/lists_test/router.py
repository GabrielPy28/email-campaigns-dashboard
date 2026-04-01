"""Listas de prueba (`listas_test` / `creators_test` / `creators_list_test`)."""

from __future__ import annotations

import csv
import io
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
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
from app.creators_test.service import (
    creator_to_read,
    link_creator_to_list,
    upsert_creator_from_payload,
)
from app.db.session import get_db
from app.db import models
from app.lists.creator_utils import apply_creator_fields
from app.lists.schemas import ListaCreate, ListaRead, ListaUpdate


lists_test_router = APIRouter(prefix="/listas-test", tags=["listas-test"])


def _get_list_or_404(db: Session, list_id: uuid.UUID) -> models.ListaTest:
    lista = db.query(models.ListaTest).filter(models.ListaTest.id == list_id).first()
    if not lista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista de prueba no encontrada")
    return lista


def _count_creators(db: Session, list_id: uuid.UUID) -> int:
    return (
        db.query(func.count())
        .select_from(models.creators_list_test)
        .filter(models.creators_list_test.c.list_id == list_id)
        .scalar()
        or 0
    )


def _lista_read_test(db: Session, lista: models.ListaTest) -> ListaRead:
    return ListaRead(
        id=str(lista.id),
        nombre=lista.nombre,
        status=getattr(lista, "status", None) or "activo",
        created_at=lista.created_at,
        created_by=lista.created_by,
        num_creators=_count_creators(db, lista.id),
    )


@lists_test_router.post("/", response_model=ListaRead, status_code=status.HTTP_201_CREATED)
def create_list_test(
    payload: ListaCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    created_by = current_user.get("name") or current_user.get("email") or ""
    lista = models.ListaTest(
        nombre=payload.nombre.strip(),
        created_by=created_by,
        status=payload.status,
    )
    db.add(lista)
    db.commit()
    db.refresh(lista)
    return _lista_read_test(db, lista)


@lists_test_router.get("/", response_model=list[ListaRead])
def get_lists_test(
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
    search: str | None = Query(None, description="Buscar por nombre o ID (contiene)"),
    nombre_contains: str | None = Query(None),
    id_contains: str | None = Query(None),
    status: str | None = Query(None, description="activo | inactivo"),
):
    q = db.query(models.ListaTest)
    term = (search or "").strip()
    if term:
        t = f"%{term}%"
        q = q.filter(
            or_(
                models.ListaTest.nombre.ilike(t),
                cast(models.ListaTest.id, String).ilike(t),
            )
        )
    if nombre_contains and nombre_contains.strip():
        q = q.filter(models.ListaTest.nombre.ilike(f"%{nombre_contains.strip()}%"))
    if id_contains and id_contains.strip():
        q = q.filter(cast(models.ListaTest.id, String).ilike(f"%{id_contains.strip()}%"))
    if status and status.strip() in ("activo", "inactivo"):
        q = q.filter(models.ListaTest.status == status.strip())
    rows = q.order_by(models.ListaTest.created_at.desc()).all()
    return [_lista_read_test(db, lista) for lista in rows]


@lists_test_router.patch("/{list_id}", response_model=ListaRead)
def update_list_test(
    list_id: str,
    payload: ListaUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista de prueba no encontrada")
    lista = _get_list_or_404(db, lid)
    data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not data:
        return _lista_read_test(db, lista)
    if "nombre" in data and data["nombre"] is not None:
        lista.nombre = data["nombre"].strip()
    if "status" in data and data["status"] is not None:
        lista.status = data["status"]
    db.commit()
    db.refresh(lista)
    return _lista_read_test(db, lista)


@lists_test_router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list_test(
    list_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista de prueba no encontrada")
    lista = _get_list_or_404(db, lid)
    db.delete(lista)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@lists_test_router.get("/{list_id}/recipients", response_model=list[CreatorRead])
def get_recipients_of_list_test(
    list_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista de prueba no encontrada")
    lista = (
        db.query(models.ListaTest)
        .options(joinedload(models.ListaTest.creators))
        .filter(models.ListaTest.id == lid)
        .first()
    )
    if not lista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista de prueba no encontrada")
    creators_sorted = sorted(lista.creators, key=lambda c: c.email.lower())
    return [creator_to_read(db, c) for c in creators_sorted]


@lists_test_router.post("/{list_id}/recipients/upload", response_model=dict)
async def upload_recipients_to_list_test(
    list_id: str,
    file: UploadFile = File(..., description="CSV con cabecera; columna requerida: email"),
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista de prueba no encontrada")
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
        "scope": "listas_test",
    }


@lists_test_router.post(
    "/{list_id}/recipients",
    response_model=CreatorRead,
    status_code=status.HTTP_201_CREATED,
)
def register_recipient_test(
    list_id: str,
    payload: CreatorCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista de prueba no encontrada")
    lista = _get_list_or_404(db, lid)
    creator = upsert_creator_from_payload(db, payload)
    link_creator_to_list(db, lista, creator)
    db.commit()
    db.refresh(creator)
    return creator_to_read(db, creator)


@lists_test_router.post("/{list_id}/recipients/link", response_model=dict)
def link_creator_to_list_test_endpoint(
    list_id: str,
    body: LinkCreatorToListBody,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Asocia un creador de `creators_test` a la lista de prueba."""
    try:
        lid = uuid.UUID(list_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no válida")
    cid = body.creator_id
    lista = _get_list_or_404(db, lid)
    creator = db.query(models.CreatorTest).filter(models.CreatorTest.id == cid).first()
    if not creator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador de prueba no encontrado")
    added = link_creator_to_list(db, lista, creator)
    db.commit()
    return {
        "list_id": str(lista.id),
        "creator_id": str(creator.id),
        "linked": added,
        "message": "Ya estaba en la lista" if not added else "Creador añadido a la lista",
        "scope": "listas_test",
    }


@lists_test_router.get("/{list_id}/recipients/{creator_id}", response_model=CreatorRead)
def get_recipient_test(
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
        db.query(models.ListaTest)
        .options(joinedload(models.ListaTest.creators))
        .filter(models.ListaTest.id == lid)
        .first()
    )
    if not lista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista de prueba no encontrada")
    creator = next((c for c in lista.creators if c.id == cid), None)
    if not creator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador no está en esta lista")
    return creator_to_read(db, creator)


def _update_recipient_impl_test(
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
        db.query(models.ListaTest)
        .options(joinedload(models.ListaTest.creators))
        .filter(models.ListaTest.id == lid)
        .first()
    )
    if not lista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista de prueba no encontrada")
    creator = next((c for c in lista.creators if c.id == cid), None)
    if not creator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador no está en esta lista")

    data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if data:
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
    return creator_to_read(db, creator)


@lists_test_router.patch("/{list_id}/recipients/{creator_id}", response_model=CreatorRead)
def update_recipient_test(
    list_id: str,
    creator_id: str,
    payload: CreatorUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    return _update_recipient_impl_test(list_id, creator_id, payload, db)


@lists_test_router.put("/{list_id}/recipients/{creator_id}", response_model=CreatorRead)
def edit_recipient_test(
    list_id: str,
    creator_id: str,
    payload: CreatorUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    return _update_recipient_impl_test(list_id, creator_id, payload, db)


@lists_test_router.delete("/{list_id}/recipients/{creator_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipient_test(
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
        db.query(models.ListaTest)
        .options(joinedload(models.ListaTest.creators))
        .filter(models.ListaTest.id == lid)
        .first()
    )
    if not lista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista de prueba no encontrada")
    creator = next((c for c in lista.creators if c.id == cid), None)
    if not creator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creador no está en esta lista")

    lista.creators.remove(creator)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
