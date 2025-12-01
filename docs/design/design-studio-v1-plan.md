# Design Studio v1.0 Plan

_Last updated: 2025-11-27_

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
- Ship a repeatable backfill so annotated staging rows land in the canonical Product tables. Run `npm run -s db:backfill:design-storefront` (script: `scripts/migrate/backfill-design-storefront-products.ts`) to push ready PartStaging rows into `Product`/`ProductVersion` using the same heuristics; filters include `DESIGN_STUDIO_SUPPLIERS`, `DESIGN_STUDIO_SKUS`, `DESIGN_STUDIO_BACKFILL_BATCH`, and `DESIGN_STUDIO_INCLUDE_REVIEW`. Pair it with `npm run -s db:backfill:design-studio` when you need to re-derive `designStudio.*` metadata for PartStaging/Product rows.
- **Importer data assurance plan** (weekly sync safety net):
  1. **Declare schema contract** – list every attribute the component table depends on (e.g., `designStudio.family`, `designStudio.series`, `designStudio.role`, readiness flags, compatibility sets, coverage notes, hashes) and keep it versioned in this doc plus the loader typings.
  2. **Audit normalization** – confirm each attribute is produced inside `packages/importer` + `app/services/importer/runOptions.server.ts` before PartStaging writes; add unit tests if a field is only implied.
  3. **Persist canonically** – ensure `app/services/productDbWriter.server.ts` stores the fields on `Product`/`ProductVersion` (or DS-specific tables). Add Prisma migrations for any missing columns.
  4. **Run dual backfills** – execute `npm run -s db:backfill:design-studio` followed by `npm run -s db:backfill:design-storefront` after schema/code changes to realign staging + Product DB; log before/after metrics in `docs/importer/`.
  5. **Surface + verify** – update `/app/products` loaders/columns to read the canonical DS attributes, then cover them with Playwright + Vitest checks so regressions fail fast.
  6. **Regression guardrail** – include an importer smoke (e.g., `npm run -s importer:smoke`) plus snapshot assertions that a representative SKU retains the DS fields after a full run; wire into CI once stable.
  7. **Verification snapshot (2025-11-28)** – Seeded 4 representative Batson SKUs via `npm run db:seed:design-studio-samples` (defaults to `file:./prisma/dev.sqlite`), executed both backfills, and captured metrics with `npm run diagnostics:design-studio` (see summary below). Ready count now >0, confirming the helper + product writer pathway with real rows instead of an empty DB. Re-run this block whenever importer heuristics change.

```
Design Studio Metrics (2025-11-28)
Products: 8 (all ready)
Roles: blank x4, reel_seat x1, handle x1, guide_set x1, component x1
Coverage gaps: missing family 0, needs review 0
```

### Current baseline (2025-11-28)

- Database: `file:./.tmp/importer-smoke-dev.sqlite` (physical file `prisma/.tmp/importer-smoke-dev.sqlite`)
- Products: 8 total, ProductVersions: 8 total
- Ready split: `designStudioReady=true` → 8, `needs-review` → 0
- Per-supplier: Batson (slug `batson`) → 8 products
- Roles: blanks 4, reel seats 1, handle/grip 1, guide sets 1, accessories/components 1
- Coverage gaps: missing family 0, needs review 0
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

### Phase 2.0 storefront shell (2025-11-27)

- `/apps/proxy/design` now renders the mocked wizard shell behind `DESIGN_STUDIO_V1` + tenant gating. Loader lives in `app/routes/apps.proxy.design.tsx` and reuses `getDesignStudioAccess` so tenants without DS enabled still see the lock screen.
- Mock config + component inventory are centralized in `app/lib/designStudio/storefront.mock.ts`, with React hooks (`app/hooks/useDesignStorefront.ts`) standing in for the future `/api/design-studio/config` + `/api/design-studio/options` endpoints.
- Selector UI ships with Polaris primitives only (no Frame) plus Tailwind utility wrappers so it is proxy-safe. Build drawer supports desktop (side card) and mobile (bottom sheet) layouts; selections auto-open the drawer.
- Smoke coverage now lives in `tests/e2e/design.storefront.proxy.inline.spec.ts`, and the Remix loader is covered by `app/__tests__/apps.proxy.design.loader.test.ts` to ensure flag/tenant logic stays intact.

### Theme App Extension rollout (Theme Editor)

- Ship a Theme App Extension under `extensions/design-studio` with an app block such as `blocks/rbp-design-studio.liquid` that renders an iframe pointing to `/apps/proxy/design?shop={{ shop.domain }}`. Block schema exposes merchant-facing settings (title copy, iframe height, optional background styles) so it drops cleanly into any theme section.
- Document merchant install + testing steps in `docs/design/design-studio-theme-extension.md` so onboarding can link a single guide.
- Update `shopify.app.*.toml` to register the extension and wire deployments through our existing Shopify CLI workflow. Bundle any required assets (lightweight CSS/JS for sizing) with the extension so merchants do not need to edit theme code manually.
- Harden the proxy route for theme loads: accept the Theme Editor’s signed query, validate HMAC or JWT to resolve shop context without an Admin session, and reuse tenant gating plus curated config. Issue a short-lived JWT per request so the iframe can call DS APIs securely.
- During OAuth install capture each shop’s Storefront API credentials, persist them, and update the wizard/server APIs to fetch products, variants, and build carts via that shop’s Storefront API token. Cart or checkout creation should return URLs scoped to the merchant’s domain so shoppers stay onsite.
- Document the end-to-end flow (install → add “Rod Design Studio” section → publish) and add automated tests covering theme iframe loads plus Storefront API fallbacks for shops missing tokens.

### Wizard steps

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

1. Wire `/apps/proxy/design` to real config + options APIs (replace the mock hooks once `/api/design-studio/config` + `/api/design-studio/options` land) and persist build drafts server-side.
2. Draft the Phase 0 Prisma migration (models + enums) and confirm with a `prisma migrate dev` dry run.
3. Extend the importer normalization pipeline (packages/importer + shared libraries) to emit the new `designStudio.*` fields and hashes.
4. Backfill Batson SKU metadata using the importer snapshot tooling, capturing before/after metrics in `docs/importer/`.
5. Add the `/app/products` table columns + filters so sourcing can validate importer output quickly.
6. Stand up the `designStudio.v1` feature flag + tenant tier setting to safely gate downstream UI work (flag exists; need rollout checklist per tenant).
