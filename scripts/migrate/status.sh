#!/usr/bin/env bash
set -euo pipefail

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found" >&2
  exit 1
fi

echo "[prisma] migrate status"
DATABASE_URL="${DATABASE_URL:-}" npx prisma migrate status || true
