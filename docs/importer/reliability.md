# Importer Reliability Overview

This document summarizes the reliability and UX improvements delivered in the v2.3+ importer roadmap.

## Core Improvements

1. Isolation & Hashing

   - Template partitioning with composite unique index on `PartStaging (supplierId, templateId, externalId)`.
   - Content hash (`hashContent`) baseline for diff classification and publish skip logic vs Shopify metafield `rbp.hash`.
   - Seed hashing and publish concurrency guard to prevent overlapping operations.

2. Approval Flows

   - Approve Adds (supports `?all` mode) and Approve All multi-type endpoints.
   - Smart approve-all heuristic: toast indicates when all selected rows include images.
   - ImportLog telemetry for approval operations.

3. Review Experience

   - Sticky summary bar with live counts (selected, created, updated, skipped, failed).
   - Skeleton/hydration gating to avoid SSR/CSR mismatch in table.
   - Disabled-reason tooltip for Publish (conflicts or zero approvals).
   - Conflict banner with actionable "View Conflicts" jump.
   - Metrics badge (C/U/S/F) once publish totals are known.
   - Aria-live region announcing progress & completion for accessibility.

4. Recrawl + Publish Orchestrator

   - Pipeline: prepare → wait → approve adds → optional publish.
   - Returns goal and publish totals, with lifecycle ImportLog events.
   - Guard codes + rate limiting (e.g. blocked_prepare, blocked_publish, rate_limit).

5. Publish Update Logic

   - Adjusted updated totals excluding hash-unchanged title/spec backfill cases.
   - Detailed buckets: `hash_unchanged_title_updated`, `hash_unchanged_specs_backfilled`.
   - Skip path for unchanged + active products with spec backfill when required.

6. Data Model & Hash Audit

   - DB bootstrap aligned to Prisma schema (added `templateId`, composite unique index upgrade path).
   - Unit test ensures `rbp.hash` presence and sanitization drop for empty values.

7. Verification & Diagnostics
   - "Verify on Shopify" button linking to admin products search by publish filter tag.
   - Extended ImportDiff publish diagnostics (metafield warnings/errors, variant/image errors, skip reasons).

## Guard & Error Pattern

All guard blocks return structured JSON `{ error, code, hint, retryAfterSeconds? }` enabling UI tooltips & toasts with actionable guidance.

## Tests Added

- Recrawl guard codes & goal counts.
- Delete dry-run + concurrency guard.
- Publish totals adjustments (hash unchanged buckets).
- rbp.hash write/sanitization behavior.

## Operational Guidance

| Action              | Recommended Steps                                                           | Notes                                                          |
| ------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Bulk Approve New    | Use "Approve All New" after review filtering                                | Toast shows unresolved add counts when partial.                |
| Recrawl Update All  | Trigger recrawl with publish option if confident; watch publish modal phase | Rate limit prevents accidental rapid re-triggers.              |
| Publish             | Optionally dry-run first for totals; then publish and use Verify button     | Phase labels: initializing → writing → verifying → finalizing. |
| Conflict Resolution | Jump via banner button to Conflicts tab                                     | Must clear before Publish enabled.                             |

## Follow-up (Deferred)

- E2E coverage for toasts & sticky summary bar.
- Phase-based segmented progress bar.
- Persistent metrics badge post-refresh (read from run summary on load).
- Accessibility: include phase label text in aria-live announcements.

## FAQ

**Q: Why does updated count differ from actual changed products?**  
Adjusted totals exclude hash-unchanged title/spec backfill cases so "Updated" focuses on true content changes.

**Q: When is rbp.hash dropped?**  
During sanitization if empty or pattern-coerced to an empty string; a warning is recorded.

**Q: Can I safely re-trigger publish?**  
Guards detect in-progress publish; wait for completion (phase 'finalizing') or use skip logic for unchanged products.

---

_Last updated: 2025-11-10_
