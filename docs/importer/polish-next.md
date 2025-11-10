# Importer Post-GA Polish (Deferred Tasks)

These items are intentionally deferred for a subsequent iteration; they are not required for current stability goals.

## UI / UX

- Segmented publish progress bar (phase markers: initializing, writing, verifying, finalizing).
- Persistent metrics badge after reload (hydrate from `run.summary.publishTotals`).
- Enhanced conflict resolution panel with inline diff previews.
- Toast aggregation test coverage (Playwright) for approve, recrawl start, publish completion.
- Accessibility: include phase label in aria-live region and ensure verify button focus order.

## Testing & Tooling

- E2E: sticky summary bar visibility & counts update after approve/reject actions.
- E2E: Verify button opens correct product search (tag filtering) and returns results.
- Unit: Extract publish phase inference into a pure function and add direct tests for edge progress percentages.

## Performance / Reliability

- Feature flag for smart approve-all images heuristic (env toggle).
- Batch metafield writes with concurrency controls (reduce rate limit retries).
- Preflight check summarizing expected publish operations and potential skip reasons.

## Observability

- ImportLog filter chips expansion: quick presets (Errors, RateLimited, Skips).
- Metrics export: daily counts of created/updated/skipped/failed per supplier/template.

## Data Enhancements

- Consider storing previous hash for quick diff delta display.
- Additional staging columns for derived spec summaries to reduce per-item recompute.

---

Last updated: 2025-11-10
