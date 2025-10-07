# Hybrid Template Lifecycle & Migration (Phase 1)

Status: Implemented (flag-gated via `VITE_REMOTE_TEMPLATES` = `true`)
Scope: Local drafts, remote (Shopify Metaobject) published templates. Hard delete local draft on publish.

## Goals

- Store published templates globally (Shopify) so they are universally visible & survive app DB resets.
- Retain fast/local iteration for drafts until ready.
- Avoid orphan remote metaobjects and console noise.

## Data Model Roles

- Local (Prisma) `specTemplate` + `specField` rows: DRAFT only when hybrid mode ON.
- Remote Metaobject type `rbp_template`: Canonical PUBLISHED templates. Fields (metaobject fields):
  - `template_id` (single_line_text_field) – stable UUID from original local template id.
  - `name` (single_line_text_field) – display name.
  - `fields_json` (json) – serialized ordered field descriptors (subset of specField columns).
  - `version` (integer) – (Phase 1: always 1) future for optimistic concurrency.
  - `updated_at` (date_time) – ISO timestamp at publish time (Phase 1: set by app).

## Feature Flag

`VITE_REMOTE_TEMPLATES=true` activates:

1. Index loader merges: remote published + local drafts (remote first ordering by updated_at desc, then drafts by updatedAt desc).
2. Publish button (draft row) posts action `publishHybridTemplate`.
3. Orphan banner suppressed; hybrid flow prevents creating new orphans.

When false (legacy mode): All templates remain local; existing orphan detection UI remains.

## Publish Flow (Action: `publishHybridTemplate`)

1. Receive local template id (draft).
2. Fetch template + fields (ordered) from Prisma.
3. Upsert remote metaobject (definition ensured once) using `template_id` as stable id field.
4. Serialize field list to `fields_json`.
5. Delete local `specTemplate` (cascades `specField` rows) – no local copy retained.
6. Redirect back to index; published template now sourced from remote list call.

Hard delete rationale: Remote is canonical immediately; history/snapshots deferred to later phase.

## Backfill / Migration Steps

For existing deployments enabling hybrid mode:

1. PREPARE: Deploy code with flag OFF (default). Verify legacy behavior unchanged.
2. BACKFILL SCRIPT (run once before enabling flag):
   - Enumerate all current local templates intended as published.
   - For each, call the same helper used by action: `createOrUpdateRemoteFromLocalDraft` WITHOUT deleting local (use a temporary script variant) to seed remote copies.
   - After successful remote upserts, decide whether to purge local published rows now or let the publish action handle only new drafts going forward. Recommended: purge immediately to avoid duplication confusion when flag flips.
3. VERIFY:
   - Use a temporary debug route / existing metaobject debug route to confirm remote objects count & data integrity.
4. ENABLE FLAG: Set `VITE_REMOTE_TEMPLATES=true` in environment (Fly secrets / env var) and redeploy.
5. POST-CHECK: Visit templates index; confirm remote items appear and no duplicates.

### Example Backfill Script Outline (pseudo-code)

```ts
import { prisma } from '~/db.server'
import { createOrUpdateRemoteFromLocalDraft } from '~/models/remoteTemplates.server'

async function backfill(session) {
  const all = await prisma.specTemplate.findMany({ include: { fields: { orderBy: { position: 'asc' } } } })
  for (const t of all) {
    await createOrUpdateRemoteFromLocalDraft(session, t.id, { skipDelete: true }) // option you'd transiently add
  }
  // Optional cleanup: await prisma.specTemplate.deleteMany({ where: { id: { in: all.map(t => t.id) } } })
}
```

(You may transiently extend helper with `skipDelete` boolean to reuse logic and then remove extension after one-time use.)

## Rollback Strategy

If issues arise after enabling:

1. Set `VITE_REMOTE_TEMPLATES=false` and redeploy – UI reverts to local-only.
2. If local copies were deleted, you need to restore from a DB backup OR reconstruct from remote metaobjects by writing an import script (inverse of backfill using `fields_json`).
3. Keep remote metaobjects; they are harmless in legacy mode (simply unused).

## Operational Notes / Edge Cases

- Concurrency: Phase 1 does NOT implement version conflict detection. Low risk since publish is one-shot per template id.
- Re-publish (same template_id): Currently not supported since local draft is deleted; future draft revisions will clone remote into a new local draft.
- Orphans: New orphans not generated. Manual remote deletions outside app could produce missing published templates; detection can be added later.
- Performance: Remote listing paginates; current implementation fetches sequentially until exhausted. Monitor for large counts (>500) to add cursor batching limits.
- Error Handling: If remote upsert succeeds but local delete fails (rare), retry delete; inconsistent state is a duplicate draft which can be safely re-published (remote upsert idempotent by `template_id`).
- Security: Remote metaobject definition creation runs lazily; first publish ensures definition. Consider a bootstrap script in production to reduce first-request latency.

## Future Enhancements (Phase 2+)

- Version incrementing & optimistic concurrency (compare remote version before update).
- Snapshot / `TemplateVersion` creation at publish for audit & rollbacks.
- Draft revision workflow: Clone remote -> new local draft -> edit -> republish (updates existing remote entry).
- Partial field edits pushed incrementally without deleting draft (two-phase commit).
- UI badges: Draft (local), Published (remote), Outdated Draft (local vs remote diff).
- Import remote -> local for rebuild after rollback.

### Expanded Phase 2 Roadmap

| Order | Feature                         | Summary                                                | Key Additions                                                                                             |
| ----- | ------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 1     | Remote → Local Draft (Revision) | Create editable draft from a published remote template | New helper: `importRemoteTemplateAsDraft(templateId)`; local columns: `remoteTemplateId`, `remoteVersion` |
| 2     | Optimistic Concurrency          | Prevent overwriting newer remote changes               | `version` increment on publish; compare expected vs actual                                                |
| 3     | Snapshot History                | Preserve every published state for rollback            | `TemplateVersion` insert each publish; rollback creates draft from snapshot                               |
| 4     | Diff & Badges                   | Visual status cues & changed field highlight           | Diff utility comparing `fields_json`; UI badges & optional color indicators                               |
| 5     | Bulk Import / Backfill Drafts   | Mass edit pipeline for many published templates        | Script + optional admin action to seed drafts                                                             |
| 6     | Performance & Caching           | Reduce repetitive remote list calls                    | In-memory / ephemeral cache (TTL) per request cycle                                                       |
| 7     | Error Hardening & Telemetry     | Structured error surfaces & logs                       | Unified GraphQL error mapper; structured logging context                                                  |
| 8     | Optional Locking                | Prevent simultaneous conflicting edits                 | Draft row `lockedAt`, `lockedBy` fields (or ephemeral store)                                              |

#### 1. Remote → Local Draft Revision

Flow:

1. User clicks Edit on a published template.
2. Fetch remote metaobject by `template_id` (new query helper).
3. Parse `fields_json` → create new local draft rows ordered by original index.
4. Store `remoteTemplateId` + `remoteVersion` for optimistic comparisons.
5. Redirect to existing edit UI (which already operates on local drafts).

Schema changes (Prisma):

```prisma
model SpecTemplate {
  id                 String   @id @default(cuid())
  name               String
  // ...existing fields...
  remoteTemplateId   String?  // canonical template_id when this is a revision draft
  remoteVersion      Int?     // version at time of import
}
```

Add an index on `(remoteTemplateId)` for quick lookups.

#### 2. Optimistic Concurrency

Publish mutation includes `expectedVersion` (local `remoteVersion`). Remote responds with next version or conflict. Conflict handling: show banner + offer “Refresh from Published” (imports again) or “Force (overwrite)” (explicit second action).

#### 3. Snapshot History

On successful publish:

- Insert snapshot row capturing: template_id, version, name, fields_json, publishedAt.
- Future: diff snapshots for change logs.
  Rollback = create new draft from snapshot state (same as remote import but using stored snapshot JSON).

#### 4. Diff & Badges

Simple JSON diff (array of field objects) keyed by `key` + order changes:

- Added / Removed / Modified (label, required, type, mapping fields).
  UI: show counts and clickable list to scroll/highlight changed fields.

#### 5. Bulk Import Utilities

Use case: mass rename patterns, type transitions, or bulk mapping changes.
Script enumerates remote metaobjects, imports each as draft (skipping ones already with an open draft). Optionally throttle to respect API limits.

#### 6. Performance & Caching

- Cache remote list for N seconds in memory (per server instance) to avoid repeated GraphQL pagination on rapid navigation.
- Provide manual refresh button to bust cache.

#### 7. Error Hardening

Standardize shape:

```ts
type RemoteTemplateError = {
  code: 'NETWORK' | 'GRAPHQL' | 'CONFLICT' | 'VALIDATION'
  message: string
  cause?: unknown
}
```

All remote helpers throw in this shape for predictable UI handling.

#### 8. Optional Locking

Soft lock when an editor opens a draft; expires after inactivity (e.g., 10 minutes). Display lock holder with option to override (admin only).

### Sequencing Rationale

- Draft revision import required before concurrency, snapshots, and diffs deliver value.
- Versioning before snapshots ensures stable version lineage.
- Snapshots before rollback UI/diffs to avoid retrofitting.
- Caching & telemetry can happen anytime (low coupling).

### Minimal Increment per PR

1. Import + schema.
2. Version field usage & conflict UI.
3. Snapshot table + insertion.
4. Diff utility + badges.
5. Bulk import script.
6. Cache + refresh endpoint.
7. Error typing refactor.
8. Locking (optional / maybe later).

### Testing Strategy (High-Level)

- Unit: JSON parse/import, diff function, optimistic publish conflict.
- Integration: Publish → snapshot created; Conflict path (simulate version mismatch); Rollback creates correct draft.
- E2E (later): Edit published template, modify field, publish; view history.

### Open Questions

- Should diff treat reordering alone as significant? (Likely yes for clarity.)
- Retain deleted field history in snapshots? (Yes; snapshots preserve full prior list.)
- Force publish override path: require confirmation modal? (Recommend yes.)

---

Additions above define concrete backlog; adjust numbering if priorities shift.

## Verification Checklist Before Enabling Flag

- [ ] Code deployed with hybrid helpers present.
- [ ] Remote metaobject definition `rbp_template` exists (or first publish tested).
- [ ] Backfill complete; sample remote objects visible.
- [ ] Index route tested locally with `VITE_REMOTE_TEMPLATES=true`.
- [ ] Publish action tested on a brand-new draft (confirmed local deletion).
- [ ] Rollback plan documented and DB snapshot taken.

## Environment Configuration

Set via Fly secrets or env file:
`VITE_REMOTE_TEMPLATES=true`

To disable quickly:
`VITE_REMOTE_TEMPLATES=false` (redeploy).

---

Questions or adjustments: update this doc and reference any new helper functions as phases evolve.
