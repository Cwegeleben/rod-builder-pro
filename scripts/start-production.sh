#!/usr/bin/env sh
set -eu

echo "[startup] NODE_ENV=${NODE_ENV:-} PORT=${PORT:-3000} starting production server" >&2
# Prisma client should be generated at build time in the image; skip runtime generate to avoid startup hangs
if [ ! -d node_modules/.prisma ]; then
  echo "[startup] WARNING: Prisma client not found; proceeding without runtime generate" >&2
fi
# Run migrations unless skipped
if [ "${SKIP_MIGRATE:-0}" = "1" ]; then
  echo "[startup] SKIP_MIGRATE=1 (skipping migrations)" >&2
else
  echo "[startup] pre-resolving known failed migrations (idempotent)" >&2
  npx prisma migrate resolve --applied 20251020184730_importer_v2_schema_fix || true
  npx prisma migrate resolve --applied 20251029120000_importer_v2_3_schema || true
  # Pre-resolve additive columns that our runtime guard may have already created
  npx prisma migrate resolve --applied 20251022120000_add_template_cost || true
  # If a migration had previously failed, mark it rolled-back first, then applied
  npx prisma migrate resolve --rolled-back 20251022130000_templates_status || true
  npx prisma migrate resolve --applied 20251022130000_templates_status || true
  npx prisma migrate resolve --applied 20251102123000_add_importtemplate_preparing_runid || true
  npx prisma migrate resolve --applied 20251102214000_add_spectemplate_status || true
  npx prisma migrate resolve --applied 20251103113000_add_importrun_progress || true
  echo "[startup] running prisma migrate deploy" >&2
  if ! npx prisma migrate deploy; then
    if [ "${STRICT_MIGRATIONS:-0}" = "1" ]; then
      echo "[startup] migrations failed and STRICT_MIGRATIONS=1 set; exiting" >&2
      exit 1
    else
      echo "[startup] migrations failed; attempting targeted resolve then retry (non-fatal)" >&2
      npx prisma migrate resolve --applied 20251022120000_add_template_cost || true
      # Retry deploy once more after targeted resolve
      if ! npx prisma migrate deploy; then
        echo "[startup] migrations still failing; continuing (STRICT_MIGRATIONS not set)" >&2
      fi
    fi
  fi
fi

# Best-effort: ensure critical columns exist in SQLite (production uses file:/data/dev.sqlite)
# This guards against baseline drift when migration history is incomplete.
echo "[startup] ensuring critical schema columns exist (best-effort)" >&2
# Use dynamic import for ESM module to avoid require() on .mjs failure under type:module
node -e "import('./scripts/preflight/ensure-schema.mjs').then(m=>m.ensure()).catch(()=>0)" || true

# Launch remix server binding to 0.0.0.0:$PORT
export PORT="${PORT:-3000}"
export HOST="${HOST:-0.0.0.0}"
echo "[startup] launching remix-serve --host ${HOST} --port ${PORT}" >&2
# Invoke remix-serve and explicitly bind host and port for Fly proxy
exec ./node_modules/.bin/remix-serve ./build/server/index.js --host "$HOST" --port "$PORT"
