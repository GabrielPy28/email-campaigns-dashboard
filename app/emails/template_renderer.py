from urllib.parse import quote

from bs4 import BeautifulSoup


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
        alt="",
    )

    if soup.body:
        soup.body.append(pixel_img)
    else:
        # Si no hay <body>, lo agregamos al final del HTML
        soup.append(pixel_img)

    return str(soup)

