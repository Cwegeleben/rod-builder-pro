# Design Studio v1.0 Execution Checklists

Use these phase checklists to plan and track implementation. Items marked with `(*)` block later phases.

## Phase 0 – Data Foundations

- [x] (\*) Add Prisma models: `DesignBuild`, `DesignBuildEvent`, `DesignBuildAttachment`, tenant tier fields, and SKU readiness flags.
- [x] Generate + apply migrations across dev/staging/prod; update `schema.prisma` docs.
- [x] Extend importer normalization to output `designStudio.family`, `series`, `role`, `compatibility`, and readiness flags.
- [x] Backfill legacy Batson data with new fields; snapshot before/after for validation.
- [x] Surface new columns (`DS Ready`, `Family`, `Last DS touch`) on `/app/products` table with filters.
- [x] Add audit logging for importer → DS annotations (hash + timestamp).
- [x] Draft seed data for sandbox tenants covering Starter/Core/Plus (`scripts/dev/seedDesignStudioTenants.ts`).

## Phase 1 – Admin Surfaces

- [x] Build `/app/design-studio` dashboard route with tiles + tabbed grids.
- [x] Implement actions to toggle DS readiness, edit coverage notes, recalc compatibility hash.
- [x] Build `/app/builds` queue with status grouping, search, and tier filters.
- [x] Create build detail drawer w/ BOM summary, fulfillment metadata, action buttons.
- [ ] Persist build timeline entries (`DesignBuildEvent`) for each admin action.
- [ ] Wire export-to-S3 button using existing export helper.
- [x] Gate routes behind `designStudio.v1` flag + tenant tier checks (`app/routes/app.products._index.tsx`, `/app/design-studio`).

## Phase 2 – Storefront Wizard

- [ ] Create proxy route + loader for `/apps/design-studio` with GET config API.
- [ ] Implement React wizard (Step 1–4) with tier-based features and compatibility filters.
- [ ] Hook POST endpoint to create `DesignBuild`, send confirmation email, and return reference number.
- [ ] Store optional inspiration photos in S3 and link attachments.
- [ ] Add metrics instrumentation (step drop-off, submission count).
- [ ] Write E2E Playwright flow covering Starter (read-only) and Plus (full wizard).

## Phase 3 – Fulfillment & Ops

- [ ] Implement status automation + SLA timers (review, approved, scheduled, fulfilled).
- [ ] Send Slack notifications on `review` + `approved` transitions; include quick links.
- [ ] Add optional webhooks for Enterprise tenants with signature validation.
- [ ] Build cron job/report for SLA breaches and importer freshness.
- [ ] Support multi-location fulfillment metadata and validation rules.

## Phase 4 – Launch & Enablement

- [ ] Build Looker/Metabase dashboard for KPIs (submissions, drop-off, SLA).
- [ ] Create tenant enablement guide + Loom walk-through linked from docs.
- [ ] Pilot enablement checklist (internal → pilot tenant → GA) with sign-offs.
- [ ] Update support runbooks and escalation paths.
- [ ] Finalize marketing copy + storefront block documentation.
