## Pipeline AI – Email Campaigns & Reporting

Aplicación full‑stack para gestionar campañas de email marketing, plantillas, remitentes y reportes avanzados (rendimiento, dispositivos, mapa geográfico, etc.).

### Tecnologías principales

- **Backend**: FastAPI + SQLAlchemy + Postgres + Redis + Celery
- **Frontend**: React + Vite + TypeScript + Recharts + Chart.js (geo)
- **Auth**: Supabase Auth
- **Geolocalización**: ipgeolocation.io (API HTTP)

---

### Puesta en marcha en local

1. **Variables de entorno**

   Crea un `.env` en la raíz (ya está ignorado en git). Ejemplo mínimo:

   ```env
   DATABASE_URL=postgresql+psycopg2://user:pass@db:5432/email_campaigns
   REDIS_URL=redis://redis:6379/0
   SUPABASE_URL=...
   SUPABASE_KEY=...
   IPGEOLOCATION_API_KEY=tu_api_key_de_ipgeolocation
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=...
   SMTP_PASSWORD=...
   VITE_API_BASE_URL=http://localhost:8000
   ```

2. **Docker Compose**

   ```bash
   docker-compose up --build
   ```

   Servicios:

   - `email_campaigns_api`: API FastAPI en `http://localhost:8000`
   - `email_campaigns_frontend`: frontend React en `http://localhost:5173` (o el puerto configurado)
   - `email_campaigns_worker` / `email_campaigns_beat`: workers de Celery
   - `email_campaigns_db`: Postgres
   - `email_campaigns_redis`: Redis

3. **Frontend (solo)**  
   Desde `frontend/`:

   ```bash
   npm install
   npm run dev
   ```

---

### Despliegue (Vercel + backend propio)

1. **Backend**: despliega la API (Docker o servicio Python) en un VPS o proveedor como Railway/Render/Fly.io, exponiendo `https://tu-backend/api`.
2. **Frontend en Vercel**:
   - Proyecto apuntando a `frontend/`.
   - Comando de build: `npm run build`.
   - Directorio de salida: `dist`.
   - Variable `VITE_API_BASE_URL=https://tu-backend`.

---

### Seguimiento de aperturas y clics de correo

#### 1. Inyección de tracking en plantillas

Al enviar una campaña, el backend:

- Carga el HTML de la plantilla.
- Reescribe todos los enlaces `<a href="...">` para pasar por un endpoint de tracking:

  ```text
  GET /track/click?campaign_id=...&recipient_id=...&url=...
  ```

- Inyecta un pixel 1x1 al final del `<body>`:

  ```html
  <img
    src="{API_BASE_URL}/track/open/{campaign_id}/{recipient_id}/logo.png"
    width="1"
    height="1"
    style="display:none"
    alt=""
  />
  ```

#### 2. Registro de aperturas

- Endpoint `GET /track/open/{campaign_id}/{recipient_id}/logo.png`:
  - Valida campaña y destinatario.
  - Inserta un registro en `email_opens` con:
    - `campaign_id`
    - `recipient_id`
    - `opened_at` (UTC)
    - `ip_address` (se usa para geolocalización)
    - `user_agent` (para estadísticas de dispositivo).
  - Devuelve un PNG transparente 1x1.

- A partir de `email_opens` se calculan:
  - `total_opens` y `unique_open_recipients` por campaña.
  - Tasa de apertura (sobre enviados).

#### 3. Registro de clics

- Endpoint `GET /track/click`:
  - Recibe `campaign_id`, `recipient_id` y `url` en query.
  - Inserta en `email_clicks`:
    - `campaign_id`, `recipient_id`, `url`, `ip_address`, `user_agent`, `clicked_at`.
  - Redirige (302) a la URL original.

- Desde `email_clicks` se calculan:
  - Total de clics,
  - CTR (clics / enviados),
  - Clics por botón/CTA.

#### 4. Geolocalización por país (ipgeolocation.io + cache)

- El endpoint `GET /reports/campaigns/{campaign_id}/locations`:
  - Agrupa las IP de `email_opens` para esa campaña.
  - Usa una tabla `ip_geolocation_cache` (`ip`, `country_code`, `country_name`, `last_seen_at`) para evitar consultas repetidas.
  - Para IPs nuevas:
    - Llama a `https://api.ipgeolocation.io/v3/ipgeo?apiKey=...&ip=...` (máx. 300 IPs por petición).
    - Extrae `location.country_code2` y `location.country_name`.
    - Guarda el resultado en `ip_geolocation_cache`.
  - Devuelve una lista de países con su número de aperturas.

Esto alimenta el mapa de calor geográfico en el dashboard de reportes, sin sobrepasar fácilmente el límite diario de créditos de ipgeolocation.io.

