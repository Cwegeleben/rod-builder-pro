# Design Studio v1.0 Plan

_Last updated: 2025-11-26_

## 1. Goals

- Give merchants a guided experience for configuring rod builds and collecting required fulfillment data without exposing raw supplier catalogs.
- Ensure importer automation (Batson + future suppliers) pre-classifies blanks/components so Design Studio can stay data-light.
- Provide operations with an auditable "design build" workflow so fulfillment can be split between Rainshadow (RBP) and the upstream supplier when needed.

## 2. Scope Guardrails for v1

- Deliverable is a **single-brand storefront app block** rendered through the Shopify app proxy. Embedded PDP, cart, or checkout changes are out of scope.
- Admin work limits to Polaris pages in `/app/design-studio` and `/app/builds` plus minor grid enhancements on `/app/products`.
- No real-time collaboration, payments, or 3D preview in v1. Capture intent, specs, and notes; fulfillment continues outside Shopify.

## 3. Data & Importer Automation

- Extend importer normalization to stamp `designStudio.family`, `designStudio.series`, and `designStudio.role` for each SKU. Default heuristics: blanks auto-map via supplier series → lineup, components follow category taxonomy.
- Auto-generate `designStudio.compatibility` sets (e.g., length/power/action, finish, grip options) so the storefront wizard can cross-filter components without custom logic.
- Capture readiness metadata per SKU: `dsReady:boolean`, `coverageNotes`, `sourceQuality`. These feed gating rules inside admin queue.
- Part staging table already tracks variant deltas; add `designStudioHash` to detect importer changes that require admin review.

## 4. Tenant Tiering & Feature Flags

- **Starter**: read-only marketing module, no custom builds.
- **Core**: access to wizard with limited palette (RBP curated families only).
- **Plus**: unlock supplier dropship mode, saved builds list, export to CSV/PDF.
- **Enterprise**: multi-location fulfillment routing, custom approval SLA targets, webhook callbacks.
- Tier is persisted on `TenantSettings.designStudioTier`; feature checks live in remix loaders.
- Sandbox tenants for Starter/Core/Plus are defined in `app/lib/designStudio/tenantSeeds.ts` and can be applied with `pnpm tsx scripts/dev/seedDesignStudioTenants.ts` (see `docs/design/design-studio-sandbox-tenants.md`).
- Global flag `DESIGN_STUDIO_V1` must be enabled before loaders consult tenant tiers; `app/lib/designStudio/access.server.ts` centralizes the guard so `/app/design-studio` and `/app/products` only surface DS UI for approved tenants.

## 5. Fulfillment & Production Modes

- Two fulfillment archetypes per build:
  - `RBP_BUILD`: Rainshadow fabricates end-to-end.
  - `SUPPLIER_BUILD`: Supplier finishes build; RBP tracks state only.
- Build status pipeline: `draft → review → approved → scheduled → in_progress → fulfilled → archived` with `blocked` overlay for compliance issues.
- Additional metadata: promised ship week, assigned builder, BOM hash, and audit trail entries.

## 6. Admin Experience

### `/app/design-studio`

- Dashboard tiles: active builds, SLA breaches, importer freshness (last Batson sync vs expected).
- Data grids:
  - **Families** tab: fields `Family`, `Tier`, `Fulfillment mode default`, `Coverage score`, `Last importer update` (now wired to canonical stats via `loadDesignStudioFamilyStats`).
  - **Components** tab: filter by role (blank, grip, guide set, accessories) and readiness state.
- Inline actions: mark SKU as DS-ready, attach coverage note, recalc compatibility hash.
- Overview tab (implemented in `/app/design-studio`) surfaces tenant tier, feature flags, DS ready/needs-review counts, top families, and deep links back into `/app/products` via `app/lib/designStudio/metrics.server.ts`.

### `/app/builds`

- Queue view grouped by status, showing customer, tier, fulfillment mode, promised week, and gating warnings.
- Build detail drawer: BOM summary, customer selections, chat-style notes, and action buttons (`Approve`, `Request edits`, `Schedule production`).
- Export button to drop structured JSON into the operations S3 bucket (re-uses existing export helper).

### `/app/products` Enhancements

- Add columns for `Design Studio Ready`, `Family`, `Last DS touch` to help sourcing review importer output quickly.

## 7. Storefront UX (App Proxy)

- Single wizard split into four steps:
  1. **Baseline**: choose use case + experience level; map to recommended families.
  2. **Blank Selection**: surface curated blanks with compatibility badges; disable SKUs flagged non-ready.
  3. **Components**: grouped cards for grips, reel seats, guides, accessories. Filters derive from importer compatibility sets.
  4. **Review & Submit**: capture contact details, store-specific fields (PO ref, budget ceiling), fulfillment preference, and optional inspiration photos.
- Submission success page shows reference number and SLA promise; email confirmation uses existing transactional service with new template.

## 8. APIs & Backend Contracts

- **GET /api/design-studio/config**: returns tenant tier, curated families/components, localization strings, and SLA copy.
- **POST /api/design-studio/builds**: validates payload, persists `DesignBuild`, triggers Slack/webhook notification, returns build token.
- **PATCH /api/design-studio/builds/:id**: admin-only updates for status changes and fulfillment scheduling.
- **Webhooks** (Enterprise): optional callback when status transitions to `approved`, `scheduled`, `fulfilled`.

## 9. Deployment, Telemetry, & Rollout

- Feature flag `designStudio.v1` gates the storefront block and admin routes.
- Metrics to emit: wizard drop-off per step, build creation count per tier, approval SLA breach count, importer freshness (hours).
- Rollout order: Stage tenants internally → one pilot Plus tenant → general availability for Core/Plus → Enterprise unlock with webhook validation.

## 10. Build Phases

1. **Phase 0 – Data Foundations**: schema updates (`DesignBuild`, `DesignBuildEvent`, tenant settings fields), importer annotations, and `/app/products` visibility tweaks.
2. **Phase 1 – Admin Surfaces**: `/app/design-studio` dashboard, `/app/builds` queue + detail drawer, export hook wiring.
3. **Phase 2 – Storefront Wizard**: app proxy endpoint + Remix loader, React wizard with tier gating, API integration.
4. **Phase 3 – Fulfillment & Ops**: status automation, Slack/webhook emitters, SLA tracking jobs.
5. **Phase 4 – Polish & Launch**: telemetry dashboards, marketing assets, documentation, and tenant enablement checklists.

## 11. Open Questions

- Do we need per-tenant overrides for supplier-finishing eligibility or can it stay global?
- Should Enterprise tenants push builds directly into NetSuite via existing integrations or through a new webhook consumer?
- Are photo uploads stored in Shopify Files or S3? (leaning S3 for consistency with importer artifacts.)

## 12. Immediate Next Steps

1. Draft the Phase 0 Prisma migration (models + enums) and confirm with a `prisma migrate dev` dry run.
2. Extend the importer normalization pipeline (packages/importer + shared libraries) to emit the new `designStudio.*` fields and hashes.
3. Backfill Batson SKU metadata using the importer snapshot tooling, capturing before/after metrics in `docs/importer/`.
4. Add the `/app/products` table columns + filters so sourcing can validate importer output quickly.
5. Stand up the `designStudio.v1` feature flag + tenant tier setting to safely gate downstream UI work.
