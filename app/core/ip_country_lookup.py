"""
Resolución IP → (código país, nombre) para reportes de campaña.

Orden de preferencia:
1. Base MaxMind GeoLite2 (.mmdb) local — variable `GEOIP2_DATABASE_PATH` o `GEOIP2_CITY_PATH`
   (descarga gratuita con cuenta en https://www.maxmind.com/en/geolite2/signup )
2. API ipgeolocation.io si existe `IPGEOLOCATION_API_KEY`
3. ("XX", "Unknown")

La caché en `ip_geolocation_cache` reduce llamadas HTTP y se reutiliza en reportes.

Nota: el paquete `fastapi-geolocation` en PyPI tiene imports rotos y solo usa
`request.client.host` (sin X-Forwarded-For); aquí usamos la misma IP que ya
expone `get_client_ip` en tracking.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any

import geoip2.database
import geoip2.errors
import requests
from sqlalchemy.orm import Session

from app.core.client_ip import is_public_routable_ip
from app.db import models

_reader: geoip2.database.Reader | None = None
_reader_path: str | None = None


def _geoip_reader_path() -> str | None:
    p = (
        os.getenv("GEOIP2_DATABASE_PATH")
        or os.getenv("GEOIP2_CITY_PATH")
        or ""
    ).strip()
    if not p:
        try:
            from app.core.config import get_settings

            p = (get_settings().geoip2_database_path or "").strip()
        except Exception:
            p = ""
    return p if p and os.path.isfile(p) else None


def _get_reader() -> geoip2.database.Reader | None:
    global _reader, _reader_path
    path = _geoip_reader_path()
    if not path:
        if _reader is not None:
            _reader.close()
            _reader = None
            _reader_path = None
        return None
    if _reader is not None and _reader_path == path:
        return _reader
    if _reader is not None:
        _reader.close()
    _reader = geoip2.database.Reader(path)
    _reader_path = path
    return _reader


def _maxmind_lookup(ip: str) -> tuple[str, str] | None:
    reader = _get_reader()
    if reader is None:
        return None
    rec = None
    try:
        rec = reader.city(ip)
    except geoip2.errors.GeoIP2Error:
        try:
            rec = reader.country(ip)
        except geoip2.errors.GeoIP2Error:
            return None
    if rec is None:
        return None
    try:
        code = (rec.country.iso_code or "XX").upper()
        name = (rec.country.name or code) or "Unknown"
        return (code[:4], name)
    except (AttributeError, ValueError):
        return None


def _parse_ipgeolocation_payload(data: dict[str, Any]) -> tuple[str, str]:
    """Acepta varias formas de respuesta de ipgeolocation.io v3."""
    loc = data.get("location")
    if not isinstance(loc, dict):
        loc = {}
    code = (
        loc.get("country_code2")
        or loc.get("country_code")
        or data.get("country_code2")
        or data.get("country_code")
    )
    name = loc.get("country_name") or data.get("country_name")
    if code:
        c = str(code).strip().upper()[:4]
        return (c, (name and str(name).strip()) or c)
    return ("XX", "Unknown")


def _http_ipgeolocation_lookup(ip: str, api_key: str) -> tuple[str, str]:
    try:
        resp = requests.get(
            "https://api.ipgeolocation.io/v3/ipgeo",
            params={"apiKey": api_key, "ip": ip},
            timeout=4,
        )
        if not resp.ok:
            return ("XX", "Unknown")
        data = resp.json()
        if isinstance(data, dict) and data.get("message") and not data.get("location"):
            return ("XX", "Unknown")
        if not isinstance(data, dict):
            return ("XX", "Unknown")
        return _parse_ipgeolocation_payload(data)
    except Exception:
        return ("XX", "Unknown")


def store_ip_country_cache(db: Session, ip: str, code: str, name: str) -> None:
    """Inserta o actualiza fila en `ip_geolocation_cache`."""
    now = datetime.utcnow()
    existing = db.query(models.IpGeolocationCache).filter(models.IpGeolocationCache.ip == ip).first()
    if existing:
        existing.country_code = code
        existing.country_name = name
        existing.last_seen_at = now
    else:
        db.add(
            models.IpGeolocationCache(
                ip=ip,
                country_code=code,
                country_name=name,
                last_seen_at=now,
            )
        )


def resolve_ip_country(
    db: Session,
    ip: str | None,
    *,
    allow_http: bool = True,
    http_budget: list[int] | None = None,
) -> tuple[str, str]:
    """
    Devuelve (country_code, country_name) y deja el resultado en caché BD para IPs públicas.

    `http_budget`: lista mutable ``[n]`` con llamadas HTTP restantes; si llega a 0 no se llama a la API.
    """
    raw = (ip or "").strip()
    if not raw:
        return ("XX", "Unknown")
    if not is_public_routable_ip(raw):
        return ("XX", "Private / non-routable")

    cached = (
        db.query(models.IpGeolocationCache)
        .filter(models.IpGeolocationCache.ip == raw)
        .first()
    )
    if cached:
        return (cached.country_code, cached.country_name)

    code, name = "XX", "Unknown"
    mm = _maxmind_lookup(raw)
    if mm:
        code, name = mm
    elif allow_http:
        api_key = os.getenv("IPGEOLOCATION_API_KEY")
        if api_key:
            if http_budget is not None and http_budget[0] <= 0:
                pass
            else:
                if http_budget is not None:
                    http_budget[0] -= 1
                code, name = _http_ipgeolocation_lookup(raw, api_key)

    store_ip_country_cache(db, raw, code, name)
    return (code, name)
