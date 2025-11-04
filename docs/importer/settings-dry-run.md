# Settings dry-run on production (no Shopify session)

This guide lets you validate the new Settings + Prepare flow on any environment without a Shopify-embedded session by using the smoke endpoints guarded by ENABLE_SMOKES and SMOKE_TOKEN.

Prereqs

- Set environment flags on the target app:
  - ENABLE_SMOKES=1
  - SMOKE_TOKEN=<your-token>
  - IMPORTER_BG_ENABLED=1
  - VITE_IMPORTER_SSE_ENABLED=1 (optional; enables UI banners if you browse the app)
- Know your base URL, e.g. https://your-app.fly.dev

Option A — Use the UI (HQ only)

- Visit /app/imports?hq=1
- Open a template → Settings
- Pick target “Batson Rod Blanks”, click Discover, adjust Seeds, then Save & Crawl.
- Watch the global banner or Job Center for live progress; when ready, click Open Review.

Option B — Smoke-only API (no HQ)

1. Launch a prepare run

- GET {BASE}/resources.smoke.importer.prepare?token={SMOKE_TOKEN}&target=batson-rod-blanks&seeds={CSV_SEEDS}
- Example seeds value: https://batsonenterprises.com/collections/blanks
- Response: { ok, runId, supplierId }

2. Poll progress and counts

- GET {BASE}/resources.smoke.importer.run-expected?token={SMOKE_TOKEN}&runId={runId}
  - Fields: expectedItems (from preflight), stagedCount, diffCount
- Optional totals by type: {BASE}/resources.smoke.importer.run-stats?token={SMOKE_TOKEN}&runId={runId}
- Optional staged page sample: {BASE}/resources.smoke.importer.run-list?token={SMOKE_TOKEN}&runId={runId}&page=1&pageSize=25

3. Review results (UI)

- If you have an HQ session, open /app/imports/runs/{runId}/review to inspect staged rows, diffs, and totals.

One-liner helper script

- scripts/smoke/dry-run.mjs provides a tiny Node script that:
  - Starts a prepare run via the smoke endpoint (target + seeds or templateId)
  - Polls expected/staging/diff counts for ~60s and prints a compact summary

Troubleshooting

- 404 on smoke routes → ENABLE_SMOKES is off
- 403 on smoke routes → bad or missing SMOKE_TOKEN
- No progress for >60s → check Fly logs for headless renderer availability; optionally increase resources or retry with strategy=static seeds
- UI banners missing → ensure VITE_IMPORTER_SSE_ENABLED=1 and refresh

Notes

- Smoke routes never modify production Shopify data; they only stage and compute diffs.
- When testing overwrite scenarios, the prepare endpoint will prompt via 409 unless confirmOverwrite is provided (UI handles this). Smoke launcher skips that guard.
