"""Creadores y listas de prueba (`creators_test` / `listas_test`)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.creators.schemas import CreatorCreate, CreatorRead
from app.db import models
from app.lists.creator_utils import apply_creator_fields


def creator_to_read(c: models.CreatorTest) -> CreatorRead:
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
        num_campaigns=0,
        account_profiles=[],
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
