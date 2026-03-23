"""Lógica compartida: creadores maestros y vínculo con listas."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.creators.category_format import format_categories_for_db, parse_categories_from_db
from app.creators.schemas import (
    AccountProfileIn,
    AccountProfileRead,
    CreatorCreate,
    CreatorRead,
)
from app.db import models
from app.lists.creator_utils import apply_creator_fields


def _coerce_account_profile_rows(
    items: list[AccountProfileIn | dict],
) -> list[AccountProfileIn]:
    """PATCH/JSON puede dejar `account_profiles` como dicts tras `model_dump`; normaliza a modelos."""
    out: list[AccountProfileIn] = []
    for x in items:
        if isinstance(x, AccountProfileIn):
            out.append(x)
        else:
            out.append(AccountProfileIn.model_validate(x))
    return out


def account_profiles_with_identity(items: list[AccountProfileIn]) -> list[AccountProfileIn]:
    """Solo filas con usuario o URL de perfil"""
    out: list[AccountProfileIn] = []
    for it in items:
        u = (it.username or "").strip()
        url = (it.url or "").strip()
        if u or url:
            out.append(it)
    return out


def creator_to_read(
    c: models.Creator,
    *,
    num_campaigns: int = 0,
    account_profiles: list[AccountProfileRead] | None = None,
) -> CreatorRead:
    profiles = account_profiles if account_profiles is not None else []
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
        main_platform=c.main_platform,
        category=c.category,
        facebook_page=c.facebook_page,
        personalized_paragraph=c.personalized_paragraph,
        status=getattr(c, "status", None) or "activo",
        num_campaigns=num_campaigns,
        account_profiles=profiles,
    )


def load_account_profile_reads(db: Session, creator_id) -> list[AccountProfileRead]:
    rows = (
        db.query(models.AccountProfile)
        .join(models.Platform, models.AccountProfile.platform_id == models.Platform.id)
        .options(joinedload(models.AccountProfile.platform))
        .filter(models.AccountProfile.creator_id == creator_id)
        .order_by(models.Platform.nombre.asc())
        .all()
    )
    out: list[AccountProfileRead] = []
    for ap in rows:
        cats = parse_categories_from_db(ap.category)
        out.append(
            AccountProfileRead(
                id=str(ap.id),
                platform_id=str(ap.platform_id),
                platform_nombre=ap.platform.nombre,
                username=ap.username,
                url=ap.url,
                picture=ap.picture,
                bio=ap.bio,
                followers_count=int(ap.followers_count or 0),
                post_count=int(ap.post_count or 0),
                category=cats,
                is_verified=bool(ap.is_verified),
                updated_at=ap.updated_at,
            )
        )
    return out


def save_creator_account_profiles(
    db: Session,
    creator_id,
    items: list[AccountProfileIn] | list[dict],
) -> None:
    coerced = _coerce_account_profile_rows(items)
    filtered = account_profiles_with_identity(coerced)
    if coerced and not filtered:
        raise ValueError("account_profiles_need_username_or_url")
    for it in filtered:
        found = db.query(models.Platform).filter(models.Platform.id == it.platform_id).first()
        if not found:
            raise ValueError(f"platform_not_found:{it.platform_id}")
    db.query(models.AccountProfile).filter(models.AccountProfile.creator_id == creator_id).delete(
        synchronize_session=False
    )
    for it in filtered:
        db.add(
            models.AccountProfile(
                creator_id=creator_id,
                platform_id=it.platform_id,
                username=it.username,
                url=it.url,
                picture=it.picture,
                bio=it.bio,
                followers_count=it.followers_count,
                post_count=it.post_count,
                category=format_categories_for_db(list(it.category or [])),
                is_verified=it.is_verified,
            )
        )
    db.flush()


def sync_legacy_creator_profile_fields(db: Session, c: models.Creator) -> None:
    profiles = (
        db.query(models.AccountProfile)
        .options(joinedload(models.AccountProfile.platform))
        .filter(models.AccountProfile.creator_id == c.id)
        .all()
    )
    if not profiles:
        c.main_platform = None
        c.max_followers = None
        db.flush()
        return

    all_categories: list[str] = []
    max_f: int | None = None
    for ap in profiles:
        n = (ap.platform.nombre or "").strip().lower()
        if n == "instagram":
            if ap.url:
                c.instagram_url = ap.url
            if ap.username:
                c.instagram_username = ap.username
        elif n == "tiktok":
            if ap.url:
                c.tiktok_url = ap.url
            if ap.username:
                c.tiktok_username = ap.username
        elif n == "youtube":
            if ap.url:
                c.youtube_channel_url = ap.url
            if ap.username:
                c.youtube_channel = ap.username
        parsed_cats = parse_categories_from_db(ap.category)
        if parsed_cats:
            all_categories.extend(parsed_cats)
        fc = int(ap.followers_count or 0)
        max_f = fc if max_f is None else max(max_f, fc)

    def _main_sort_key(ap: models.AccountProfile) -> tuple[int, str, str]:
        nombre = (ap.platform.nombre or "").strip().lower()
        return (-int(ap.followers_count or 0), nombre, str(ap.platform_id))

    main_ap = min(profiles, key=_main_sort_key)
    c.max_followers = max_f
    c.main_platform = (main_ap.platform.nombre or "").strip() or None
    if all_categories:
        seen: set[str] = set()
        uniq: list[str] = []
        for x in all_categories:
            if x not in seen:
                seen.add(x)
                uniq.append(x)
        merged = format_categories_for_db(uniq)
        c.category = merged[:255] if merged else None
    db.flush()


def count_campaigns_for_creator(db: Session, creator_id) -> int:
    sid = str(creator_id)
    n = (
        db.query(func.count(models.CampaignRecipient.id))
        .filter(models.CampaignRecipient.recipient_id == sid)
        .scalar()
    )
    return int(n or 0)


def upsert_creator_from_payload(db: Session, payload: CreatorCreate) -> models.Creator:
    """Inserta o actualiza por email (misma fila en `creators`)."""
    existing = db.query(models.Creator).filter(models.Creator.email == payload.email).first()
    data = payload.model_dump(exclude={"account_profiles"})
    if existing:
        apply_creator_fields(existing, **{k: v for k, v in data.items() if k != "email"})
        existing.email = payload.email
        if payload.account_profiles is not None:
            save_creator_account_profiles(db, existing.id, payload.account_profiles)
            sync_legacy_creator_profile_fields(db, existing)
        return existing
    c = models.Creator(**data)
    db.add(c)
    db.flush()
    if payload.account_profiles:
        save_creator_account_profiles(db, c.id, payload.account_profiles)
        sync_legacy_creator_profile_fields(db, c)
    return c


def create_creator_strict(db: Session, payload: CreatorCreate) -> models.Creator:
    """Solo inserta; falla si el email ya existe (409 en router)."""
    existing = db.query(models.Creator).filter(models.Creator.email == payload.email).first()
    if existing:
        raise ValueError("duplicate_email")
    dump = payload.model_dump(exclude={"account_profiles"})
    c = models.Creator(**dump)
    db.add(c)
    db.flush()
    if not payload.account_profiles:
        raise ValueError("account_profiles_need_username_or_url")
    save_creator_account_profiles(db, c.id, payload.account_profiles)
    sync_legacy_creator_profile_fields(db, c)
    return c


def link_creator_to_list(db: Session, lista: models.Lista, creator: models.Creator) -> bool:
    if creator in lista.creators:
        return False
    lista.creators.append(creator)
    return True
