# Product DB Migration Guide

This document outlines the migration from staging/diff-based importer storage to the canonical product_db.

## Models

- Supplier(id, slug, name, urlRoot, active)
- Product(id, supplierId, sku, title, type, status[DRAFT|READY|PUBLISHED], latestVersionId, publishHandle)
- ProductVersion(id, productId, contentHash, rawSpecs, normSpecs, description, images, priceMsrp, priceWholesale, availability, fetchedAt)
- ProductSource(id, supplierId, productId?, url, externalId?, firstSeenAt, lastSeenAt)
- Telemetry: PublishTelemetry, ImportTelemetry

## Migration steps

1. Back up the DB and tag a release.
2. Deploy schema with canonical models enabled.
3. Run the one-time backfill:
   - node scripts/migrate/staging-to-product-db.mjs --limit=0
4. Enable PRODUCT_DB_ENABLED=1 to switch /app/products to canonical read path.
5. Run a Save & Crawl and confirm canonical list updates.
6. Dual-write validation for 1 run, then disable staging writes.
7. Remove review/diff UIs and staging-only features after a retention window.

## Telemetry

- PublishTelemetry: attempted/created/updated/skipped/failed + duration.
- ImportTelemetry: newProducts/newVersions/skipped/failed + duration.

## Rollback

- Disable PRODUCT_DB_ENABLED to return to legacy read path.
- Backfill is idempotent and can be re-run; canonical tables can be truncated if needed.
