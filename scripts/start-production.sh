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
  # Quiet helper to suppress noisy P3008 logs when a migration is already recorded
  quiet_resolve() {
    # Prisma prints "Error: P3008" even for idempotent resolve operations.
    # We silence stdout/stderr and ignore failures since we're probing state.
    npx prisma migrate resolve "$@" >/dev/null 2>&1 || true
  }
  echo "[startup] pre-resolving known failed migrations (idempotent)" >&2
  quiet_resolve --applied 20251020184730_importer_v2_schema_fix
  quiet_resolve --applied 20251029120000_importer_v2_3_schema
  # Pre-resolve additive columns that our runtime guard may have already created
  quiet_resolve --applied 20251022120000_add_template_cost
  # If a migration had previously failed, mark it rolled-back first, then applied
  quiet_resolve --rolled-back 20251022130000_templates_status
  quiet_resolve --applied 20251022130000_templates_status
  quiet_resolve --applied 20251102123000_add_importtemplate_preparing_runid
  quiet_resolve --applied 20251102214000_add_spectemplate_status
  quiet_resolve --applied 20251103113000_add_importrun_progress
  echo "[startup] running prisma migrate deploy" >&2
  if ! npx prisma migrate deploy; then
    if [ "${STRICT_MIGRATIONS:-0}" = "1" ]; then
      echo "[startup] migrations failed and STRICT_MIGRATIONS=1 set; exiting" >&2
      exit 1
    else
      echo "[startup] migrations failed; attempting targeted resolve then retry (non-fatal)" >&2
      quiet_resolve --applied 20251022120000_add_template_cost
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
echo "[startup] launching custom remix server --host ${HOST} --port ${PORT}" >&2
exec node ./server/remix-serve.mjs
