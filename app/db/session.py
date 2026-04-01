import os
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import get_settings


settings = get_settings()


class Base(DeclarativeBase):
    pass


def _sanitize_psycopg2_url(url: str) -> str:
    """libpq no acepta el parametro pgbouncer (solo lo usan clientes como Prisma)."""
    if "pgbouncer" not in url.lower():
        return url
    parsed = urlparse(url)
    q = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() != "pgbouncer"
    ]
    return urlunparse(parsed._replace(query=urlencode(q)))


def _is_transaction_pooler_url(url: str) -> bool:
    u = url.lower()
    return ":6543" in u or ".pooler.supabase.com" in u


def _pooler_connect_args(url: str) -> dict:
    """
    PgBouncer (modo transacción) + psycopg2: sin prepared statements.
    Keepalives TCP: reduce cortes SSL SYSCALL / EOF por NAT o idle largo.
    """
    args: dict = {}
    if _is_transaction_pooler_url(url):
        args["prepare_threshold"] = None
        args["keepalives"] = 1
        args["keepalives_idle"] = 30
        args["keepalives_interval"] = 10
        args["keepalives_count"] = 5
    return args


def _pool_recycle_seconds(url: str) -> int:
    """
    Reciclar conexiones antes de que el pooler (p. ej. Supabase) las cierre.
    DB_POOL_RECYCLE en segundos sobrescribe el valor automático.
    """
    raw = os.getenv("DB_POOL_RECYCLE", "").strip()
    if raw:
        try:
            return max(30, int(raw))
        except ValueError:
            pass
    return 280 if _is_transaction_pooler_url(url) else 1800


_db_url = _sanitize_psycopg2_url(settings.database_url)
_connect_args = _pooler_connect_args(_db_url)
engine = create_engine(
    _db_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_recycle=_pool_recycle_seconds(_db_url),
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

