# Design Studio v1 Plan · 2025 Edition

_Last updated: 2025-12-11_

## 1. Vision & Guiding Goals

- Deliver a guided rod-build workflow that keeps merchants inside a curated experience while sourcing authoritative catalog data from product_db.
- Treat importer automation as the source of truth: every DS-ready SKU now ships with roles, readiness flags, compatibility payloads, hero imagery, and ProductVersion pointers.
- Provide operations with auditable DesignBuild records (drafts → approvals → fulfillment) plus telemetry for SLA tracking and phased rollouts.
- Ensure storefront + admin experiences consume the same `/api/design-studio` stack behind the PRODUCT_DB_ENABLED and DESIGN_STUDIO_V1 feature gates.

## 2. Phase Map (A–E)

| Phase                                         | Status      | Focus                                                                                               |
| --------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| **A. Data Foundations**                       | ✅ Complete | Step 6/7 importer work, ProductVersion stability, `/api/design-studio/options` backed by product_db |
| **B. Step 8 — UI Loader & Draft Persistence** | 🚧 Active   | Replace mocks with live loaders, persist drafts, enforce compatibility filtering                    |
| **C. Prisma Migration for DS Models**         | 📝 Planned  | DesignBuild / DesignBuildDraft / DesignBuildEvent schema aligned with real DS roles                 |
| **D. Backfills for DS & Storefront**          | 📝 Planned  | Run refreshed backfills + diagnostics on top of the stable product_db foundation                    |
| **E. Admin & Storefront Deliverables**        | 📝 Planned  | Finish admin timeline/export, storefront wizard, fulfillment automation, launch enablement          |

The sections below expand on each phase.

## 3. Phase A — Data Foundations (Complete)

**Highlights**

- Step 6 (Batson core categories) and Step 7 (Batson secondary categories: reel seats, grips, end caps/gimbals, trim) are fully implemented. Evidence lives in `docs/importer/batson-step6-evidence-2025-12-10.md` and the Step 7 plan.
- Importer emits normalized `designStudioRole`, readiness flags, compatibility payloads, MSRP, hero imagery, and hashed version snapshots for every DS-ready SKU.
- `Product.latestVersionId` pointers are backfilled; `applyBatsonProducts` now writes Product + ProductVersion rows without gaps.
- `/api/design-studio/options` returns real product_db data for every Batson role when PRODUCT_DB_ENABLED=1 and DESIGN_STUDIO_V1=1.
- Diagnostics scripts (`reapplyBatsonBlanks.ts`, `dumpDesignStudioOptions.ts`, SQL snippets) have been exercised across every role and captured in evidence docs.

**Outcome**: All upstream data blockers are cleared. Remaining work focuses on consuming that data in the UI, persistence, and workflows.

## 4. Phase B — Step 8: UI Loader + Draft Persistence (Active)

Goal: Replace mocked storefront/admin hooks with real data, enforce compatibility filtering, and persist draft builds.

### B1. Replace mocked builder hooks

- Point `/apps/proxy/design` (and any helper hooks) at `/api/design-studio/options` + `/api/design-studio/config`.
- Map DS roles to builder panels explicitly:
  - `BLANK` → Blank selector
  - `HANDLE` → Grip/handle panel
  - `REEL_SEAT` → Reel seat panel
  - `GUIDE`, `TIP_TOP`, `BUTT_CAP`, `COMPONENT` → accessory panels
- Ensure loader caching honors PRODUCT_DB gating plus tenant tier logic.

### B2. Persist build drafts server-side

- Introduce temporary draft storage (SQLite/Redis/etc.) keyed by tenant/shop/session until Phase C migrations land.
- Capture selections, validation state, compatibility warnings, and user context.
- Expose a draft recovery endpoint so customers resume builds seamlessly.

### B3. Validation & filtering

- Use ProductVersion `designStudioCompatibility` payloads (ID/OD/length, finish tags, category arrays) to gate available parts.
- Add client + server validation for incompatible stacks; surface actionable errors.
- Emit telemetry for validation failures to feed later analytics.

### B4. Error handling & resilience

- Implement retry/backoff for loader fetches; present friendly UI when `/api/design-studio/options` is unreachable.
- Log draft save failures with tenant/shop payload hashes for debugging.

**Exit criteria**: Storefront wizard (still gated) reads real options, filters by compatibility, and safely stores/restores drafts without mock code paths.

## 5. Phase C — Prisma Migration for DS Models

With real usage patterns in hand, land the long-lived schema.

### C1. Schema design

- Models: `DesignBuild`, `DesignBuildDraft`, `DesignBuildEvent`, `DesignBuildAttachment` (if required), along with existing tenant tier fields.
- Enums: `DesignStudioRole`, `DesignBuildStatus`, `DesignBuildFulfillmentMode`, `DesignBuildEventType`. Roles must mirror the importer/product_db set documented in the appendix.
- Fields: compatibility hashes, submission metadata, SLA timestamps, assigned builder, webhook flags, attachment references.

### C2. Migration execution

- Author migration(s) and run `prisma migrate dev` locally; promote to staging/prod after typecheck/build verification and Fly deploy steps.
- Regenerate Prisma Client, update Remix loaders/services, and document the workflow.

### C3. Seeding & fallback

- Update `scripts/dev/seedDesignStudioSamples.ts` and tenant seeds to create sample DesignBuild rows.
- Backfill any Phase B drafts into the new tables once migrations land.

**Exit criteria**: Schema + generated clients are merged, and CRUD plumbing exists for later phases.

## 6. Phase D — Backfills for DS & Storefront

Codify a repeatable playbook now that the foundation is stable.

### D1. Command sequence

1. `npm run -s db:backfill:design-studio`
2. `npm run -s db:backfill:design-storefront`
3. Targeted reapply via `DATABASE_URL=... TARGET_CATEGORY=... npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts`
4. Snapshot `/api/design-studio/options` payloads with `DESIGN_STUDIO_V1=1 PRODUCT_DB_ENABLED=1 npx tsx scripts/diagnostics/dumpDesignStudioOptions.ts <roles>`

### D2. Acceptance expectations

- All Batson roles return non-zero counts via `/api/design-studio/options`.
- `designStudioReady` and `latestVersionId` remain in sync after each run.
- Evidence docs only change when new roles/categories are enabled or regressions are captured.

## 7. Phase E — Admin & Storefront Deliverables

### E1. Admin (legacy "Phase 1")

- Persist `DesignBuildEvent` timeline entries for every admin action.
- Wire export-to-S3 button leveraging the existing export helper, capturing JSON + attachments.

### E2. Storefront Wizard (legacy "Phase 2")

- Finish React wizard (Baseline → Blank → Components → Review) using live data.
- POST endpoint creates `DesignBuild`, associates draft selections, and dispatches confirmation emails.
- Store inspiration uploads in S3 via `DesignBuildAttachment` references.
- Instrument drop-off + submission metrics and cover Starter/Plus flows with Playwright.

### E3. Fulfillment & Ops (legacy "Phase 3")

- Automate status transitions with SLA timers.
- Emit Slack notifications for `review` + `approved` actions and expose Enterprise webhooks with signatures.
- Schedule cron/reporting for SLA breaches and importer freshness.
- Support multi-location fulfillment metadata and validation rules.

### E4. Launch & Enablement (legacy "Phase 4")

- Publish KPI dashboards (Looker/Metabase), tenant enablement guides, Loom walkthroughs, and pilot checklists.
- Update support runbooks, escalation paths, marketing copy, and storefront block documentation.

## 8. Immediate Next Steps (Dec 2025)

1. **Canonical role confirmation** – lock DS role enum names (see appendix) and ensure importer, product_db, forthcoming Prisma migrations, and UI all reference the same values.
2. **Builder/UI alignment** – audit every builder panel and admin filter so each maps cleanly to the canonical role list; open issues for gaps before migrations.
3. **Step 8 schedule & execution** – plan and track sub-phases:
   - **8.1 Loader swap** – retire mock hooks and fetch `/api/design-studio/options` + `/api/design-studio/config` directly.
   - **8.2 Draft persistence & autosave** – implement server-side storage, recovery flows, and validation/error telemetry.
   - **8.3 Compatibility filtering** – enforce `designStudioCompatibility` gating in both UI and API handlers.

- **8.x Manual validation + telemetry loop (2025-12-11)** – Local sqlite refreshed via `seedDesignStudioSamples`, `backfill-design-studio`, and `backfill-design-storefront-products` (Batson). With `DATABASE_URL=file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite`, `DESIGN_STUDIO_V1=1`, `PRODUCT_DB_ENABLED=1`, `SHOP_DOMAIN=core-sandbox.myshopify.com`, the diagnostics script now returns real options (4 blanks, 2 handles, 1 reel seat, 1 tip top, 2 components/accessories; guides pending) and emits `designStudio.storefront.options` telemetry for empty guide sets.

4. **Migration prep** – finalize the DesignBuild/DesignBuildDraft/Event schema proposal, circulate for review, and scaffold Prisma migrations.
5. **Regression + diagnostics bundle** – rerun `npm run -s typecheck && npm run -s build`, targeted importer diagnostics, and `/api/design-studio/options` snapshots after each Step 8 sub-phase to ensure product_db → options filtering remains intact.

## 9. Risks & Mitigations

| Risk                                | Mitigation                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| Loader ↔ API drift                 | Contract tests comparing `/api/design-studio/options` schema to storefront expectations.       |
| Draft persistence before migrations | Temporary storage abstraction with migration plan to backfill into Prisma tables later.        |
| Compatibility regressions           | Maintain diagnostics scripts + evidence docs; add unit tests asserting payload shape per role. |
| Tenant-tier confusion               | Centralize gating in `getDesignStudioAccess`; document the tier matrix in sandbox tenant docs. |

## 10. Timeline Snapshot

| Month        | Milestone                                                       |
| ------------ | --------------------------------------------------------------- |
| Dec 2025     | Phase B Step 8 implementation (live loaders, draft persistence) |
| Jan 2026     | Phase C migrations authored + applied; draft data backfilled    |
| Feb 2026     | Phase D backfill cadence finalized; Phase E1–E2 features active |
| Mar–Apr 2026 | Phase E3 fulfillment automation + analytics; pilot enablement   |

## 11. Role Reference

- `BLANK` – Rainshadow blanks with length/power/action compatibility.
- `HANDLE` – Fore/rear grips with ID/OD/length metadata.
- `REEL_SEAT` – Seats with bore, length, finish, and orientation.
- `GUIDE` / `TIP_TOP` – Guide sets + tip tops with ring/tube sizes.
- `BUTT_CAP` – End caps & gimbals (ID/OD/depth).
- `COMPONENT` – Trim pieces, hook keepers, miscellaneous accessories.

## 12. Summary

The 2025 edition confirms the importer + product_db foundations are done. Focus now shifts to Step 8 (live loaders + draft persistence), Prisma migrations, refreshed backfills, and the admin/storefront deliverables that take Design Studio V1 to launch.

## Addendum: Acceptance Criteria, Risks, Dependencies, and Role Definitions

### A. Acceptance Criteria (Per Phase)

**Phase A — Data Foundations (Completed)**

- All Batson categories normalized: blank, guide, tip-top, reel seat, grip, butt-cap/gimbal, trim.
- `designStudioReady`, `designStudioRole`, and compatibility payloads emitted consistently.
- ProductVersion hashing and `latestVersionId` pointers stable for all DS-ready SKUs.
- `/api/design-studio/options` returns real product_db-backed data for all roles.
- Evidence docs contain diagnostic proof per category.

**Phase B — Step 8: UI Loader + Draft Persistence (Active)**

- All pickers load real options from `/api/design-studio/options`.
- No mock data or staging-table paths remain.
- Drafts persist to `DesignBuildDraft` automatically and reload successfully.
- Compatibility filtering enforced in UI based on `designStudioCompatibility` payloads.
- Builder supports full rod configuration using product_db data.
- Error handling & telemetry in place.

**Phase C — Prisma Migration**

- `DesignBuild`, `DesignBuildDraft`, `DesignBuildEvent` tables implemented.
- DS role enums finalized and referenced consistently.
- Migration applies cleanly across environments.

**Phase D — Backfills**

- `db:backfill:design-studio` and `db:backfill:design-storefront` populate DS tables correctly.
- Snapshot metrics logged and validated.

**Phase E — Admin + Storefront Delivery**

- Admin logs `DesignBuildEvent` actions.
- S3 export functional.
- Storefront wizard functional end-to-end.
- Fulfillment notifications & webhooks operational.
- Launch enablement (analytics, pilot guides, support playbooks) complete.

### B. Risks and Safeguards

| Risk                         | Impact                     | Safeguard                                   |
| ---------------------------- | -------------------------- | ------------------------------------------- |
| UI expecting old roles       | Picker breakage            | Canonical role registry + loader assertions |
| Supplier adds new roles      | Enum or schema drift       | Centralized enums + contract tests          |
| Hash drift in ProductVersion | Duplicate versions         | Hash stability tests                        |
| Compatibility mismatches     | Incorrect builds           | Compatibility contract tests                |
| Migration breaks envs        | Schema drift               | Migration dry-run + backups                 |
| Mock data left in code       | Inconsistent behavior      | Preflight check: "no mock DS data"          |
| SKU collisions               | Incorrect product identity | `supplierSlug + supplierSku` as unique pair |

### C. Phase Dependencies Map

- **A → B**: UI loader relies on stable product_db + roles.
- **B → C**: Migration schema must follow finalized loader + draft requirements.
- **C → D**: Backfills depend on the stabilized DS schema.
- **D → E**: Admin/storefront features require populated DS tables.
- Order: A (done) → B (active) → C → D → E → Launch.

### D. Canonical DS Role Appendix (2025 Edition)

Use these enum values across importer, product_db, Prisma, API, and UI:

```
enum DesignStudioRole {
  BLANK
  GUIDE
  TIP_TOP
  REEL_SEAT
  HANDLE
  BUTT_CAP
  COMPONENT
}
```

| Category          | Role      | Notes                          |
| ----------------- | --------- | ------------------------------ |
| Blank             | BLANK     | Basic rod attributes           |
| Guide             | GUIDE     | Frame & ring specs             |
| Tip Top           | TIP_TOP   | Tube and ring sizes            |
| Reel Seat         | REEL_SEAT | ID, model, material            |
| Grip              | HANDLE    | ID/OD, length, position        |
| Butt Cap / Gimbal | BUTT_CAP  | OD/ID, style                   |
| Trim              | COMPONENT | Decorative rings, hook keepers |
