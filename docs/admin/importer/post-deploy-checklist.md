# Importer v2.3 — Post-deploy validation (Production)

This checklist validates the Imports page and Import Logs table in production under an authenticated Shopify Admin session.

Prereqs

- Use the Shopify Admin embedded app entry for your HQ/dev shop.
- ALLOW_HQ_OVERRIDE is disabled in production; direct API calls to importer endpoints will 401/redirect.

Imports page (top) — Import List

- Sort order: Rows are ordered by most recent activity (newest first):
  - Prefer preparing.startedAt when a run is preparing.
  - Else use lastRunAt.
- Row content:
  - Name links to Settings.
  - State badge reflects current state.
  - If APPROVED/SCHEDULED, an “Enable/Disable schedule” button toggles state and updates next run.
  - If a last run exists, “View last run” links to Review.
- Preparing indicator:
  - Shows phase text, ETA, and a progress bar that updates roughly every 2s.
  - When staging completes, a toast “Review is ready” appears and the row enables Review.

Import Logs (bottom) — Polaris IndexTable

- Filters:
  - Type: All, Prepare, Settings, Approve, Discovery, Scrape, Schedule, Recrawl, Errors.
  - Import: All + list of import names.
  - Run: text input filters by substring.
  - Past: All, 1h, 24h, 7d.
  - URL persistence: Filter changes update the URL; reloading restores the same filters.
- Controls:
  - Refresh: Merges latest entries and keeps newest first.
  - Live: Opens an SSE stream; label shows Live (on) when connected. New entries append automatically.
  - Load older: Uses the bottom cursor and appends older entries; respects the Past filter.
- Rows:
  - When: relative time with absolute time on hover.
  - Level: success/info/attention/warning/critical badge inferred from type.
  - Import: badge with display name (and id if different).
  - Run: “run” label and a link to Review for the runId.
  - Message: concise summary (e.g., prepare:report 7/30 • 4 staged • 1 errors).
  - Actions: Details toggles payload JSON; Copy copies the payload; Copy run link writes the Review URL to the clipboard and shows a success toast.

Suggested quick pass (≈2 minutes)

1. Filters work together
   - Set Query to a substring of a known runId.
   - More filters: Type → Errors, Import → a specific import, Run → a suffix (e.g., -2), Past → 1h.
   - Expect only matching rows; “No logs match your filters” appears when nothing matches.

- Refresh the browser tab; the same filters should be restored from the URL.

2. Refresh merges/dedupes
   - Click Refresh twice; duplicated events should not multiply.
3. Live updates
   - Toggle Live; perform an action that emits a log (e.g., Save & Crawl on an Import Settings page).
   - New rows appear without clicking Refresh.
4. Load older honors Past
   - Select Past: 1h, then click Load older; more rows append and order remains newest→oldest.
5. Review navigation
   - Click a runId link; it opens the Review route for that run.
6. Copy run link & toast

- Open row actions and click “Copy run link”.
- Expect a success toast; paste into a text field to confirm the URL looks like /app/imports/runs/<runId>/review.

Troubleshooting

- No logs visible: Click Refresh; ensure filters/past aren’t overly restrictive.
- Live shows “reconnecting”: check network tab for /api/importer/logs/stream (should be text/event-stream; 200)
- Review link 404: confirm the run exists via API/DB and that the link includes the correct runId.
- Load older disabled: This is expected when there’s no older cursor yet or while loading; click Refresh first or wait for the current load to finish.
