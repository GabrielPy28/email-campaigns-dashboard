from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import (
    String,
    Integer,
    DateTime,
    Date,
    ForeignKey,
    Table,
    Column,
    Text,
    Boolean,
    UniqueConstraint,
    LargeBinary,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, Mapped, mapped_column
import uuid

from app.db.session import Base


campaign_senders = Table(
    "campaign_senders",
    Base.metadata,
    Column("campaign_id", UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), primary_key=True),
    Column("sender_id", UUID(as_uuid=True), ForeignKey("senders.id", ondelete="CASCADE"), primary_key=True),
)

creators_list = Table(
    "creators_list",
    Base.metadata,
    Column("list_id", UUID(as_uuid=True), ForeignKey("listas.id", ondelete="CASCADE"), primary_key=True),
    Column("creator_id", UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"), primary_key=True),
)

creators_list_test = Table(
    "creators_list_test",
    Base.metadata,
    Column("list_id", UUID(as_uuid=True), ForeignKey("listas_test.id", ondelete="CASCADE"), primary_key=True),
    Column("creator_id", UUID(as_uuid=True), ForeignKey("creators_test.id", ondelete="CASCADE"), primary_key=True),
)

segmentations_creators = Table(
    "segmentations_creators",
    Base.metadata,
    Column("segmentation_id", UUID(as_uuid=True), ForeignKey("segmentations.id", ondelete="CASCADE"), primary_key=True),
    Column("creator_id", UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"), primary_key=True),
)


class AuthUser(Base):
    """
    Tabla auth.users: verificación por email y encrypted_password (bcrypt).
    """
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    encrypted_password: Mapped[str] = mapped_column(String(255), nullable=False)


class Sender(Base):
    __tablename__ = "senders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    campaigns: Mapped[list["Campaign"]] = relationship("Campaign", back_populates="sender")


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    html_content: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    campaigns: Mapped[list["Campaign"]] = relationship("Campaign", back_populates="template")


class Lista(Base):
    """Lista de creadores para armar campañas."""

    __tablename__ = "listas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="activo")

    creators: Mapped[list["Creator"]] = relationship(
        "Creator",
        secondary=creators_list,
        back_populates="listas",
    )
    campaigns: Mapped[list["Campaign"]] = relationship("Campaign", back_populates="source_list")


class Creator(Base):
    """Creador / destinatario: campos fijos para plantillas Jinja2."""

    __tablename__ = "creators"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    picture: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    instagram_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    tiktok_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    youtube_channel_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    tiktok_username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    instagram_username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    youtube_channel: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    max_followers: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    main_platform: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    facebook_page: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    personalized_paragraph: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="activo")

    listas: Mapped[list["Lista"]] = relationship(
        "Lista",
        secondary=creators_list,
        back_populates="creators",
    )
    account_profiles: Mapped[list["AccountProfile"]] = relationship(
        "AccountProfile",
        back_populates="creator",
        cascade="all, delete-orphan",
    )
    segmentations: Mapped[list["Segmentation"]] = relationship(
        "Segmentation",
        secondary=segmentations_creators,
        back_populates="creators",
    )


class UnsubscribedCreator(Base):
    """Solicitudes de baja desde el formulario público (registro + auditoría)."""

    __tablename__ = "unsubscribed_creator"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    creator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("creators.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


class Platform(Base):
    """Plataformas sociales habilitadas (YouTube, TikTok, Instagram, …)."""

    __tablename__ = "platforms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    account_profiles: Mapped[list["AccountProfile"]] = relationship(
        "AccountProfile", back_populates="platform"
    )


class AccountProfile(Base):
    """Perfil de cuenta del creador por plataforma (datos para campañas segmentadas)."""

    __tablename__ = "account_profiles"
    __table_args__ = (
        UniqueConstraint("creator_id", "platform_id", name="uq_account_profile_creator_platform"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"), nullable=False, index=True
    )
    platform_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("platforms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    picture: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    followers_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    post_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # JSONB: string JSON "a, b, and c" (no array). Legado: array de strings.
    category: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    creator: Mapped["Creator"] = relationship("Creator", back_populates="account_profiles")
    platform: Mapped["Platform"] = relationship("Platform", back_populates="account_profiles")


class ListaTest(Base):
    """Listas de prueba (plantillas / QA); aisladas de listas de producción."""

    __tablename__ = "listas_test"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="activo")

    creators: Mapped[list["CreatorTest"]] = relationship(
        "CreatorTest",
        secondary=creators_list_test,
        back_populates="listas",
    )


class CreatorTest(Base):
    """Creadores de prueba; mismas columnas que `creators`."""

    __tablename__ = "creators_test"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    picture: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    instagram_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    tiktok_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    youtube_channel_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    tiktok_username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    instagram_username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    youtube_channel: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    max_followers: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    facebook_page: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    personalized_paragraph: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    listas: Mapped[list["ListaTest"]] = relationship(
        "ListaTest",
        secondary=creators_list_test,
        back_populates="creators",
    )


class Segmentation(Base):
    """Segmentación dinámica persistida para campañas de seguimiento."""

    __tablename__ = "segmentations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    criteria: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="activo")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    campaign: Mapped["Campaign"] = relationship("Campaign", foreign_keys=[campaign_id])
    creators: Mapped[list["Creator"]] = relationship(
        "Creator",
        secondary=segmentations_creators,
        back_populates="segmentations",
    )
    source_lists: Mapped[list["SegmentationListSource"]] = relationship(
        "SegmentationListSource",
        back_populates="segmentation",
        cascade="all, delete-orphan",
    )
    source_campaigns: Mapped[list["SegmentationCampaignSource"]] = relationship(
        "SegmentationCampaignSource",
        back_populates="segmentation",
        cascade="all, delete-orphan",
    )


class SegmentationListSource(Base):
    """Listas origen de la segmentación, conservando el orden para resolución de duplicados."""

    __tablename__ = "segmentation_list_sources"
    __table_args__ = (
        UniqueConstraint("segmentation_id", "list_id", name="uq_segmentation_list_source"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    segmentation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("segmentations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    list_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("listas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    segmentation: Mapped["Segmentation"] = relationship("Segmentation", back_populates="source_lists")
    lista: Mapped["Lista"] = relationship("Lista")


class SegmentationCampaignSource(Base):
    """Campañas origen de la segmentación, manteniendo orden de selección."""

    __tablename__ = "segmentation_campaign_sources"
    __table_args__ = (
        UniqueConstraint("segmentation_id", "campaign_id", name="uq_segmentation_campaign_source"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    segmentation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("segmentations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    segmentation: Mapped["Segmentation"] = relationship("Segmentation", back_populates="source_campaigns")
    campaign: Mapped["Campaign"] = relationship("Campaign")


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    preheader: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("templates.id"), nullable=False
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("senders.id"), nullable=False
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    timezone: Mapped[str] = mapped_column(String(20), nullable=False)
    wait_min_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    wait_max_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="scheduled")
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    list_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("listas.id", ondelete="SET NULL"),
        nullable=True,
    )
    segmentation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    is_test: Mapped[bool] = mapped_column(default=False, nullable=False)

    template: Mapped["Template"] = relationship("Template", back_populates="campaigns")
    sender: Mapped["Sender"] = relationship("Sender", back_populates="campaigns")
    senders: Mapped[list["Sender"]] = relationship("Sender", secondary=campaign_senders)
    source_list: Mapped[Optional["Lista"]] = relationship("Lista", back_populates="campaigns")
    recipients: Mapped[list["CampaignRecipient"]] = relationship("CampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")


class CampaignRecipient(Base):
    __tablename__ = "campaign_recipients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )
    recipient_id: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    extra_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Pre-envío: asignación por destinatario
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("senders.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(30), default="pending")
    scheduled_send_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="recipients")


class EmailOpen(Base):
    __tablename__ = "email_opens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    recipient_id: Mapped[str] = mapped_column(String(255), nullable=False)
    opened_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    device_category: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)


class EmailClick(Base):
    __tablename__ = "email_clicks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    recipient_id: Mapped[str] = mapped_column(String(255), nullable=False)
    button_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    url: Mapped[str] = mapped_column(String, nullable=False)
    clicked_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    device_category: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)


class QrCode(Base):
    """Código QR registrado: imagen pública y redirección con conteo de escaneos."""

    __tablename__ = "qr_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    target_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    scan_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    custom_image_data: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    custom_image_mime: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    """Se incrementa al cambiar la imagen servida en /qr/{id}/image.png (invalidar caché del navegador)."""
    image_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class QrCodeScanDay(Base):
    """Escaneos agregados por día (UTC) para un código QR."""

    __tablename__ = "qr_code_scan_days"

    qr_code_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("qr_codes.id", ondelete="CASCADE"),
        primary_key=True,
    )
    scan_date: Mapped[date] = mapped_column(Date, primary_key=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class IpGeolocationCache(Base):
    """
    Cache simple de resolución IP
    """

    __tablename__ = "ip_geolocation_cache"

    ip: Mapped[str] = mapped_column(String(64), primary_key=True)
    country_code: Mapped[str] = mapped_column(String(4), nullable=False)
    country_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

