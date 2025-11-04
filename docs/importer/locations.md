# Importer locations: current vs legacy

This repo contains both the current importer (in active use) and some legacy importer code kept for historical reference. Use this page to quickly find the right places and avoid accidental edits to legacy code.

## Current importer (active)

- Admin UI routes (Remix):

  - `app/routes/app.imports.$templateId.tsx` (Settings + Save & Crawl launcher)
  - `app/routes/app.imports.$templateId.review.tsx` (Prepare Review / Review UI)
  - `app/routes/app.imports.runs.$runId.review.tsx` (Review by run)

- APIs and resources:

  - `app/routes/api.importer.*` (e.g., `prepare`, `targets.$id.settings`, `runs`, `approve`, etc.)
  - `app/routes/resources.smoke.importer.prepare.ts` (token-guarded smoke prepare)

- Importer services and site configs:

  - `app/services/importer/` (run options, staging→diff, approve, etc.)
  - `app/server/importer/sites/` (site discovery + per-site configs)

- Crawler + staging library:
  - `packages/importer/` (crawlers, staging upsert, pipelines)

Notes

- Canonical admin paths are under `/app/imports.*`. Any `/app/admin/import.*` files exist only as redirects/shims.
- Diffs now coerce Decimal values to numbers to avoid JSON serialization issues.

## Legacy importer (do not touch)

- Legacy admin portal code (not used by the current app):

  - `src/apps/admin.portal/` (old Polaris-based portal, state machine, components)

- Legacy routes kept only as redirects:
  - `app/routes/app.admin.import.*` (redirect shims to the canonical `/app/imports.*` routes)

Important

- Do not modify files under `src/apps/admin.portal/`. They’re kept for reference and should not be used for new work.
- Do not expand features under `app/routes/app.admin.import.*`. They should only redirect to the current routes.
