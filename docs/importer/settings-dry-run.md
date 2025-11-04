# Save & Crawl: Settings + Background Prepare

This is the streamlined flow for preparing a Review. On Save & Crawl, we:

- Save your Import Settings (name, target, seeds)
- Start a background prepare job (discover → parse → crawl backfill → stage → diff)
- Redirect to the Imports page inside Shopify Admin with a banner (candidates, ETA)
- Show live progress at the top via streaming updates; you can leave the page

Options

- Skip successful (recommended): speed up re-runs by skipping already-successful series.

Seed scope

- Batson targets accept only seeds within batsonenterprises.com. Off-domain seeds are rejected with a clear error.

Queueing

- One active prepare per template. If one is already running, new Save & Crawl will re-use that run and show its status instead of starting another.

Long-running jobs

- The Imports page highlights runs that exceed the ETA and offers Cancel.

Production posture

- Smoke routes are disabled by default in production. They remain available in dev/staging when enabled.

Embedded Admin constraints

- Prepare returns quickly: the server avoids heavy preflight fetches and responds fast with a seed-based estimate. Work runs in the background.
- Live updates are streamed via SSE with proxy buffering disabled; a polling fallback is used automatically if streaming is unavailable.
- If your network/tenant blocks streaming, progress still updates every ~2s via polling and you can safely navigate away.

---

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

- GET {BASE}/resources/smoke/importer/prepare?token={SMOKE_TOKEN}&target=batson-rod-blanks&seeds={CSV_SEEDS}
- Example seeds value: https://batsonenterprises.com/collections/blanks
- Response: { ok, runId, supplierId }

2. Poll progress and counts

- GET {BASE}/resources/smoke/importer/run-expected?token={SMOKE_TOKEN}&runId={runId}
  - Fields: expectedItems (from preflight), stagedCount, diffCount
- Optional totals by type: {BASE}/resources/smoke/importer/run-stats?token={SMOKE_TOKEN}&runId={runId}
- Optional staged page sample: {BASE}/resources/smoke/importer/run-list?token={SMOKE_TOKEN}&runId={runId}&page=1&pageSize=25

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

Curl examples

```bash
# Start a run (Batson blanks, single seed)
curl -sS -H "Accept: application/json" "${BASE}/resources/smoke/importer/prepare?token=${SMOKE_TOKEN}&target=batson-rod-blanks&seeds=$(python -c 'import urllib.parse as u;print(u.quote("https://batsonenterprises.com/collections/blanks"))')"

# Query expected/staging/diff counts
curl -sS -H "Accept: application/json" "${BASE}/resources/smoke/importer/run-expected?token=${SMOKE_TOKEN}&runId=${RUN_ID}"
curl -sS -H "Accept: application/json" "${BASE}/resources/smoke/importer/run-stats?token=${SMOKE_TOKEN}&runId=${RUN_ID}"

# Page through staged rows
curl -sS -H "Accept: application/json" "${BASE}/resources/smoke/importer/run-list?token=${SMOKE_TOKEN}&runId=${RUN_ID}&page=1&pageSize=25"
```

Notes

- Smoke routes never modify production Shopify data; they only stage and compute diffs.
- When testing overwrite scenarios, the prepare endpoint will prompt via 409 unless confirmOverwrite is provided (UI handles this). Smoke launcher skips that guard.
