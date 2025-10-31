Design-Lock: importer-v2-3
Status: LOCKED until “Scaffold Install” checklist = DONE

Copilot Prompt — DESIGN v2.3: Unified Template-Import + State-Driven Imports Dashboard
Model: GPT-5
Scope tag: MODIFY (ADD where needed; non-breaking)
Sentinel family: importer-v2-3
App: admin.portal (embedded in Shopify Admin) 0) Decisions Locked
Templates never exist without Imports. Creating a Template = creating its Import (1:1).
Editing template fields is restricted while a run is active or scheduled. Allow override, but:
Automatically suspend schedule, set state to NEEDS_SETTINGS, and require re-validation on next save.
No separate Templates section in Admin. The Imports area is the single home for creating/editing Templates and operating Imports.
If a legacy Templates route exists, redirect to Imports → New Template or to the template’s Import Settings.
Delete Template is hard once validated/scheduled:
Require multi-step confirm: “suspend schedule → delete drafts for current run → confirm dependencies → delete.”

1. What’s Changing (High-Level)
   Add Import = Add Template. The “Add Import” button launches the Template wizard and auto-creates its Import config.
   Imports Home becomes the Template Import Dashboard with state-driven actions (Settings / Test / Review / Approve / Schedule / Delete-Reset), and a global Logs table below.
   Schedule moves to a dedicated page (/app/imports/:templateId/schedule).
   Settings still hosts Preview on the first URL; saving does not trigger review/test.
   Draft review is done in Shopify Products via filter (no duplicate review UI).
   Template edits during active/scheduled state force: suspend schedule + re-validate on save.
2. IA — Routes & Structure
   Routes
   Home / Imports → app/routes/app.imports.\_index.tsx
   Top table: Import List (one row per Template/Import).
   Bottom table: Global Log List (reverse chrono, filters).
   “Add Import” → /app/imports/new (Template Wizard).
   New Template Wizard → app/routes/app.imports.new.tsx
   Creates Template + bootstraps Import. Redirects to Settings.
   Import Settings (Template-scoped) → app/routes/app.imports.$templateId.tsx
Sections: General, Scrape & Mapping, Preview (no Review here).
Save = validate + state → READY_TO_TEST.
If settings changed while scheduled/approved: auto suspend schedule and state → NEEDS_SETTINGS.
Schedule Page → app/routes/app.imports.$templateId.schedule.tsx
   Frequency/time; shows next run; save updates state accordingly.
   (Optional) Legacy Redirect → any old /app/templates* routes → redirect here.
   Components (delta)
   ImportList.tsx — row with state pill + dynamic actions.
   ImportRowStateBadge.tsx — color/status mapping.
   GlobalLogList.tsx — template/run/type/date filters.
   Settings/* panels — Preview only; no Review CTA.
   ScheduleForm.tsx — dedicated schedule editor.
   ShopifyFilterLink.tsx — generates Products (Drafts) filtered by tag rbp-import:<runId>.
   ApproveAbortControls.tsx — Approve (publish) / Delete-Reset (safe cleanup).
3. States & Actions
   State Machine
   NEEDS_SETTINGS — template created or settings changed post-approval/schedule → must re-validate.
   READY_TO_TEST — settings valid; no drafts for current run.
   IN_TEST — test running (full scrape to drafts).
   READY_TO_APPROVE — drafts exist for runId; can Review/Approve/Delete-Reset.
   APPROVED — drafts published; ready to schedule.
   SCHEDULED — schedule enabled; runs use last approved config.
   ABORTED — drafts deleted; returns to READY_TO_TEST.
   FAILED — phase errored; Delete-Reset to recover.
   Home Row — Dynamic Buttons
   NEEDS_SETTINGS: Settings; Test disabled; hide Review/Approve/Schedule.
   READY_TO_TEST: Settings, Test; hide Review/Approve/Schedule.
   IN_TEST: progress banner; allow Delete-Reset if needed.
   READY_TO_APPROVE: Settings, Review, Approve, Delete-Reset; hide Test/Schedule.
   APPROVED: Settings, Schedule, Delete-Reset; hide Test/Review/Approve.
   SCHEDULED: Settings, Schedule (edit), Delete-Reset.
   FAILED: Settings, Delete-Reset.
   Button semantics
   Settings: edit config; saving validates; might suspend schedule if config changed.
   Test: run full scrape → create Shopify Drafts, tag rbp-import:<runId>, log IDs.
   Review: deep link to Products filtered by status=draft + tag.
   Approve: publish all drafts for runId (idempotent).
   Schedule: open dedicated page to enable/adjust recurrence.
   Delete-Reset: delete run’s drafts, clear runId/counters, keep history; state → READY_TO_TEST.
   Edit Template Fields (guarded): if run active/scheduled → require override → auto suspend schedule + state → NEEDS_SETTINGS.
4. Data & Identifiers
   Tag: rbp-import:<runId> per run.
   Metafields: rbp.import.runId, rbp.import.templateId, rbp.import.status.
   ImportConfig JSON on Template:
   {
   "source": {"entryUrl":"","discoveryLogic": "selector|sitemap|grid|regex"},
   "productUrls": [],
   "scrapeLogic": "jsonld|table-grid|dom-map|hybrid",
   "mapping": {"<templateField>": "<selectorOrRule>"},
   "flags": {"createDraftsOnFullScrape": true},
   "schedule": {"enabled": false, "freq": "none|daily|weekly|monthly", "at": "HH:mm"},
   "lastRun": {"at": "", "added":0,"updated":0,"skipped":0,"failed":0}
   }
   Logs: global + per template; entries include {at, templateId, runId, type: discovery|scrape|drafts|approve|abort|recrawl, counts, productIds?}.
5. Operational Rules (edge-case clarity)
   Validation before Test: required. If selectors/entry URL fail quick-check, remain NEEDS_SETTINGS.
   Partial Test success: still transitions to READY_TO_APPROVE; failed URLs listed with Retry Failed option.
   Re-Test behavior: creates a new runId, first deletes drafts from previous unapproved run, then proceeds.
   Manual draft edits in Shopify: allowed; Approve re-fetches to avoid stale publish; logs drift if present.
   Approve idempotency: if already active or missing, skip and log outcome.
   Schedule runs: default to update existing products in place (no new drafts) unless a template flag opts into “drafts on recrawl.”
   Schedule errors: retain SCHEDULED but badge the row as Warning + log. User can inspect and Delete-Reset if needed.
   Delete Template (hard): force flow: suspend schedule → delete drafts for open run → confirm → delete.
6. Acceptance Criteria
   “Add Import” opens New Template Wizard; save creates Template + Import, redirects to Settings.
   Settings save validates and sets state READY_TO_TEST (or NEEDS_SETTINGS on failure).
   Home shows state-driven buttons exactly as defined.
   Test produces Shopify drafts with tag rbp-import:<runId>; row becomes READY_TO_APPROVE.
   Review deep-links to Products (Drafts) filtered by tag.
   Approve publishes all drafts (idempotent), state → APPROVED.
   Schedule only visible post-approval and lives on its own page; enabling sets SCHEDULED.
   Changing Settings or Template fields while approved/scheduled suspends schedule and sets NEEDS_SETTINGS.
   Delete-Reset clears only current run artifacts, not the Template; history remains.
   All links are relative and preserve embedded context.
7. Visual QA Checklist
   New template → immediately appears as a row in Home with NEEDS_SETTINGS; Test disabled.
   Saving valid settings → READY_TO_TEST; Test enabled.
   Running Test → drafts in Shopify with correct tag; row → READY_TO_APPROVE.
   Approve → products live; row shows Schedule (and hides Test/Review/Approve).
   Schedule page → enable → row shows SCHEDULED + next run time.
   Editing Template fields while scheduled → on save, schedule suspends and row flips to NEEDS_SETTINGS.
   Delete-Reset cleans drafts and re-enables Test, without deleting the Template.
8. Retire / Replace
   Old “Add Import” page → replaced by New Template Wizard under Imports.
   Separate Templates section → remove/redirect entirely to Imports.
   Any in-app product review pages → keep Shopify Products as the review surface.
   Hard-wired mapping (table-grid-v1) → use template-label-driven mapping.
9. How to hand this to Copilot (and keep it on-rails)
   A) Put the scaffold in the repo (single source of truth)
   Create /docs/design/importer-v2-3.md with exactly this spec.
   Add a mini “Design Lock” header at the top:
   Design-Lock: importer-v2-3
   Status: LOCKED until “Scaffold Install” checklist = DONE
   B) Kick off a BUILD prompt (strict)
   Use this exact opening for Copilot:
   Title: “Copilot Prompt — BUILD: Importer v2.3 Scaffold Install (ADD-only)”
   Rules (paste this block first):
   Do not refactor. ADD-only.
   Wrap every edit with sentinels: <!-- BEGIN RBP GENERATED: importer-v2-3 --> / <!-- END RBP GENERATED: importer-v2-3 -->.
   Scaffold first, questions later.
   No UI review tables beyond Shopify link.
   Create routes/components/files listed in Section 2, empty shells OK.
   Implement the state machine constants + types; no business logic yet.
   Output: unified diffs only, no explanation.
   Checklist (must complete in this BUILD):
   Add docs/design/importer-v2-3.md with this spec.
   New routes: /app/imports/new, /app/imports/\_index (updated), /app/imports/$templateId, /app/imports/$templateId.schedule.
   Components: ImportList.tsx, ImportRowStateBadge.tsx, GlobalLogList.tsx, ScheduleForm.tsx, ShopifyFilterLink.tsx, ApproveAbortControls.tsx.
   Add the state machine enum and stub actions (testRun, approveRun, deleteResetRun, suspendScheduleOnConfigChange).
   Wire nav to remove legacy Templates routes (temporary redirect OK).
   Add TODO comments in sentinels where logic will go next.
   Stop Conditions:
   If any existing sentinel for importer-v2-3 is found, STOP and report DUPLICATE FOUND.
   C) Guardrails for all subsequent BUILD prompts
   Start each prompt with: “Design-Lock: importer-v2-3 (ON)”.
   Require Copilot to cite the section of /docs/design/importer-v2-3.md it is implementing.
   No changes outside sentinel blocks.
   No schedule logic until “Approve” phase is implemented and passing the minimal smoke checks.
   If Copilot needs info, it must print a Context Needed block (no guesses).
   D) Optional: Preflight
   Add a tiny preflight script later that checks:
   No references to legacy Templates routes.
   All internal links are relative.
   State machine constants are present.
   A “Design-Lock” header exists in /docs/design/importer-v2-3.md.

<!-- BEGIN RBP GENERATED: importer-v2-3 -->

## Templates & Imports — Unified Model (v2.3)

### Core rule

- One Template = One Import (1:1). Creating a Template auto-creates its Import.

### Where things live

- Home / Imports: Dashboard for all Templates-in-operation.
  - Top table: one row per Template/Import (state-driven actions).
  - Bottom table: global logs (discovery/scrape/drafts/approve/abort/schedule/recrawl).
- Add Import: launches New Template Wizard (creates Template + Import, redirects to Import Settings).
- Import Settings (template-scoped): General, Scrape & Mapping, Preview (no Review here).
- Review: done in Shopify Products (Drafts filtered by `rbp-import:<runId>`), not inside importer UI.
- Schedule: separate page; only visible after approval.

### Editing Templates while active/scheduled

- Allowed with override, but:
  - Suspend schedule automatically,
  - Set state → `NEEDS_SETTINGS`,
  - Require re-validation on save to reach `READY_TO_TEST`.

### Deleting Templates

- Multi-step confirm: suspend schedule → delete drafts for open run → confirm dependencies → delete.

### State machine (row actions)

`NEEDS_SETTINGS → READY_TO_TEST → READY_TO_APPROVE → APPROVED → SCHEDULED`

- Test: full scrape → drafts (tag `rbp-import:<runId>`) → logs → `READY_TO_APPROVE`
- Approve: publish drafts → `APPROVED`
- Schedule: enable/disable; state toggles `APPROVED`/`SCHEDULED`
- Delete/Reset: remove current run’s drafts & counters → `READY_TO_TEST`

### Data & persistence

- ImportTemplate: `{ id, name, importConfig<JSON>, state, lastRunAt, hadFailures }`
- ImportLog: `{ templateId, runId, type, payload, at }`
- importConfig stores: `productUrls[]`, `mapping`, `scrapeLogic`, `schedule`, `flags`, `counts`, etc.

### Acceptance

- “Add Import” creates Template + Import and lands on Settings.
- Saving valid Settings sets `READY_TO_TEST`.
- Test → Drafts; Review in Shopify; Approve → live; Schedule → `SCHEDULED`.
- Editing Template fields while scheduled suspends schedule and sets `NEEDS_SETTINGS`.
<!-- END RBP GENERATED: importer-v2-3 -->

<!-- BEGIN RBP GENERATED: importer-v2-3 -->

### Migration note

Run:

- `pnpm prisma generate`
- `pnpm prisma migrate dev --name importer_v2_3`
<!-- END RBP GENERATED: importer-v2-3 -->
