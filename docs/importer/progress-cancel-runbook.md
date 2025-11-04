# Importer progress, cancellation, logs, and migration

This runbook covers how progress is reported, how cancellation works, where to find logs, and how to add the optional ImportRun.progress column in production.

## Progress model

- DB: `ImportRun.progress` (JSON, optional). Shape:
  - `{ phase: string, percent: number, etaSeconds?: number, counts?: object, details?: object }`
- Status stream includes progress and key metadata:
  - GET `/api/importer/runs/:runId/status/stream` → Server-Sent Events with `{ runId, status, progress, counts, templateId, templateName, startedAt, finishedAt, preflight }`.
  - Stream ends automatically on `staged`, `failed`, or `cancelled`.
- UI surfacing:
  - Global Progress Banner: phase, percent, friendly ETA, started-ago, preflight (~series, ~items), View logs, Cancel.
  - Job Center Drawer: lists in-flight runs with phase/%/ETA, started-ago, preflight, View logs, Cancel.
  - Imports List Row: inline Preparing… with progress; Review re-enabled when staged.

Notes

- Code tolerates missing `ImportRun.progress` (pre-migration). Writes are best-effort and ignored if the column is absent.

## Cancellation

- API: POST `/api/importer/runs/:runId/cancel` sets `ImportRun.summary.control.cancelRequested = true`.
- Orchestrator checks mid-phase via `throwIfCancelled(runId)`; on cancel it marks the run `status='cancelled'` and exits.
- Streams and UIs:
  - SSE closes with a `status: cancelled` event; UI shows a Cancelled banner and toasts in Job Center.

## Logs

- DB: `ImportLog` (template-scoped). We write at least:
  - `orchestrator:start|done|error|cancelled`
  - `prepare:cancel` when a cancel is requested
  - Per-phase logs are optional and can be expanded if deeper diagnostics are needed.
- UI links:
  - Global Banner and Job Center have “View logs” links to the template page when available, else to Imports index.

## Migration: add ImportRun.progress (recommended)

- Schema already includes `ImportRun.progress Json?`.
- Production-safe guard: startup runs `scripts/preflight/ensure-schema.mjs`, which now adds the `progress` JSON column on SQLite if missing.
- Formal migration (recommended):
  1. Create a Prisma migration to add the column
     - `ALTER TABLE "ImportRun" ADD COLUMN "progress" JSON` (SQLite)
  2. Check in under `prisma/migrations/` and deploy with `prisma migrate deploy`.
  3. Regenerate Prisma client: `prisma generate`.

## Tests

- Unit
  - `tests/importer/runOptions.server.unit.test.ts` includes: parsing options; templateKey propagation; early-cancel handling (marks status=cancelled when `summary.control.cancelRequested`).
- Integration
  - `tests/e2e/importer.prepare.inline.spec.ts` exercises inline Prepare: mocks endpoints, shows progress, and re-enables Review on `started/staged` transition.
  - Additional SSE end-event tests could be added for full coverage if needed.

## Operability

- Health: `/resources/health` for Fly checks.
- Startup script: `scripts/start-production.sh` binds `remix-serve` to `0.0.0.0:$PORT`, runs `prisma migrate deploy` best-effort, and executes the schema guard.
- If Fly warns about listening address, verify startup logs show `launching remix-serve --host 0.0.0.0 --port 3000` and consider increasing health check grace period during DB migrations.
