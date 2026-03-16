#!/bin/sh
# Inicia Redis local (opcional), API (FastAPI) y Celery (worker + beat) en el mismo contenedor.

set -e
PORT="${PORT:-8000}"

# --- Redis local (solo si no tienes REDIS_URL definida) ---
if [ -z "$REDIS_URL" ]; then
  export REDIS_URL="redis://localhost:6379/0"
  echo "Starting local Redis on 6379..."
  redis-server --save "" --appendonly no --bind 0.0.0.0 --port 6379 &
  REDIS_PID=$!
else
  echo "Using external Redis at $REDIS_URL"
fi

echo "Starting API on port $PORT..."
uvicorn app.main:app --host 0.0.0.0 --port "$PORT" &
UVICORN_PID=$!

echo "Starting Celery worker + beat (bajo consumo)..."
celery -A worker.celery_app.celery worker --beat --loglevel=info --pool=solo --concurrency=1

# Si Celery termina, matar también la API y Redis local (si existe)
kill "$UVICORN_PID" 2>/dev/null || true
[ -n "$REDIS_PID" ] && kill "$REDIS_PID" 2>/dev/null || true
