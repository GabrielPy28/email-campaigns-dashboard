#!/bin/sh
# Inicia API (FastAPI) y Celery (worker + beat) en el mismo contenedor.
# No arranca PostgreSQL ni Redis locales: debes usar DATABASE_URL y REDIS_URL
# ya configurados en el entorno de Railway (o bien servicios externos).

set -e
PORT="${PORT:-8000}"

echo "Starting API on port $PORT..."
uvicorn app.main:app --host 0.0.0.0 --port "$PORT" &
UVICORN_PID=$!

echo "Starting Celery worker + beat (bajo consumo)..."
celery -A worker.celery_app.celery worker --beat --loglevel=info --pool=solo --concurrency=1

# Si Celery termina, matar también la API
kill "$UVICORN_PID" 2>/dev/null || true
