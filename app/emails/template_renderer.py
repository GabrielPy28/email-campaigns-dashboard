import html
import json
import re
from collections.abc import Mapping
from typing import Any
from urllib.parse import quote

from bs4 import BeautifulSoup
from jinja2 import ChainableUndefined, Environment, Template

# Mismo motor para asunto/preheader: sin autoescape; undefined encadenable (no rompe .a.b.c).
_JINJA_LINE_ENV = Environment(
    autoescape=False,
    undefined=ChainableUndefined,
    trim_blocks=True,
    lstrip_blocks=False,
)


def coerce_extra_data_to_dict(raw: Any) -> dict:
    """
    Normaliza lo que venga de JSONB / ORM a dict plano.
    Antes: `if not isinstance(extra, dict): extra = {}` vaciaba datos si el driver
    devolvía otro Mapping (p. ej. tipos no-dict) o JSON serializado como str.
    """
    if raw is None:
        return {}
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return {}
        return dict(parsed) if isinstance(parsed, dict) else {}
    if isinstance(raw, dict):
        return dict(raw)
    if isinstance(raw, Mapping):
        try:
            return dict(raw)
        except (TypeError, ValueError):
            return {}
    return {}


def _enrich_extra_with_creator_block(extra: dict) -> dict:
    """
    Garantiza claves planas (first_name, last_name, …) en el dict `extra` y luego
    en el contexto raíz Jinja: algunas plantillas usan {{ first_name }} y el bloque
    anidado solo vivía en extra.creator.
    """
    creator_sub = extra.get("creator")
    if not isinstance(creator_sub, Mapping):
        return extra
    nested = dict(creator_sub)
    for key in ("first_name", "last_name", "full_name", "picture", "username", "main_platform"):
        cur = extra.get(key)
        if cur is not None and str(cur).strip() != "":
            continue
        nv = nested.get(key)
        if nv is not None and str(nv).strip() != "":
            extra[key] = nv
    if extra.get("max_followers") is None and nested.get("max_followers") is not None:
        extra["max_followers"] = nested["max_followers"]
    return extra


def build_jinja_context_from_recipient(
    recipient: Any,
    sender_full_name: str,
    *,
    extra_data: dict | None = None,
) -> dict:
    """
    Contexto Jinja2 para plantilla / asunto / preheader.

    Si `extra_data` se pasa (p. ej. rehidratado desde `creators` en el envío),
    se usa en lugar de solo `recipient.extra_data` persistido en la campaña.
    """
    if extra_data is None:
        extra = coerce_extra_data_to_dict(getattr(recipient, "extra_data", None))
    else:
        extra = dict(extra_data)
    extra = _enrich_extra_with_creator_block(dict(extra))
    additional_raw = extra.get("additionalProp1", {})
    additional = dict(additional_raw) if isinstance(additional_raw, Mapping) else {}
    handle = (
        additional.get("handle")
        or extra.get("handle")
        or extra.get("instagram_username")
        or extra.get("username")
        or ""
    )
    context: dict = {
        "nombre": recipient.nombre,
        "username": recipient.username,
        "email": recipient.email,
        "handle": handle,
        "extra": extra,
        "sender_name": sender_full_name,
    }
    for k, v in extra.items():
        if k not in context:
            context[k] = v
    return context


def _normalize_line_for_jinja(s: str) -> str:
    """
    Asunto/preheader a veces llegan con entidades HTML (&#123;) o llaves Unicode (｛｝)
    desde copiar/pegar; Jinja no las reconoce y el correo muestra literales sin renderizar.
    """
    t = html.unescape(s)
    return t.translate(str.maketrans("\uff5b\uff5d", "{}"))  # FULLWIDTH LEFT/RIGHT CURLY BRACKET


def _legacy_single_braces_to_jinja(s: str) -> str:
    """
    Convierte placeholders de una sola llave a Jinja2, sin tocar bloques `{{ ... }}` / `{% ... %}`.

    - `{first_name}` → `{{ first_name }}`
    - `{extra.creator.first_name}` → `{{ extra.creator.first_name }}` (antes solo se capturaba
      `extra` y el resto quedaba literal, rompiendo asunto/preheader).
    """
    return re.sub(
        r"(?<!\{)\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}(?!\})",
        lambda m: "{{ " + m.group(1) + " }}",
        s,
    )


def render_template_text(text: str | None, context: dict) -> str | None:
    """
    Renderiza una línea de texto (asunto, preheader) con el mismo contexto Jinja2 que el HTML.

    - Sintaxis Jinja2 estándar: `{{ ... }}`, `{% ... %}`.
    - Atajos con una sola llave: `{nombre}` o `{extra.creator.first_name}` se normalizan a `{{ ... }}`.
    """
    if text is None:
        return None
    t = _normalize_line_for_jinja(str(text))
    if not t.strip():
        return text
    if "{%" not in t:
        t = _legacy_single_braces_to_jinja(t)
    return _JINJA_LINE_ENV.from_string(t).render(**context)


def inject_tracking(
    html: str,
    *,
    api_base_url: str,
    campaign_id: str,
    recipient_id: str,
) -> str:
    """
    - Reescribe todos los <a href="..."> a URLs de tracking de clicks.
    - Inyecta el pixel de apertura al final del <body>.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Normalizar base_url sin slash final
    base = api_base_url.rstrip("/")

    # 1) Tracking de links (clicks)
    # Cada botón puede llevar un atributo data-button-id para identificarlo en los reportes.
    for a in soup.find_all("a", href=True):
        original = a["href"]
        # Solo trackeamos http/https
        if original.startswith("http://") or original.startswith("https://"):
            button_id = a.get("data-button-id")
            tracked = (
                f"{base}/track/click"
                f"?campaign_id={quote(campaign_id)}"
                f"&recipient_id={quote(recipient_id)}"
                f"&url={quote(original, safe='')}"
            )
            if button_id:
                tracked += f"&button_id={quote(button_id)}"
            a["href"] = tracked

    # 2) Pixel de apertura
    pixel_src = (
        f"{base}/track/open/{quote(campaign_id)}/{quote(recipient_id)}/logo.png"
    )
    pixel_img = soup.new_tag(
        "img",
        src=pixel_src,
        width="1",
        height="1",
        style="display:none;visibility:hidden;",
        alt="pixel de apertura",
    )

    if soup.body:
        soup.body.append(pixel_img)
    else:
        # Si no hay <body>, lo agregamos al final del HTML
        soup.append(pixel_img)

    return str(soup)

