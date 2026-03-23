"""
Clasificación desktop | mobile | tablet | other desde User-Agent.

Se usa en /track/open y /track/click para persistir `device_category` y evitar
reinterpretar UA en reportes. Incluye heurísticas por substring porque
`python-user_agents` y los UAs de apps de correo / WebViews suelen fallar.
"""

from __future__ import annotations

from user_agents import parse as parse_user_agent


def classify_device_from_user_agent(user_agent_str: str | None) -> str:
    if not user_agent_str or not str(user_agent_str).strip():
        return "other"

    s = user_agent_str.strip()
    sl = s.lower()
    ua = parse_user_agent(s)

    # Tablet (substring primero: muchos clientes no marcan is_tablet)
    if (
        "ipad" in sl
        or "tablet" in sl
        or "playbook" in sl
        or "kindle/" in sl
        or "silk/" in sl
    ):
        return "tablet"
    if ua.is_tablet and not ua.is_mobile:
        return "tablet"

    # Móvil: librería + tokens habituales
    if ua.is_mobile:
        return "mobile"
    if (
        "iphone" in sl
        or "ipod" in sl
        or "windows phone" in sl
        or "blackberry" in sl
        or "bb10" in sl
        or "iemobile" in sl
        or "opera mini" in sl
        or "opera mobi" in sl
        or "webos" in sl
        or "fennec" in sl
    ):
        return "mobile"

    # Android: en teléfonos suele aparecer "Mobile" en el fragmento del navegador
    if "android" in sl:
        if "mobile" in sl or "micromessenger" in sl:
            return "mobile"
        return "tablet"

    # iOS y otros: token Mobile/ en producto (p. ej. ... Version/17.0 Mobile/15E148 Safari/604.1)
    if "mobile/" in sl or "(mobile;" in sl:
        return "mobile"

    return "desktop"
