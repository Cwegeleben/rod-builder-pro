#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <migration_name> <applied|rolled-back>" >&2
  exit 1
fi

MIGRATION="$1"
ACTION="$2"

case "$ACTION" in
  applied|rolled-back) ;;
  *) echo "Second arg must be 'applied' or 'rolled-back'" >&2; exit 1;;
_esac

echo "[info] Resolving migration $MIGRATION as $ACTION"
DATABASE_URL="${DATABASE_URL:-}" npx prisma migrate resolve --$ACTION "$MIGRATION"

echo "[done] Run a new corrective migration if needed: npx prisma migrate dev --name fix_<something>"
