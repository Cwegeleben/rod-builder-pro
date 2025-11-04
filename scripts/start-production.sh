#!/usr/bin/env sh
set -eu

echo "[startup] NODE_ENV=$NODE_ENV PORT=${PORT:-3000} starting production server" >&2
# Prisma client should be generated at build time in the image; skip runtime generate to avoid startup hangs
if [ ! -d node_modules/.prisma ]; then
  echo "[startup] WARNING: Prisma client not found; proceeding without runtime generate" >&2
fi
# Run migrations unless skipped
if [ "${SKIP_MIGRATE:-0}" = "1" ]; then
  echo "[startup] SKIP_MIGRATE=1 (skipping migrations)" >&2
else
  echo "[startup] running prisma migrate deploy" >&2
  if ! npx prisma migrate deploy; then
    if [ "${STRICT_MIGRATIONS:-0}" = "1" ]; then
      echo "[startup] migrations failed and STRICT_MIGRATIONS=1 set; exiting" >&2
      exit 1
    else
      echo "[startup] migrations failed; continuing (STRICT_MIGRATIONS not set)" >&2
    fi
  fi
fi

# Best-effort: ensure critical columns exist in SQLite (production uses file:/data/dev.sqlite)
# This guards against baseline drift when migration history is incomplete.
echo "[startup] ensuring critical schema columns exist (best-effort)" >&2
node -e "require('./scripts/preflight/ensure-schema.mjs').ensure().catch(()=>process.exit(0))" || true

# Launch remix server binding to 0.0.0.0:$PORT
export PORT="${PORT:-3000}"
export HOST="${HOST:-0.0.0.0}"
# Invoke remix-serve and explicitly bind host and port for Fly proxy
exec ./node_modules/.bin/remix-serve ./build/server/index.js --host "$HOST" --port "$PORT"
