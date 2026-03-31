"""
Esquema al arranque: create_all no añade columnas nuevas a tablas ya existentes.
Aquí aplicamos ALTER idempotentes para bases ya desplegadas.
"""

from sqlalchemy import text

from app.db.session import engine, Base
import app.db.models


def bootstrap_schema() -> None:
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS auth"))
    Base.metadata.create_all(bind=engine)
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
