"""Creadores y listas de prueba (`creators_test` / `listas_test`)."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.creators.category_format import format_categories_for_db, parse_categories_from_db
from app.creators.schemas import AccountProfileIn, AccountProfileRead, CreatorCreate, CreatorRead
from app.creators.service import _coerce_account_profile_rows, account_profiles_with_identity
from app.db import models
from app.lists.creator_utils import _platform_key, apply_creator_fields


def apply_account_profiles_payload_to_creator_test(
    db: Session,
    c: models.CreatorTest,
    items: list[AccountProfileIn | dict] | None,
) -> None:
    """Persiste `account_profiles` del PATCH en columnas planas de `creators_test` (sin tabla account_profiles)."""
    if items is None:
        return
    coerced = _coerce_account_profile_rows(items)
    filtered = account_profiles_with_identity(coerced)
    if coerced and not filtered:
        raise ValueError("account_profiles_need_username_or_url")
    if not filtered:
        c.max_followers = None
        return

    plat_ids = {it.platform_id for it in filtered}
    rows = db.query(models.Platform).filter(models.Platform.id.in_(plat_ids)).all()
    by_id = {p.id: p for p in rows}
    if len(by_id) != len(plat_ids):
        missing = next(iter(plat_ids - set(by_id)))
        raise ValueError(f"platform_not_found:{missing}")

    all_categories: list[str] = []
    max_f: int | None = None
    for it in filtered:
        plat = by_id[it.platform_id]
        n = (plat.nombre or "").strip().lower()
        if n == "instagram" or "instagram" in n:
            if it.url:
                c.instagram_url = it.url
            if it.username:
                c.instagram_username = it.username
        elif n == "tiktok" or "tiktok" in n:
            if it.url:
                c.tiktok_url = it.url
            if it.username:
                c.tiktok_username = it.username
        elif n == "youtube" or "youtube" in n:
            if it.url:
                c.youtube_channel_url = it.url
            if it.username:
                c.youtube_channel = it.username
        elif "facebook" in n:
            if it.url:
                c.facebook_page = it.url
            elif it.username:
                c.facebook_page = it.username
        for x in it.category or []:
            if (x or "").strip():
                all_categories.append(x.strip())
        fc = int(it.followers_count or 0)
        max_f = fc if max_f is None else max(max_f, fc)

    c.max_followers = max_f
    if all_categories:
        seen: set[str] = set()
        uniq: list[str] = []
        for x in all_categories:
            if x not in seen:
                seen.add(x)
                uniq.append(x)
        merged = format_categories_for_db(uniq)
        c.category = merged[:255] if merged else None


def _nz(s: str | None) -> bool:
    return bool((s or "").strip())


def synthetic_account_profile_reads_for_creator_test(
    db: Session, c: models.CreatorTest
) -> list[AccountProfileRead]:
    """Deriva `account_profiles` desde columnas planas (misma forma que producción para el cliente)."""
    platforms = db.query(models.Platform).order_by(models.Platform.nombre.asc()).all()
    slug_to_plat: dict[str, models.Platform] = {}
    for p in platforms:
        slug = _platform_key(p.nombre)
        if slug not in slug_to_plat:
            slug_to_plat[slug] = p

    cats = parse_categories_from_db(c.category)[:3]
    m = int(c.max_followers or 0)

    rows: list[tuple[str, str | None, str | None]] = []
    if _nz(c.instagram_username) or _nz(c.instagram_url):
        rows.append(("instagram", c.instagram_username, c.instagram_url))
    if _nz(c.tiktok_username) or _nz(c.tiktok_url):
        rows.append(("tiktok", c.tiktok_username, c.tiktok_url))
    if _nz(c.youtube_channel) or _nz(c.youtube_channel_url):
        rows.append(("youtube", c.youtube_channel, c.youtube_channel_url))
    if _nz(c.facebook_page):
        rows.append(("facebook", None, c.facebook_page))

    out: list[AccountProfileRead] = []
    for slug, username, url in rows:
        plat = slug_to_plat.get(slug)
        if plat is None:
            continue
        sid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"pipeline_ai:creators_test:{c.id}:{slug}"))
        u = (username or "").strip() or None
        v = (url or "").strip() or None
        out.append(
            AccountProfileRead(
                id=sid,
                platform_id=str(plat.id),
                platform_nombre=plat.nombre,
                username=u,
                url=v,
                picture=None,
                bio=None,
                followers_count=m,
                post_count=0,
                category=list(cats),
                is_verified=False,
                updated_at=None,
            )
        )
    out.sort(key=lambda ap: (ap.platform_nombre or "").lower())
    return out


def creator_to_read(db: Session, c: models.CreatorTest) -> CreatorRead:
    profiles = synthetic_account_profile_reads_for_creator_test(db, c)
    main_platform: str | None = None
    if profiles:
        top = max(
            profiles,
            key=lambda ap: (ap.followers_count, (ap.platform_nombre or "").lower()),
        )
        main_platform = top.platform_nombre

    return CreatorRead(
        id=str(c.id),
        email=c.email,
        first_name=c.first_name,
        last_name=c.last_name,
        full_name=c.full_name,
        picture=c.picture,
        username=c.username,
        instagram_url=c.instagram_url,
        tiktok_url=c.tiktok_url,
        youtube_channel_url=c.youtube_channel_url,
        tiktok_username=c.tiktok_username,
        instagram_username=c.instagram_username,
        youtube_channel=c.youtube_channel,
        max_followers=c.max_followers,
        category=c.category,
        facebook_page=c.facebook_page,
        personalized_paragraph=c.personalized_paragraph,
        status="activo",
        main_platform=main_platform,
        num_campaigns=0,
        account_profiles=profiles,
    )


def _creator_test_row_data(payload: CreatorCreate) -> dict:
    data = payload.model_dump()
    data.pop("status", None)
    data.pop("account_profiles", None)
    return data


def upsert_creator_from_payload(db: Session, payload: CreatorCreate) -> models.CreatorTest:
    existing = (
        db.query(models.CreatorTest).filter(models.CreatorTest.email == payload.email).first()
    )
    data = _creator_test_row_data(payload)
    if existing:
        apply_creator_fields(existing, **{k: v for k, v in data.items() if k != "email"})
        existing.email = payload.email
        return existing
    c = models.CreatorTest(**data)
    db.add(c)
    db.flush()
    return c


def create_creator_strict(db: Session, payload: CreatorCreate) -> models.CreatorTest:
    existing = (
        db.query(models.CreatorTest).filter(models.CreatorTest.email == payload.email).first()
    )
    if existing:
        raise ValueError("duplicate_email")
    c = models.CreatorTest(**_creator_test_row_data(payload))
    db.add(c)
    db.flush()
    return c


def link_creator_to_list(
    db: Session, lista: models.ListaTest, creator: models.CreatorTest
) -> bool:
    if creator in lista.creators:
        return False
    lista.creators.append(creator)
    return True
