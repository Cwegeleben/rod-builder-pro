# Importer Delete Endpoint

Endpoint: `POST /api/importer/delete[?dry=1][&force=1]`

Deletes one or more importer templates and all related data (logs, runs, diffs, staged parts, product sources). Supports preview (dry‑run) and a force override to bypass active blockers.

## Request Body (JSON)

```
{ "templateIds": ["tpl-1", "tpl-2"], "dryRun": true }
```

`dryRun` can be provided in body or `?dry=1` query.

## Query Parameters

- `dry=1` – Preview counts only.
- `force=1` – Override active blockers (prepare/publish in progress).

## Blockers

The delete can be blocked by:

- `active_prepare` – A template has `preparingRunId` set.
- `publish_in_progress` – Recent `publish:progress` logs (<5m).

Blocked response:

```
{
  "error": "Blocked: delete restrictions active",
  "code": "blocked",
  "blockers": [
    { "code": "active_prepare", "templateIds": ["tpl-1"] },
    { "code": "publish_in_progress", "templateIds": ["tpl-2"] }
  ],
  "templates": ["tpl-1", "tpl-2"],
  "hint": "Use ?force=1 to override blockers if appropriate."
}
```

## Dry-Run Success

```
{
  "ok": true,
  "dryRun": true,
  "counts": {
    "templates": 2,
    "logs": 120,
    "runs": 4,
    "diffs": 80,
    "staging": 35,
    "sources": 14
  }
}
```

## Commit Success

```
{
  "ok": true,
  "deleted": 2,
  "deletedDetails": {
    "templates": 2,
    "logs": 120,
    "runs": 4,
    "diffs": 80,
    "staging": 35,
    "sources": 14
  },
  "forced": true,
  "durationMs": 412
}
```

## Error Codes

- `not_found` – No matching templates.
- `blocked` – Blockers present (omit with `force=1`).
- `unknown` – Unhandled error.

## Audit Logging

Model `ImportDeleteAudit` captures:

- `templateIds` (comma‑separated)
- `countsJson` / `deletedJson`
- `forced`, `dryRun`, `userHq`
- `blockedCodes` (comma‑separated)
- `durationMs`

Dry-run and commit both attempt best‑effort audit writes (ignored on failure).

## Force Delete Guidance

Use force only when blockers are transient or stuck (e.g., stalled prepare run). Confirm no critical publish operations are mid-flight.

## UI Integration Notes

- Preview first (`dry=1`) to surface counts & blockers.
- Offer force toggle when blocked.
- After commit, surface `deletedDetails` counts in success toast.

## Future Enhancements

- Per-template diff of what could not be deleted (if partial failures).
- Raw SQL cascade optimization for large datasets.
- Webhook or event emission on commit for external monitoring.
