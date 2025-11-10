# @shopify/shopify-app-template-remix

## [Unreleased]

### Importer Reliability (v2.3+)

- Isolation & hashing baseline: template partitioning, composite unique index on PartStaging (`supplierId, templateId, externalId`), seed hashing, publish guard + diagnostics, prepare diagnostics, and cast cleanup.
- Approvals: Approve Adds (with `?all`) and Approve All multi-type endpoints; totals + ImportLog telemetry; smoke-mode banner with disabled toasts.
- Review UX: Sticky summary bar, skeleton on hydration, selection enablement, disabled-reason tooltip for Publish, aria-live announcements, metrics badge (C/U/S/F), conflict hint panel with jump-to-tab.
- Recrawl + Publish: Orchestrator prepare → wait → approve adds → optional publish; returns goal + publish totals; guards (prepare/publish in-progress), rate limit, lifecycle logs.
- Publish update existing: Adjusted updated totals excluding hash-unchanged backfill cases; detailed buckets; added unit tests.
- Verify: "Verify on Shopify" link wired to admin product search by tag from publish response.
- Data model audit: Aligned raw DB bootstrap to Prisma (added templateId column and composite unique index) with upgrade path.
- Hash correctness: Ensured `rbp.hash` is written on create/update and dropped if empty via sanitization; unit test added.

### Tests & Tooling

- Unit: Added suites for recrawl guard codes, delete dry-run/guards, publish totals adjustment, and `rbp.hash` presence/sanitization.
- E2E: Kept imports isolation/queueing specs passing; new UI coverage for toasts and sticky summary bar deferred to next iteration.

### Fixed / Operations

- Resolved failed Prisma migration `20251006062503_reset_with_template_version` by marking it rolled back in production and replacing its contents with a documented no-op placeholder to preserve ordering.
- Aligned `TemplateVersion.dataJson` field type back to `String` in schema to match production; future upgrade to `Json` will be delivered via a forward-only migration.
- Reset local dev DB to eliminate drift and ensure clean migration history after placeholder insertion.
- Hardened production config for Importer v2.3 rollout:
  - Moved `DATABASE_URL` and `SMOKE_TOKEN` from Fly app env to Fly secrets; removed from `fly.production.toml`.
  - Set `ALLOW_HQ_OVERRIDE=0` in production (disable URL/cookie/header HQ override).
  - Kept health checks and Remix server binding unchanged.

### Importer v2.3

- Imports page: Restored Import Logs as a flat Polaris IndexTable with filters (Type, Import, Run, Past, Query), SSE live updates, Refresh, pagination (Load older), and dedupe; removed Recent Runs.
- Import List: Sorted by most recent activity (preparing.start or lastRunAt); simplified actions with inline schedule toggle and link to last run.
- Tests: Added integration tests for Import Logs (empty state, refresh, merge/dedupe, load older, combined filters, live SSE) and new coverage ensuring Past filter + Load older include `since`.
- E2E: Stabilized imports progress/queueing/save-and-crawl specs with accessible selectors and URL assertions.
- UX polish: Persist filters in the URL (read on mount, write on change), added "Copy run link" action with success toast in both table and fallback views, and disabled "Load older" when loading or without a valid cursor.

### Tooling

- Added `npm run validate:templateversion-json` to audit JSON validity before future column type conversion.

### Follow-ups

- Create new migration to convert `TemplateVersion.dataJson` to JSON with data copy + verification.

## 2025.01.31

- [#952](https://github.com/Shopify/shopify-app-template-remix/pull/952) Update to Shopify App API v2025-01

## 2025.01.23

- [#923](https://github.com/Shopify/shopify-app-template-remix/pull/923) Update `@shopify/shopify-app-session-storage-prisma` to v6.0.0

## 2025.01.8

- [#923](https://github.com/Shopify/shopify-app-template-remix/pull/923) Enable GraphQL autocomplete for Javascript

## 2024.12.19

- [#904](https://github.com/Shopify/shopify-app-template-remix/pull/904) bump `@shopify/app-bridge-react` to latest
-

## 2024.12.18

- [875](https://github.com/Shopify/shopify-app-template-remix/pull/875) Add Scopes Update Webhook

## 2024.12.05

- [#910](https://github.com/Shopify/shopify-app-template-remix/pull/910) Install `openssl` in Docker image to fix Prisma (see [#25817](https://github.com/prisma/prisma/issues/25817#issuecomment-2538544254))
- [#907](https://github.com/Shopify/shopify-app-template-remix/pull/907) Move `@remix-run/fs-routes` to `dependencies` to fix Docker image build
- [#899](https://github.com/Shopify/shopify-app-template-remix/pull/899) Disable v3_singleFetch flag
- [#898](https://github.com/Shopify/shopify-app-template-remix/pull/898) Enable the `removeRest` future flag so new apps aren't tempted to use the REST Admin API.

## 2024.12.04

- [#891](https://github.com/Shopify/shopify-app-template-remix/pull/891) Enable remix future flags.
-

## 2024.11.26

- [888](https://github.com/Shopify/shopify-app-template-remix/pull/888) Update restResources version to 2024-10

## 2024.11.06

- [881](https://github.com/Shopify/shopify-app-template-remix/pull/881) Update to the productCreate mutation to use the new ProductCreateInput type

## 2024.10.29

- [876](https://github.com/Shopify/shopify-app-template-remix/pull/876) Update shopify-app-remix to v3.4.0 and shopify-app-session-storage-prisma to v5.1.5

## 2024.10.02

- [863](https://github.com/Shopify/shopify-app-template-remix/pull/863) Update to Shopify App API v2024-10 and shopify-app-remix v3.3.2

## 2024.09.18

- [850](https://github.com/Shopify/shopify-app-template-remix/pull/850) Removed "~" import alias

## 2024.09.17

- [842](https://github.com/Shopify/shopify-app-template-remix/pull/842) Move webhook processing to individual routes

## 2024.08.19

Replaced deprecated `productVariantUpdate` with `productVariantsBulkUpdate`

## v2024.08.06

Allow `SHOP_REDACT` webhook to process without admin context

## v2024.07.16

Started tracking changes and releases using calver
