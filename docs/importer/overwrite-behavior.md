# Import Overwrite & Staging Behavior

This guide explains how the importer protects data during staging and publish phases, when an existing template has prior staged content.

## Overview

An import "prepare" operation stages candidate items (parts/products/specs) before approval or publish. If previously staged rows exist for the same template, the system applies overwrite safeguards to avoid accidental mass replacement.

## Guard: `confirm_overwrite`

When a new prepare run detects previously staged rows whose content differs (hash comparison) or would be replaced, the server can block the automatic start and return a JSON guard response:

```json
{ "guard": "confirm_overwrite", "stagedCount": 42 }
```

Client UX: A modal surfaces the count and asks for explicit confirmation. Once the user confirms, a second prepare request includes a signal to proceed.

### Why It Triggers

- Non-empty staging table for the template.
- New candidates imply changes that would replace or delete previously staged items.
- Safety threshold exceeded (see auto-confirm heuristic below).

### Telemetry Events

- `prepare:start` — initial attempt.
- `prepare:report` — staging diff summary.
- `prepare:autoConfirm` — heuristic path used (see below).
- `prepare:done` — run successfully queued.
- `prepare:error` — failure.

## Auto-Confirm Heuristic (Small Overwrites)

For small overwrites (currently ≤ 3 staged rows), the client is allowed to auto-confirm without surfacing the modal. This reduces friction for templates under exploratory setup.

Criteria:

- Guard response is `confirm_overwrite`.
- `stagedCount <= 3`.
- Client sends `autoConfirm=true` and a hint `stagedCountHint` matching server count.

Server Behavior:

- Logs an `prepare:autoConfirm` ImportLog entry containing: `{ templateId, stagedCount }`.
- Proceeds as if the user confirmed explicitly.

Rationale: Tiny overwrites are usually harmless and frequent during seed tweaking; eliminating an unnecessary click accelerates iteration while retaining telemetry.

## Seed Change Auto-Wipe

When seeds change substantially (domain or URL set pivot) the importer can auto-wipe stale staging rows to ensure consistency:

- Detects seed hash difference (e.g. normalized seed set hashed via SHA-256 or length fingerprint fallback).
- Performs autowipe (`prepare:autowipe:*` log entries) before staging new candidates.
- Guarantees that publish approval is based solely on fresh seed-derived data.

Benefits:

- Avoids mixed staging state from heterogeneous seed sets.
- Simplifies mental model: staging always reflects current seed configuration.

## Publish Skip Classification

During publish, each staged item is classified via hash comparison against previously published metafield hash:

- `created` — new item.
- `updated` — content changed.
- `skipped` — identical hash; no Shopify write.
- `failed` — error during publish attempt.

Counts of each classification appear in approval/publish reporting, improving clarity of impact.

## UX Summary

| Scenario                       | Modal?          | Action Needed | Telemetry                          |
| ------------------------------ | --------------- | ------------- | ---------------------------------- |
| First run, empty staging       | No              | None          | start, report, done                |
| Overwrite with > 3 staged rows | Yes             | User confirm  | start, report, (confirm), done     |
| Overwrite with ≤ 3 staged rows | No (auto)       | None          | start, report, autoConfirm, done   |
| Seed pivot requiring wipe      | No (background) | None          | autowipe logs, start, report, done |

## Implementation Signals

Client POST body (prepare):

```json
{
  "templateId": "tpl-123",
  "autoConfirm": true,
  "stagedCountHint": 3
}
```

Server validation steps:

1. Check guard condition.
2. If `autoConfirm` and counts match threshold, log `prepare:autoConfirm` and proceed.
3. Otherwise return `{"guard":"confirm_overwrite","stagedCount":N}`.

## Operational Tips

- If modal keeps appearing unexpectedly, verify seed scope (allowed host domains) and confirm staged count threshold (maybe just above 3).
- To test auto-confirm path locally, reduce staged rows to ≤3 before triggering prepare.
- Monitor logs filtered by `prepare:autoConfirm` to assess heuristic adoption.

## Future Enhancements (Suggestions)

- Configurable threshold per template (e.g., via settings).
- Per-row diff preview inside modal for transparency.
- Admin override flag to bypass confirm for trusted templates.

## Glossary

- Staging: Temporary holding area for candidate items awaiting approval/publish.
- Seed: Source URL(s) used to discover items.
- Autowipe: Automatic deletion of prior staged rows due to seed pivot.
- Hash Content: Canonical serialized representation used to detect changes.

---

_Last updated: 2025-11-10_
