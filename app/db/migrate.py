"""
Esquema al arranque: create_all no añade columnas nuevas a tablas ya existentes.
Aquí aplicamos ALTER idempotentes para bases ya desplegadas.
"""

from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError

from app.core.config import get_settings
from app.db.session import Base
import app.db.models


def _migration_engine():
    """DDL/migraciones: preferir DIRECT_URL (conexion directa) sobre el pooler."""
    s = get_settings()
    url = (s.direct_url or s.database_url).strip()
    return create_engine(url, echo=False, future=True)


def bootstrap_schema() -> None:
    engine = _migration_engine()
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS auth"))
    try:
        Base.metadata.create_all(bind=engine)
    except ProgrammingError as exc:
        # En despliegues con arranques concurrentes puede ocurrir carrera:
        # dos procesos verifican y crean la misma tabla casi al mismo tiempo.
        # Si la tabla ya existe, seguimos con migraciones idempotentes.
        if getattr(getattr(exc, "orig", None), "pgcode", None) != "42P07":
            raise
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE campaigns
                ADD COLUMN IF NOT EXISTS list_id UUID
                REFERENCES listas(id) ON DELETE SET NULL;
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE campaigns
                ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE creators
                ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'activo';
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE creators
                ADD COLUMN IF NOT EXISTS main_platform VARCHAR(100);
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE listas
                ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'activo';
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE listas_test
                ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'activo';
                """
            )
        )
        for nombre in ("YouTube", "TikTok", "Instagram"):
            conn.execute(
                text(
                    """
                    INSERT INTO platforms (id, nombre, created_at)
                    SELECT gen_random_uuid(), :nombre, NOW()
                    WHERE NOT EXISTS (SELECT 1 FROM platforms WHERE nombre = :nombre)
                    """
                ),
                {"nombre": nombre},
            )
        conn.execute(
            text(
                """
                ALTER TABLE email_opens
                ADD COLUMN IF NOT EXISTS device_category VARCHAR(20);
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE email_clicks
                ADD COLUMN IF NOT EXISTS device_category VARCHAR(20);
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE qr_codes
                ADD COLUMN IF NOT EXISTS custom_image_data BYTEA;
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE qr_codes
                ADD COLUMN IF NOT EXISTS custom_image_mime VARCHAR(80);
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE qr_codes
                ADD COLUMN IF NOT EXISTS image_revision INTEGER NOT NULL DEFAULT 0;
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS qr_code_scan_days (
                    qr_code_id UUID NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
                    scan_date DATE NOT NULL,
                    count INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (qr_code_id, scan_date)
                );
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS segmentations (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    nombre VARCHAR(255) NOT NULL,
                    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                    criteria VARCHAR(40) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'activo',
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    created_by VARCHAR(255) NOT NULL DEFAULT ''
                );
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS segmentation_list_sources (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    segmentation_id UUID NOT NULL REFERENCES segmentations(id) ON DELETE CASCADE,
                    list_id UUID NOT NULL REFERENCES listas(id) ON DELETE CASCADE,
                    position INTEGER NOT NULL DEFAULT 0,
                    CONSTRAINT uq_segmentation_list_source UNIQUE (segmentation_id, list_id)
                );
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS segmentation_campaign_sources (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    segmentation_id UUID NOT NULL REFERENCES segmentations(id) ON DELETE CASCADE,
                    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                    position INTEGER NOT NULL DEFAULT 0,
                    CONSTRAINT uq_segmentation_campaign_source UNIQUE (segmentation_id, campaign_id)
                );
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS segmentations_creators (
                    segmentation_id UUID NOT NULL REFERENCES segmentations(id) ON DELETE CASCADE,
                    creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
                    PRIMARY KEY (segmentation_id, creator_id)
                );
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE campaigns
                ADD COLUMN IF NOT EXISTS segmentation_id UUID;
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS unsubscribed_creator (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    full_name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    note TEXT,
                    creator_id UUID REFERENCES creators(id) ON DELETE SET NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_unsubscribed_creator_email
                ON unsubscribed_creator (email);
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_unsubscribed_creator_creator_id
                ON unsubscribed_creator (creator_id);
                """
            )
        )
