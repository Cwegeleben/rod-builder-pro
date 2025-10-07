#!/usr/bin/env sh
set -eu

echo "[startup] NODE_ENV=$NODE_ENV PORT=${PORT:-3000} starting production server" >&2
# Ensure prisma client is generated (idempotent)
if [ ! -d node_modules/.prisma ]; then
  echo "[startup] prisma generate (cold)" >&2
  npx prisma generate
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

# Launch remix server binding to 0.0.0.0:$PORT
export PORT="${PORT:-3000}"
exec node --enable-source-maps ./node_modules/.bin/remix-serve ./build/server/index.js
