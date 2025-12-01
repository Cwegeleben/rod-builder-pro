# Importer workflow (entry points and call graph)

This doc summarizes how runs flow from seeding to Review to Publish.

## Entry points

- **Simple run (canonical)**: `app/services/importer/runOptions.server.ts::startImportFromOptions`

  - This is the only supported way to kick off Batson importer work (locally or on Fly). It handles discovery, staging, diffing, and readiness plumbing in one flow.
  - Always trigger importer refreshes through this entry point (or the UI endpoint that calls it). Command-line helpers (`npm run importer:smoke`, ad-hoc `tsx` scripts, etc.) are reserved for diagnostics and should not be used for production data loads.

- Stage latest (HQ): `app/routes/api.importer.runs.ts` (action `stage-latest`)

  - Resolves supplierId from ImportTemplate target via `getTargetById`.
  - Calls `packages/importer/src/pipelines/diff.diffStagingToCanonical(supplierId)`.
  - Marks run `staged`, writes counts, returns `{ ok, runId, totals }`.

- Manual launcher: `app/services/importer/runOptions.server.ts::startImportFromOptions`

  - Seeds via series-parser (optional) then `crawlBatson`.
  - Computes diffs into existing or new run (same supplierId).
  - Marks run `staged`, persists counts/options, and feeds downstream readiness jobs.

- Publish: `app/routes/api.importer.runs.$runId.publish.shopify.ts`

  - Preconditions: conflicts=0; approved>0.
  - Calls `app/services/importer/publishShopify.server.ts::publishRunToShopify({ dryRun })`.
  - Dry-run: totals only. Real: `packages/importer/src/sync/shopify.upsertShopifyForRun`.

- Review data: `app/server/importer/review.server.ts`
  - `computeTotals`, `queryStagedRows`, `getRowDetails` consume `ImportDiff` rows for runId.

## Packages

- Staging upsert: `packages/importer/src/staging/upsert.ts::upsertStaging` → writes PartStaging with `hashContent`.
- Crawl: `packages/importer/src/crawlers/batsonCrawler.ts::crawlBatson` → discover + extract + stage + link source.
- Diff: `packages/importer/src/pipelines/diff.ts::diffStagingToCanonical` → create ImportRun + ImportDiff for supplier.
- Normalize: `packages/importer/src/pipelines/applyNormalization.ts` (optional) → write normSpecs + recompute hashContent.
- Shopify sync: `packages/importer/src/sync/shopify.ts::upsertShopifyForRun` → idempotent create/update + metafields + images.

## Call graph sketch

- Stage latest:

  - api.importer.runs → diff.diffStagingToCanonical → prisma.PartStaging/Part → prisma.ImportRun + prisma.ImportDiff

- Manual launcher:

  - runOptions.startImportFromOptions → (optional series parser) → crawlBatson → upsertStaging/linkExternalIdForSource →
    createDiffRowsForRun (in file) → prisma.ImportDiff → prisma.ImportRun(status: staged)

- Publish:
  - api.importer.runs.$runId.publish.shopify → publishRunToShopify → (dry) totals or (real) upsertShopifyForRun

## Diagnostics

- Launcher now logs a small trace around diffing:

  - `[prepare-review-wirefix] before-diff { supplierId, seedCount, stagingCount, runId }`
  - `[prepare-review-wirefix] after-diff  { supplierId, diffCount, runId }`

- Smoke helpers:
  - `resources/smoke/importer/run-list?runId=...`, `run-stats?runId=...`, `publish-dry-run?runId=...`.

## Notes

- Review shows `ImportDiff` rows only. If staging > 0 but diffs = 0, Review UI will be empty.
- Re-running Prepare Review is idempotent: staging upserts; diffs overwrite per run.
- Deprecated helpers: the legacy CLI scripts (`npm run importer:smoke`, `tsx packages/importer/...`) remain for troubleshooting but are not part of the happy path. When in doubt, fire the “simple run” launcher so future syncs follow the exact same pipeline every time.
