from __future__ import annotations

import uuid
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from openpyxl import Workbook
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user
from app.creators.service import count_campaigns_for_creator, creator_to_read, load_account_profile_reads
from app.db import models
from app.db.session import get_db
from app.segmentations.schemas import SegmentationCreate, SegmentationRead, SegmentationUpdate


segmentations_router = APIRouter(prefix="/segmentaciones", tags=["segmentaciones"])


def _seg_to_read(db: Session, seg: models.Segmentation) -> SegmentationRead:
    num_creators = (
        db.query(func.count())
        .select_from(models.segmentations_creators)
        .filter(models.segmentations_creators.c.segmentation_id == seg.id)
        .scalar()
        or 0
    )
    campaign_ids = [
        str(x.campaign_id) for x in sorted(seg.source_campaigns, key=lambda s: s.position)
    ]
    return SegmentationRead(
        id=str(seg.id),
        nombre=seg.nombre,
        campaign_id=str(seg.campaign_id),
        campaign_ids=campaign_ids,
        criteria=seg.criteria,
        status=seg.status,
        created_at=seg.created_at,
        created_by=seg.created_by,
        num_creators=int(num_creators),
    )


def _replace_sources_and_members(
    db: Session,
    seg: models.Segmentation,
    campaign_ids: list[uuid.UUID],
    criteria: str,
) -> None:
    creators = _resolve_segmented_creators(db, campaign_ids, criteria)
    db.query(models.SegmentationCampaignSource).filter(
        models.SegmentationCampaignSource.segmentation_id == seg.id
    ).delete(synchronize_session=False)
    for idx, cid in enumerate(campaign_ids):
        db.add(
            models.SegmentationCampaignSource(
                segmentation_id=seg.id,
                campaign_id=cid,
                position=idx,
            )
        )
    seg.creators.clear()
    for creator in creators:
        seg.creators.append(creator)


def _resolve_segmented_creators(
    db: Session,
    campaign_ids: list[uuid.UUID],
    criteria: str,
) -> list[models.Creator]:
    # Dedupe por email; si aparece en varias campañas, gana la última campaña seleccionada.
    by_email: dict[str, models.Creator] = {}
    creator_id_by_email: dict[str, str] = {}
    for cid in campaign_ids:
        campaign = (
            db.query(models.Campaign)
            .options(joinedload(models.Campaign.recipients))
            .filter(models.Campaign.id == cid)
            .first()
        )
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaña no encontrada: {cid}")
        for r in campaign.recipients:
            em = (r.email or "").strip().lower()
            if not em:
                continue
            # Solo creadores del directorio (recipient_id = UUID de creators)
            try:
                uuid.UUID(str(r.recipient_id))
            except ValueError:
                continue
            creator_id_by_email[em] = str(r.recipient_id)

    if not creator_id_by_email:
        return []

    creator_ids = list(set(creator_id_by_email.values()))
    creator_rows = (
        db.query(models.Creator)
        .filter(models.Creator.id.in_([uuid.UUID(x) for x in creator_ids]))
        .all()
    )
    creators_by_id = {str(c.id): c for c in creator_rows}
    for em, cid in creator_id_by_email.items():
        c = creators_by_id.get(cid)
        if c:
            by_email[em] = c

    if not by_email:
        return []

    scoped_campaign_ids = campaign_ids
    open_ids = set(
        rid for (rid,) in db.query(models.EmailOpen.recipient_id)
        .filter(models.EmailOpen.campaign_id.in_(scoped_campaign_ids), models.EmailOpen.recipient_id.in_(creator_ids))
        .distinct()
        .all()
    )
    click_ids = set(
        rid for (rid,) in db.query(models.EmailClick.recipient_id)
        .filter(models.EmailClick.campaign_id.in_(scoped_campaign_ids), models.EmailClick.recipient_id.in_(creator_ids))
        .distinct()
        .all()
    )

    out: list[models.Creator] = []
    for c in by_email.values():
        if (c.status or "activo") != "activo":
            continue
        rid = str(c.id)
        has_open = rid in open_ids
        has_click = rid in click_ids
        if criteria == "no_open" and not has_open:
            out.append(c)
        elif criteria == "opened_no_click" and has_open and not has_click:
            out.append(c)
        elif criteria == "opened_and_clicked" and has_open and has_click:
            out.append(c)
    return sorted(out, key=lambda x: x.email.lower())


@segmentations_router.post("/", response_model=SegmentationRead, status_code=status.HTTP_201_CREATED)
def create_segmentation(
    payload: SegmentationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        campaign_uuids = [uuid.UUID(x) for x in payload.campaign_ids]
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="IDs inválidos.")
    creators = _resolve_segmented_creators(db, campaign_uuids, payload.criteria)
    created_by = current_user.get("name") or current_user.get("email") or ""
    seg = models.Segmentation(
        nombre=payload.nombre.strip(),
        campaign_id=campaign_uuids[0],
        criteria=payload.criteria,
        status=payload.status,
        created_by=created_by,
    )
    db.add(seg)
    db.flush()
    for idx, cid in enumerate(campaign_uuids):
        db.add(
            models.SegmentationCampaignSource(
                segmentation_id=seg.id,
                campaign_id=cid,
                position=idx,
            )
        )
    for creator in creators:
        seg.creators.append(creator)
    db.commit()
    db.refresh(seg)
    return _seg_to_read(db, seg)


@segmentations_router.get("/", response_model=list[SegmentationRead])
def list_segmentations(
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
    search: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
):
    q = db.query(models.Segmentation).options(joinedload(models.Segmentation.source_campaigns))
    if search and search.strip():
        t = f"%{search.strip()}%"
        q = q.filter(or_(models.Segmentation.nombre.ilike(t), cast(models.Segmentation.id, String).ilike(t)))
    if status_filter and status_filter.strip() in ("activo", "inactivo"):
        q = q.filter(models.Segmentation.status == status_filter.strip())
    rows = q.order_by(models.Segmentation.created_at.desc()).all()
    return [_seg_to_read(db, s) for s in rows]


@segmentations_router.get("/{segmentation_id}", response_model=SegmentationRead)
def get_segmentation(
    segmentation_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(segmentation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentación no encontrada")
    seg = (
        db.query(models.Segmentation)
        .options(joinedload(models.Segmentation.source_campaigns))
        .filter(models.Segmentation.id == sid)
        .first()
    )
    if not seg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentación no encontrada")
    return _seg_to_read(db, seg)


@segmentations_router.patch("/{segmentation_id}", response_model=SegmentationRead)
def update_segmentation(
    segmentation_id: str,
    payload: SegmentationUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(segmentation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentación no encontrada")
    seg = (
        db.query(models.Segmentation)
        .options(joinedload(models.Segmentation.source_campaigns), joinedload(models.Segmentation.creators))
        .filter(models.Segmentation.id == sid)
        .first()
    )
    if not seg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentación no encontrada")

    campaign_ids = [x.campaign_id for x in sorted(seg.source_campaigns, key=lambda s: s.position)]
    if payload.campaign_ids is not None:
        try:
            campaign_ids = [uuid.UUID(x) for x in payload.campaign_ids]
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="IDs inválidos.")
    criteria = payload.criteria or seg.criteria
    should_recompute = payload.campaign_ids is not None or payload.criteria is not None
    if should_recompute:
        _replace_sources_and_members(db, seg, campaign_ids, criteria)
    if payload.nombre is not None:
        seg.nombre = payload.nombre.strip()
    if payload.criteria is not None:
        seg.criteria = payload.criteria
    if payload.status is not None:
        seg.status = payload.status
    if payload.campaign_ids is not None and campaign_ids:
        seg.campaign_id = campaign_ids[0]
    db.commit()
    db.refresh(seg)
    return _seg_to_read(db, seg)


@segmentations_router.post("/{segmentation_id}/refresh", response_model=SegmentationRead)
def refresh_segmentation(
    segmentation_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(segmentation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentación no encontrada")
    seg = (
        db.query(models.Segmentation)
        .options(joinedload(models.Segmentation.source_campaigns), joinedload(models.Segmentation.creators))
        .filter(models.Segmentation.id == sid)
        .first()
    )
    if not seg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentación no encontrada")
    campaign_ids = [x.campaign_id for x in sorted(seg.source_campaigns, key=lambda s: s.position)]
    _replace_sources_and_members(db, seg, campaign_ids, seg.criteria)
    db.commit()
    db.refresh(seg)
    return _seg_to_read(db, seg)


@segmentations_router.delete("/{segmentation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_segmentation(
    segmentation_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(segmentation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentación no encontrada")
    seg = db.query(models.Segmentation).filter(models.Segmentation.id == sid).first()
    if not seg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentación no encontrada")
    db.delete(seg)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@segmentations_router.get("/{segmentation_id}/recipients", response_model=list[dict])
def list_segmentation_recipients(
    segmentation_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(segmentation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentación no encontrada")
    seg = (
        db.query(models.Segmentation)
        .options(joinedload(models.Segmentation.creators))
        .filter(models.Segmentation.id == sid)
        .first()
    )
    if not seg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentación no encontrada")
    creators_sorted = sorted(seg.creators, key=lambda c: c.email.lower())
    return [
        creator_to_read(
            c,
            num_campaigns=count_campaigns_for_creator(db, c.id),
            account_profiles=load_account_profile_reads(db, c.id),
        ).model_dump()
        for c in creators_sorted
    ]


@segmentations_router.get("/{segmentation_id}/export")
def export_segmentation_recipients(
    segmentation_id: str,
    format: str = Query("xlsx", pattern="^(xlsx|csv)$"),
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(segmentation_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentación no encontrada")
    seg = (
        db.query(models.Segmentation)
        .options(joinedload(models.Segmentation.creators))
        .filter(models.Segmentation.id == sid)
        .first()
    )
    if not seg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentación no encontrada")
    creators_sorted = sorted(seg.creators, key=lambda c: c.email.lower())
    headers = ["id", "email", "first_name", "last_name", "full_name", "username", "status", "main_platform", "max_followers"]
    if format == "csv":
        s = []
        s.append(",".join(headers))
        for c in creators_sorted:
            row = [
                str(c.id),
                c.email or "",
                c.first_name or "",
                c.last_name or "",
                c.full_name or "",
                c.username or "",
                c.status or "activo",
                c.main_platform or "",
                str(c.max_followers or ""),
            ]
            escaped = ['"' + x.replace('"', '""') + '"' for x in row]
            s.append(",".join(escaped))
        data = ("\n".join(s) + "\n").encode("utf-8-sig")
        return Response(
            content=data,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="segmentacion-{sid}.csv"'},
        )
    wb = Workbook()
    ws = wb.active
    ws.title = "Creadores"
    ws.append(headers)
    for c in creators_sorted:
        ws.append([
            str(c.id),
            c.email or "",
            c.first_name or "",
            c.last_name or "",
            c.full_name or "",
            c.username or "",
            c.status or "activo",
            c.main_platform or "",
            c.max_followers if c.max_followers is not None else "",
        ])
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="segmentacion-{sid}.xlsx"'},
    )
