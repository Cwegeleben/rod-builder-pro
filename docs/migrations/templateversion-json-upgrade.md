## TemplateVersion.dataJson JSON Upgrade Plan

This document outlines the safe procedure to convert `TemplateVersion.dataJson` from `TEXT` to `JSON` (Prisma `String` -> `Json`) after the rollback of the earlier failed attempt.

### 1. Preconditions

1. All existing `dataJson` strings must parse as valid JSON.
2. Application write-paths must only store canonical JSON (no trailing commas, etc.).
3. A recent production backup is available.

### 2. Validate Current Data

Run locally against a production snapshot or remotely inside a maintenance shell:

```
npm run validate:templateversion-json
```

If any failures appear:

1. Export failing IDs.
2. Manually patch or delete / recreate those rows.
3. Re-run validator until zero failures.

### 3. Migration Strategy (SQLite)

SQLite cannot alter column types in-place reliably; Prisma will generate a table redefinition. We will:

1. Add a new temporary column `dataJson_new` (Json) (optional if relying solely on Prisma generated redefine).
2. Copy & parse existing text into the new column (ensures early detection of malformed data).
3. Swap columns (drop old, rename new) OR let Prisma's redefine do it if confident data is clean.

Because validations guarantee correctness, we can directly change the schema in `schema.prisma` from `String` -> `Json` and run `prisma migrate dev --name templateversion_json_upgrade` locally.

### 4. Dry Run Locally

1. Modify model:
   ```prisma
   dataJson Json
   ```
2. Generate migration:
   ```
   npx prisma migrate dev --name templateversion_json_upgrade
   ```
3. Inspect the generated SQL for unintended index drops.

### 5. Production Execution

1. Build maintenance image with dev dependencies (PRUNE_DEV=false) if manual inspection is desired.
2. Backup DB volume.
3. Run:
   ```
   npx prisma migrate deploy
   ```
4. Run validator again (it now reads Json type—should still parse but may need adjustment or removal).

### 6. Rollback Plan

If migration fails mid-apply:

- Replace image with previous version.
- Restore backup volume.
- Mark failed migration rolled back (as done previously) and reassess data anomalies.

### 7. Post-Migration Hardening

- Add runtime assertion on writes ensuring `typeof dataJson !== 'string'` (now object/array).
- Enable `STRICT_MIGRATIONS` environment flag after 1–2 successful deploys.

### 8. Optional Data Normalization

Before conversion you may normalize indentation or key ordering; this is purely cosmetic, but can reduce future diff noise if you version the content externally.

### 9. Checklist

- [ ] Production backup created
- [ ] Validator passes (0 failures)
- [ ] Migration SQL reviewed
- [ ] Maintenance window (if needed) announced
- [ ] Migration applied
- [ ] App smoke tested (read & create template versions)
- [ ] Validator (post) still passes / or removed
- [ ] Changelog updated

### 10. Future Enhancements

Consider adding a small script to auto-coerce legacy plain strings into structured JSON (e.g., wrap raw values) should requirements change.

---

Prepared to ensure a deterministic, low-risk transition to native JSON storage.
