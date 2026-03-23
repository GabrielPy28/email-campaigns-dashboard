"""Serialización de categorías de cuenta para almacenamiento en BD (texto legible, no JSON array)."""


def format_categories_for_db(labels: list[str]) -> str | None:
    """
    Una: "gaming"
    Dos: "gaming and tech"
    Tres o más: "gaming, tech, and comedy"
    """
    xs = [x.strip() for x in labels if x is not None and str(x).strip()]
    if not xs:
        return None
    if len(xs) == 1:
        return xs[0]
    if len(xs) == 2:
        return f"{xs[0]} and {xs[1]}"
    return f"{', '.join(xs[:-1])}, and {xs[-1]}"


def parse_categories_from_db(raw: object) -> list[str]:
    """
    Invierte format_categories_for_db. Acepta legado: lista JSON en columna JSONB.
    """
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    s = str(raw).strip()
    if not s:
        return []
    if ", and " in s:
        head, last = s.rsplit(", and ", 1)
        parts = [p.strip() for p in head.split(",") if p.strip()]
        tail = last.strip()
        if tail:
            parts.append(tail)
        return parts
    if " and " in s:
        a, b = s.split(" and ", 1)
        return [p for p in (a.strip(), b.strip()) if p]
    return [s]
