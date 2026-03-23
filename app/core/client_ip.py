"""Resolución de IP del cliente detrás de proxies y comprobación de IP pública."""

from __future__ import annotations
import ipaddress
from starlette.requests import Request


def get_client_ip(request: Request) -> str | None:
    """
    IP del cliente final cuando la app está detrás de reverse proxy o CDN.
    """
    h = request.headers

    cf = h.get("cf-connecting-ip")
    if cf and cf.strip():
        return cf.strip().split(",")[0].strip()

    true_client = h.get("true-client-ip")
    if true_client and true_client.strip():
        return true_client.strip().split(",")[0].strip()

    real_ip = h.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip().split(",")[0].strip()

    forwarded = h.get("x-forwarded-for")
    if forwarded:
        part = forwarded.split(",")[0].strip()
        if part:
            return part

    if request.client:
        return request.client.host
    return None


def is_public_routable_ip(ip: str | None) -> bool:
    """True si la IP es enrutable en Internet."""
    if not ip or not str(ip).strip():
        return False
    try:
        return bool(ipaddress.ip_address(ip.strip()).is_global)
    except ValueError:
        return False
