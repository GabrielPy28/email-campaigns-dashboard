from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class AccountProfileIn(BaseModel):
    platform_id: UUID
    username: str | None = None
    url: str | None = None
    picture: str | None = None
    bio: str | None = None
    followers_count: int = Field(0, ge=0)
    post_count: int = Field(0, ge=0)
    category: list[str] = Field(default_factory=list)
    is_verified: bool = False

    @field_validator("category")
    @classmethod
    def category_max_three(cls, v: list[str]) -> list[str]:
        if len(v) > 3:
            raise ValueError("Máximo 3 categorías por cuenta.")
        return v


class AccountProfileRead(BaseModel):
    id: str
    platform_id: str
    platform_nombre: str
    username: str | None = None
    url: str | None = None
    picture: str | None = None
    bio: str | None = None
    followers_count: int = 0
    post_count: int = 0
    category: list[str] = Field(default_factory=list)
    is_verified: bool = False
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class PlatformRead(BaseModel):
    id: str
    nombre: str
    created_at: datetime

    class Config:
        from_attributes = True


class CreatorBase(BaseModel):
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None
    picture: str | None = None
    username: str | None = None
    instagram_url: str | None = None
    tiktok_url: str | None = None
    youtube_channel_url: str | None = None
    tiktok_username: str | None = None
    instagram_username: str | None = None
    youtube_channel: str | None = None
    max_followers: int | None = None
    category: str | None = None
    facebook_page: str | None = None
    personalized_paragraph: str | None = None
    status: str = Field(default="activo", description="activo | inactivo")


class CreatorCreate(CreatorBase):
    account_profiles: list[AccountProfileIn] | None = None


class CreatorUpdate(BaseModel):
    status: str | None = Field(default=None, description="activo | inactivo")
    email: EmailStr | None = None
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None
    picture: str | None = None
    username: str | None = None
    instagram_url: str | None = None
    tiktok_url: str | None = None
    youtube_channel_url: str | None = None
    tiktok_username: str | None = None
    instagram_username: str | None = None
    youtube_channel: str | None = None
    max_followers: int | None = None
    category: str | None = None
    facebook_page: str | None = None
    personalized_paragraph: str | None = None
    account_profiles: list[AccountProfileIn] | None = None


class CreatorRead(CreatorBase):
    id: str
    main_platform: str | None = Field(
        default=None,
        description="Plataforma de la cuenta con más seguidores (derivado de account_profiles).",
    )
    num_campaigns: int = Field(0, description="Filas en campaign_recipients para este creador")
    account_profiles: list[AccountProfileRead] = Field(default_factory=list)

    class Config:
        from_attributes = True


class LinkCreatorToListBody(BaseModel):
    creator_id: UUID = Field(..., description="UUID del creador ya registrado en tabla creators")
