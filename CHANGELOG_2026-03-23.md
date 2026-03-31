# Envío campañas: variables, GeoIP por IP y dashboard renovado

Variables, asunto y HTML con creador live; GeoIP local; UI campañas.

---

## Cambios — 23 de marzo de 2026

Resumen de mejoras y correcciones integradas en el repositorio (backend FastAPI, worker Celery, frontend React).

---

## Envío de campañas y plantillas

### Contexto Jinja y datos del creador (`app/emails/smtp_client.py`, `app/lists/creator_utils.py`)

- Al enviar, se **fusiona** `campaign_recipients.extra_data` con datos **vivos** de `creators` (y `account_profiles` vía `joinedload`) cuando `recipient_id` es un UUID de creador. Las claves del creador **pisan** las del JSON guardado; el resto del CSV/import se conserva.
- **Asunto y preheader** se renderizan con el **mismo contexto** que el HTML (`render_template_text` + `build_jinja_context_from_recipient` con `extra_data` fusionado).
- Resolución del **asunto**: orden `subject` explícito → `campaign.subject` → `campaign.name` (evita usar el nombre de campaña antes de aplicar Jinja).
- **Worker** (`worker/tasks.py`): pasa `campaign.subject` y `campaign.preheader` sin sustituir por `name` en la llamada; el fallback queda centralizado en `send_campaign_email`.

### Motor de texto para asunto/preheader (`app/emails/template_renderer.py`)

- `coerce_extra_data_to_dict` para normalizar JSONB/Mapping/string.
- `_legacy_single_braces_to_jinja`: soporta rutas con puntos (`{extra.creator.first_name}`) sin romper `{{ ... }}`.
- `_normalize_line_for_jinja`: `html.unescape` y llaves Unicode `｛｝` → `{}`.
- `Environment` Jinja con **`ChainableUndefined`** para líneas cortas (asunto/preheader).
- `_enrich_extra_with_creator_block`: rellena planos desde `extra.creator`, incluyendo **`main_platform`** y **`max_followers`** cuando faltan en la raíz.

### Variables en `extra` (`app/lists/creator_utils.py`)

- Bloque **`extra.creator`**: añadidos **`main_platform`** y **`max_followers`** (además de las claves planas ya existentes en `extra`).

### Envíos de prueba (`app/campaigns/test_send.py`)

- `send_campaign_email` recibe `subject=payload.subject or None` para reutilizar la misma lógica de fallback que las campañas reales.

---

## Tracking y geolocalización

### Pixel de apertura (`app/tracking/router.py`)

- Respuesta del PNG 1×1 con cabeceras **`Cache-Control: no-store`**, **`Pragma: no-cache`**, **`Expires: 0`** para reducir caché agresiva del cliente (limitación conocida en Gmail u otros proxies).

### IP → país (`app/core/ip_country_lookup.py`, `app/reports/router.py`, `app/core/config.py`)

- Nuevo módulo: **MaxMind GeoLite2** (`.mmdb`) vía `GEOIP2_DATABASE_PATH` / `GEOIP2_CITY_PATH` / setting `geoip2_database_path`; fallback **ipgeolocation.io** con `IPGEOLOCATION_API_KEY`.
- Caché en **`ip_geolocation_cache`**; presupuesto HTTP (300 llamadas) en el informe de ubicaciones.
- Tras **open/click**, se intenta **precalentar** la caché (segundo `commit`, sin romper el pixel si falla).
- No se usa el paquete `fastapi-geolocation` (middleware roto en upstream).

---

## Dashboard de campañas (frontend)

### `frontend/src/pages/dashboard/CampanasPage.tsx`

- Rediseño con **jerarquía visual**: KPIs, gráfico principal (rendimiento por destinatario), fila secundaria (países + dispositivos + Brevo + clics por botón), listado/tablas.
- **Tema claro** alineado con el sidebar (`bg-slate-50`, tarjetas blancas, bordes `slate-200`).
- Tokens de color (primary/secondary/accent), tarjetas con sombra suave, **Framer Motion** en secciones/KPIs.
- Recharts con rejillas/tooltips adaptados al tema claro.

### Variables en UI (`frontend/src/lib/templateVariables.ts`)

- Entradas para **`main_platform`** y **`max_followers`** (plano y `extra.creator.*`).
- Snippets de asunto/preheader ampliados.

---

## Dependencias y configuración

- **`geoip2`**: ya listado en `requirements.txt` para lectura local de `.mmdb`.
- Variables de entorno relevantes: `GEOIP2_DATABASE_PATH`, `IPGEOLOCATION_API_KEY`, `API_BASE_URL` (tracking en correos).

---

## Archivos tocados (referencia rápida)

| Área | Archivos principales |
|------|----------------------|
| Envío / plantillas | `app/emails/smtp_client.py`, `app/emails/template_renderer.py`, `app/lists/creator_utils.py`, `app/campaigns/test_send.py`, `worker/tasks.py` |
| Tracking / geo | `app/tracking/router.py`, `app/core/ip_country_lookup.py`, `app/reports/router.py`, `app/core/config.py` |
| Frontend campañas | `frontend/src/pages/dashboard/CampanasPage.tsx`, `frontend/src/lib/templateVariables.ts` |

---

*Documento generado para release interna — 23 de marzo de 2026.*
