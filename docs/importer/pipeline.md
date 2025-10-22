# Importer pipeline — reference scaffold

This document maps the Import feature end-to-end and serves as a checklist when editing or debugging the importer.

It mirrors the happy-path steps, points to code, and lists quick tests/commands.

## UI entry points

- Products page → Import button
  - Route: `app/routes/app.products._index.tsx`
  - Button: `<Button url="/app/admin/import/runs">Import</Button>` (HQ-only)
  - Test ID: `TEST_IDS.btnProductsImport`
- Canonical index: Import Runs
  - Route: `app/routes/app.admin.import.runs._index.tsx`
  - From here, use “New Import” (or Edit) to configure and run.

## Happy path steps and code map

1. Start a run (UI)

- Route: `app/routes/app.admin.import.new.tsx`
- Options service: `app/services/importer/runOptions.server.ts`
  - `parseRunOptions()`
  - `startImportFromOptions()`
- Templates list: `app/loaders/templates.server.ts::listTemplates`
- Summary storage: `writeOptionsToRun()` updates `ImportRun.summary.options`

2. Pre-scan / discovery (list URLs)

- Engine: `packages/importer/src/crawlers/batsonCrawler.ts`
  - Same-host guard, list-page asset blocking, `maxConcurrency` (2–3), jitter (≈250–600 ms)
  - Anchor discovery, pagination follow, sitemap fallback for sparse collections
  - Discovered URLs are upserted via `upsertProductSource()`
- UI subset selection
  - Today: paste explicit subset into “Manual URLs” in New/Edit Run
  - Future: optional checkbox picker (see Next steps)

3. Template selection

- UI: New/Edit Run selects `templateKey` (default saved in localStorage)
- Extractor: `packages/importer/src/extractors/batson.parse.ts`
  - Calls `src/importer/extract/applyTemplate.ts` to compute `usedTemplateKey`
  - Fallback cascade remains primary data source
- Preview chip shows `Template: …` from `usedTemplateKey` or selection
  - Routes: `app/routes/app.admin.import.preview*.tsx`

4. Crawl

- `PlaywrightCrawler` in `packages/importer/src/crawlers/batsonCrawler.ts`
  - Polite settings, abort third-party, block heavy assets on list pages

5. Extract

- JSON-LD first: `packages/importer/src/extractors/jsonld.ts`
- DOM/fallbacks: `slugFromPath`, `hash` in `src/importer/extract/fallbacks.ts`
- Returns canonical record + optional `usedTemplateKey`

6. Normalize & Validate

- Normalize: `packages/importer/src/pipelines/normalize.ts`
- Apply normalization (sets `normSpecs` + new hash): `applyNormalizationToStaging.ts`
- Validate: `packages/importer/src/pipelines/validate.ts`
- Preview shows warning if required fields missing

7. Stage + Diff

- Stage (idempotent): `packages/importer/src/staging/upsert.ts`
- Diff staged vs canonical: `packages/importer/src/pipelines/diff.ts`
- Run-scoped diffs and counts: functions in `runOptions.server.ts`
- Skip-successful integration: `packages/importer/src/pipelines/diffWithSkip.ts`

8. Review in Admin

- Runs index: `app/routes/app.admin.import.runs._index.tsx`
- Run detail (Adds/Changes/Conflicts/Deletes): `app/routes/app.admin.import.runs.$runId.tsx`
- Bulk approve adds and per-row resolution supported

9. Apply to Shopify

- Action route: `app/routes/app.admin.import.apply-run.tsx`
- Sync logic: `packages/importer/src/sync/shopify.ts`
  - Idempotent create/update, metafields (rbp namespace), images (source URL dedupe)
  - `deleteOverride` archives + marks for deletion

10. Post-run refresh

- Job: `packages/importer/src/jobs/priceAvail.ts` (cookie jar + price-only diff)

## Tests

- Template flow
  - `tests/importer/runOptions.server.unit.test.ts`: parses `templateKey`, forwards to crawler
  - `tests/importer/applyTemplate.unit.test.ts`: `usedTemplateKey` and autodetection
- Fallbacks
  - `tests/importer/fallbacks.unit.test.ts`: `slugFromPath` and `hash`
- Apply to Shopify harness
  - `tests/importer/applyRun.server.unit.test.ts`

Run:

```bash
npm run -s test:unit
```

## Troubleshooting checklist

- Template selected and chip appears in Preview
- `externalId` present (jsonld → dom → slug → hash)
- 403/429 or bot protection: lower concurrency (2–3), ensure jitter, block assets on list pages
- List URL but 0 items: confirm pagination anchors and same-host guard; seeds recorded in `productSource`
- Subset selection: use Manual URLs when starting run

## Handy commands

- Typecheck + build

```bash
npm run -s typecheck && npm run -s build
```

- Smoke crawl (set one or more seeds)

```bash
BATSON_SEEDS="https://batsonenterprises.com/collections/blanks" npm run -s importer:smoke
```

- Normalize + diff

```bash
npm run -s importer:diff
```

## Gaps and next steps

- Optional Pre-scan UI to choose subset from discovered URLs (persist into `manualUrls`)
- Server action to persist selector edits from Preview into YAML templates under `src/importer/extract/templates/`
- Make validation a gate for bulk approval (prevent Approve All if required fields missing)

---

Last updated: keep this doc synced when changing importer flows, UI routes, or package paths.
