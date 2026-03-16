#!/bin/sh
# Inicia PostgreSQL, Redis, API, Celery worker y Celery beat en el mismo contenedor.
# Usa DATABASE_URL y REDIS_URL de entorno si existen; si no, usa instancias locales.

set -e
PORT="${PORT:-8000}"
PGDATA="${PGDATA:-/app/pgdata}"

# --- Redis (local) ---
if [ -z "$REDIS_URL" ]; then
  export REDIS_URL="redis://localhost:6379/0"
  echo "Starting Redis..."
  redis-server --daemonize yes
  echo "Redis started."
fi

# --- PostgreSQL (local) ---
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5432/email_campaigns"
  echo "Starting PostgreSQL..."
  PG_BIN="/usr/lib/postgresql/15/bin"
  [ -x "$PG_BIN/initdb" ] || PG_BIN=$(find /usr/lib/postgresql -name initdb -path '*/bin/*' 2>/dev/null | head -1 | xargs dirname)
  export PATH="$PG_BIN:$PATH"

  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL data directory..."
    chown postgres:postgres "$PGDATA"
    su postgres -c "PATH=$PG_BIN:\$PATH initdb -D $PGDATA"
  fi

  su postgres -c "PATH=$PG_BIN:\$PATH pg_ctl -D $PGDATA -l $PGDATA/logfile start"
  echo "Waiting for PostgreSQL to accept connections..."
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if su postgres -c "PATH=$PG_BIN:\$PATH pg_isready -U postgres -h localhost"; then break; fi
    sleep 1
  done
  su postgres -c "PATH=$PG_BIN:\$PATH pg_isready -U postgres -h localhost" || (echo "PostgreSQL failed to start"; exit 1)

  su postgres -c "PATH=$PG_BIN:\$PATH psql -U postgres -h localhost -c \"ALTER USER postgres WITH PASSWORD 'postgres';\"" 2>/dev/null || true
  su postgres -c "PATH=$PG_BIN:\$PATH createdb -U postgres -h localhost email_campaigns" 2>/dev/null || true
  echo "PostgreSQL started."
fi

# --- API ---
echo "Starting API on port $PORT..."
uvicorn app.main:app --host 0.0.0.0 --port "$PORT" &
UVICORN_PID=$!

# --- Celery worker ---
echo "Starting Celery worker..."
celery -A worker.celery_app.celery worker --loglevel=info &
WORKER_PID=$!

# --- Celery beat ---
echo "Starting Celery beat..."
celery -A worker.celery_app.celery beat --loglevel=info &
BEAT_PID=$!

# Mantener el contenedor vivo; si alguno termina, salir
wait $UVICORN_PID $WORKER_PID $BEAT_PID
