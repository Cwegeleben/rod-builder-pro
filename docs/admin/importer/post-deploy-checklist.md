# Importer v2.3 — Post-deploy validation (Production)

This checklist validates the Imports page and Import Logs table in production under an authenticated Shopify Admin session.

Prereqs

- Use the Shopify Admin embedded app entry for your HQ/dev shop.
- ALLOW_HQ_OVERRIDE is disabled in production; direct API calls to importer endpoints will 401/redirect.

Schedule page deep-linking

- The Schedule page is meant to be accessed from inside the embedded app. In production, opening the URL directly (outside Admin) will 404/401 because ALLOW_HQ_OVERRIDE=0. To validate in production, navigate from the Imports list row action “Schedule”.

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

Importer Logs (bottom) — Polaris IndexTable

Updated feature set (Importer v2.3):

- Filters:
  - Type: All, Prepare, Settings, Approve, Publish, Discovery, Scrape, Schedule, Recrawl, Errors.
  - Import: All + list of import names.
  - Run: text input filters by substring.
  - Past: All, 1h, 24h, 7d.
  - URL persistence: Filter changes update the URL; reloading restores the same filters.
- Controls:
  - Refresh: Manually fetches latest logs and merges/dedupes (optional; SSE already streams live events).
  - Load older: Uses the bottom cursor and appends older entries; respects the Past filter.
  - Live SSE: Always on silently; no toggle. New entries appear automatically.
- Rows:
  - When: relative time with absolute time on hover.
  - Level: badge tone inferred (publish:start attention, publish:done success, publish:error critical, schedule:view subdued, etc.).
  - Import: badge with display name (and id if different).
  - Run: “run” label and a link to Review for the runId; active preparing runs show a small “live” badge.
  - Message: concise summary (e.g., prepare:report 7/30 • 4 staged • 1 errors; publish:done created 2 • updated 1).
  - Actions: (Removed in v2.3) details/copy buttons replaced by simplified read-only view; copying can be done manually if needed.

Suggested quick pass (≈2 minutes)

1. Filters work together
   - Set Query to a substring of a known runId.
   - More filters: Type → Errors, Import → a specific import, Run → a suffix (e.g., -2), Past → 1h.
   - Expect only matching rows; “No logs match your filters” appears when nothing matches.

- Refresh the browser tab; the same filters should be restored from the URL.

2. Publish filter

- Set Type → Publish; confirm only publish:\* rows (start / done / error) remain and summary shows created/updated counts.

3. Refresh merges/dedupes

- Click Refresh twice; duplicated events should not multiply (order newest→oldest preserved).

4. SSE live updates

- Trigger an action (e.g., approve or publish). New rows appear automatically (no toggle).

5. Load older honors Past
   - Select Past: 1h, then click Load older; more rows append and order remains newest→oldest.
6. Review navigation
   - Click a runId link; it opens the Review route for that run.
7. Active run badge

- While prepare is in progress, a “live” badge appears next to the run id. It disappears after prepare:done.

Legacy actions (Copy run link / Details) are intentionally removed for a cleaner table; verify absence if upgrading.

Schedule — per-import configuration

- Open an import row via “Schedule” and verify:
  - Title reads “Schedule — {Import Name}”.
  - A “Manage settings” link points back to the Settings page for the same import (preserves embedded query params).
  - A hint under the title:
    - “Scheduling available” when state is APPROVED or SCHEDULED.
    - “Enable after a published run” otherwise.
  - A visible tag “Importer v2.3” on the title row.
- Form behavior:
  - Enable schedule only when state is APPROVED/SCHEDULED; otherwise checkbox is disabled and shows helper text.
  - Frequency: Daily/Weekly/Monthly; Time: HH:MM; Next run previews a local time when enabled.
  - Save persists and navigates back to Imports, showing a toast.
  - Disable transitions state from SCHEDULED → APPROVED; enabling keeps APPROVED/SCHEDULED.
- Recrawl:
  - “Recrawl now” starts a crawl and shows a toast; Import Logs should show recrawl:\* events.
- Observability:
  - Visiting the Schedule page emits a schedule:view log (Type filter → Schedule).
  - A completed publish emits publish:start then publish:done with created/updated/skipped/failed totals.

Troubleshooting

- No logs visible: Click Refresh; ensure filters/past aren’t overly restrictive.
- Live shows “reconnecting”: check network tab for /api/importer/logs/stream (should be text/event-stream; 200)
- Review link 404: confirm the run exists via API/DB and that the link includes the correct runId.
- Load older disabled: This is expected when there’s no older cursor yet or while loading; click Refresh first or wait for the current load to finish.
- Schedule page 404/401 when directly opened: Access it from the embedded admin UI; production blocks deep-links without an embedded session.
