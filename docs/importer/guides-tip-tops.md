# Batson Guides & Tip Tops Importer

- Target: `batson-guides-tops`
- Source: `https://batsonenterprises.com/guides-tip-tops`

## Discovery

- Uses category pagination + scroll to collect product/series pages.
- Preflight:
  - Static probe: `npm run -s preflight:discover:guides`
  - Full seed dump (all URLs to JSON):
    ```sh
    pnpm -s tsx scripts/preflight/dump-guides-seeds.ts > /tmp/guides-seeds.json
    ```

## Ingestion

- Script: `scripts/preflight/ingestSeeds.ts` (run via tsx if passing .ts)
- Direct URLs (bypass ProductSource):
  ```sh
  DATABASE_URL='file:./dev.sqlite' SUPPLIER_ID=batson-guides-tops DETAIL_ONLY=0 \
  URLS="<comma-separated-urls>" pnpm -s tsx scripts/preflight/ingestSeeds.ts
  ```
- Series pages containing `<table class="attribute-grid">` are expanded into per-model products with:
  - `ring_size` (guides), `tube_size` (tip tops)
  - `frame_material`, `finish`
  - `classification`: `guide` | `tip-top` | `guide-kit`

## Normalization

- Specs stored in `ProductVersion.normSpecs` JSON; no new DB columns.
- Heuristics ensure numeric sizes captured from either attribute grid or title tokens.

## Title Rules

- Title builder selects guide/tip-top form when blank-like signals (length/power) are absent.
- Pattern: `[Brand] [Guide|Tip Top|Guide Kit] [Ring <n>] [Tube <n>mm] [frame] [finish] [code]` (segments omitted when unknown).

## Diagnostics

- Summary script:
  ```sh
  DATABASE_URL='file:./dev.sqlite' node scripts/diagnostics/importer-guides-summary.mjs \
    --supplier batson-guides-tops --filter all --json
  ```
- Reports counts for discovered, ingested, classification buckets, duplicate SKUs, and a sample of missing sources.

## End-to-End (local dev)

```sh
# 1) Init DB (SQLite dev)
DATABASE_URL='file:./dev.sqlite' npx prisma db push --accept-data-loss

# 2) Discover seeds
pnpm -s tsx scripts/preflight/dump-guides-seeds.ts > /tmp/guides-seeds.json

# 3) Ingest first 25 seeds
URLS=$(jq -r '.seeds[:25][]' /tmp/guides-seeds.json | paste -sd, -)
DATABASE_URL='file:./dev.sqlite' SUPPLIER_ID=batson-guides-tops DETAIL_ONLY=0 \
URLS="$URLS" pnpm -s tsx scripts/preflight/ingestSeeds.ts

# 4) Diagnostics
DATABASE_URL='file:./dev.sqlite' node scripts/diagnostics/importer-guides-summary.mjs \
  --supplier batson-guides-tops --filter all --json
```
