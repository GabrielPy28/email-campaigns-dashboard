FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PGDATA=/app/pgdata

# PostgreSQL y Redis para ejecutarlos en el mismo contenedor (scripts/start_all.sh)
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql redis-server \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/pgdata \
    && chown -R postgres:postgres /app/pgdata

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app

CMD ["sh", "scripts/start_all.sh"]

