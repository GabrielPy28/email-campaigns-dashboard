"""Mapeo Creator <-> campaign_recipients / extra_data para plantillas."""

from __future__ import annotations

import uuid
from typing import TypeAlias

from app.db import models

CreatorLike: TypeAlias = models.Creator | models.CreatorTest


def creator_display_name(creator: CreatorLike) -> str:
    if creator.full_name and creator.full_name.strip():
        return creator.full_name.strip()
    parts = f"{creator.first_name or ''} {creator.last_name or ''}".strip()
    if parts:
        return parts
    return creator.email.split("@")[0]


def _platform_key(nombre: str) -> str:
    n = (nombre or "").strip().lower()
    if "instagram" in n:
        return "instagram"
    if "tiktok" in n:
        return "tiktok"
    if "youtube" in n:
        return "youtube"
    if "facebook" in n:
        return "facebook"
    slug = n.replace(" ", "_")[:50]
    return slug or "other"


def _account_from_creator_test(c: models.CreatorTest) -> dict[str, dict]:
    """Aproxima `account_profiles` con las columnas de `creators_test` (un solo `max_followers`)."""
    m = c.max_followers or 0

    def fc(has_any: bool) -> int:
        return m if has_any else 0

    def nz(s: str | None) -> bool:
        return bool((s or "").strip())

    return {
        "instagram": {
            "followers_count": fc(nz(c.instagram_username) or nz(c.instagram_url)),
            "post_count": 0,
            "username": c.instagram_username or "",
            "url": c.instagram_url or "",
            "picture": None,
        },
        "tiktok": {
            "followers_count": fc(nz(c.tiktok_username) or nz(c.tiktok_url)),
            "post_count": 0,
            "username": c.tiktok_username or "",
            "url": c.tiktok_url or "",
            "picture": None,
        },
        "youtube": {
            "followers_count": fc(nz(c.youtube_channel) or nz(c.youtube_channel_url)),
            "post_count": 0,
            "username": c.youtube_channel or "",
            "url": c.youtube_channel_url or "",
            "picture": None,
        },
        "facebook": {
            "followers_count": fc(nz(c.facebook_page)),
            "post_count": 0,
            "username": "",
            "url": c.facebook_page or "",
            "picture": None,
        },
    }


def creator_to_extra_dict(creator: CreatorLike) -> dict:
    """Construye el dict que en Jinja se expone como `extra` y se persiste en `extra_data`.

    No es un origen distinto a las tablas: se leen columnas de `creators` / `creators_test` y
    `account_profiles` (o equivalentes en prueba) y se devuelven anidadas en `creator` / `account`
    más claves planas legadas para plantillas antiguas.

    - Cabecera (nombre, apellido, párrafo, etc.): fila del creador (`creators` / `creators_test`).
    - Métricas por red: en producción, `account_profiles` por plataforma; en prueba, columnas
      equivalentes en `creators_test` (sin tabla `account_profiles`).
    """
    mf = creator.max_followers
    creator_block = {
        "first_name": creator.first_name or "",
        "last_name": creator.last_name or "",
        "full_name": creator.full_name or "",
        "picture": creator.picture or "",
        "username": creator.username or "",
        "main_platform": getattr(creator, "main_platform", None) or "",
        "max_followers": int(mf) if mf is not None else 0,
    }

    account: dict[str, dict] = {}
    if isinstance(creator, models.Creator):
        for ap in creator.account_profiles or []:
            pl = ap.platform
            if pl is None:
                continue
            key = _platform_key(pl.nombre)
            account[key] = {
                "followers_count": ap.followers_count,
                "post_count": ap.post_count,
                "username": ap.username or "",
                "url": ap.url or "",
                "bio": ap.bio or "",
                "picture": ap.picture or "",
                "is_verified": ap.is_verified,
            }
    elif isinstance(creator, models.CreatorTest):
        account = _account_from_creator_test(creator)
    else:
        raise TypeError(f"Tipo de creador no soportado: {type(creator)!r}")

    ig = account.get("instagram") or {}
    tt = account.get("tiktok") or {}
    yt = account.get("youtube") or {}

    return {
        "first_name": creator.first_name or "",
        "last_name": creator.last_name or "",
        "full_name": creator.full_name or "",
        "picture": creator.picture or "",
        "username": creator.username or "",
        "instagram_url": creator.instagram_url or "",
        "tiktok_url": creator.tiktok_url or "",
        "youtube_channel_url": creator.youtube_channel_url or "",
        "tiktok_username": creator.tiktok_username or "",
        "instagram_username": creator.instagram_username or "",
        "youtube_channel": creator.youtube_channel or "",
        "max_followers": creator.max_followers,
        "main_platform": getattr(creator, "main_platform", None) or "",
        "category": creator.category or "",
        "facebook_page": creator.facebook_page or "",
        "personalized_paragraph": creator.personalized_paragraph or "",
        "creator": creator_block,
        "account": account,
        # Legado / CSV / plantillas antiguas
        "handle_instagram": creator.instagram_username or "",
        "handle_tiktok": creator.tiktok_username or "",
        "youtube_url": creator.youtube_channel_url or "",
        "vertical": creator.category or "",
        "instagram_followers": int(ig.get("followers_count") or 0),
        "tiktok_followers": int(tt.get("followers_count") or 0),
        "youtube_subscribers": int(yt.get("followers_count") or 0),
    }


def creator_to_campaign_recipient(
    campaign_id: uuid.UUID,
    creator: CreatorLike,
) -> models.CampaignRecipient:
    extra = creator_to_extra_dict(creator)
    return models.CampaignRecipient(
        campaign_id=campaign_id,
        recipient_id=str(creator.id),
        email=creator.email,
        nombre=creator_display_name(creator),
        username=creator.username or "",
        extra_data=extra,
    )


def apply_creator_fields(
    creator: models.Creator | models.CreatorTest,
    *,
    email: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    full_name: str | None = None,
    picture: str | None = None,
    username: str | None = None,
    instagram_url: str | None = None,
    tiktok_url: str | None = None,
    youtube_channel_url: str | None = None,
    tiktok_username: str | None = None,
    instagram_username: str | None = None,
    youtube_channel: str | None = None,
    max_followers: int | None = None,
    main_platform: str | None = None,
    category: str | None = None,
    facebook_page: str | None = None,
    personalized_paragraph: str | None = None,
    status: str | None = None,
) -> None:
    if email is not None:
        creator.email = email
    if first_name is not None:
        creator.first_name = first_name
    if last_name is not None:
        creator.last_name = last_name
    if full_name is not None:
        creator.full_name = full_name
    if picture is not None:
        creator.picture = picture
    if username is not None:
        creator.username = username
    if instagram_url is not None:
        creator.instagram_url = instagram_url
    if tiktok_url is not None:
        creator.tiktok_url = tiktok_url
    if youtube_channel_url is not None:
        creator.youtube_channel_url = youtube_channel_url
    if tiktok_username is not None:
        creator.tiktok_username = tiktok_username
    if instagram_username is not None:
        creator.instagram_username = instagram_username
    if youtube_channel is not None:
        creator.youtube_channel = youtube_channel
    if max_followers is not None:
        creator.max_followers = max_followers
    if main_platform is not None and hasattr(creator, "main_platform"):
        creator.main_platform = main_platform
    if category is not None:
        creator.category = category
    if facebook_page is not None:
        creator.facebook_page = facebook_page
    if personalized_paragraph is not None:
        creator.personalized_paragraph = personalized_paragraph
    if status is not None and hasattr(creator, "status"):
        creator.status = status
