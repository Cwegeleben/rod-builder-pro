# product_db.products canonical schema (Step 3 design)

## 0. Table shape

- **Single canonical table**: `product_db.products` (Prisma model `Product`).
- **Universal columns** store supplier identity, catalog metadata, lifecycle flags, and design-studio readiness.
- **Category-specific attributes** live in a JSON column (`attributes`) whose keys match the normalized TypeScript interfaces from Step 2 (`NormalizedBlank`, `NormalizedGuide`, etc.).
- **Future-friendly**: We can break out per-category tables later, but the importer ships with one table + structured JSON now.

## 1. Core columns

| Column                   | Type                      | Notes                                                                   |
| ------------------------ | ------------------------- | ----------------------------------------------------------------------- |
| `id`                     | `String @id`              | Internal UUID (existing)                                                |
| `supplierId`             | `String`                  | FK to `Supplier.id`, continues to scope product owners                  |
| `supplier`               | relation                  | Prisma relation to `Supplier`                                           |
| `supplierSiteId`         | `String?`                 | Optional slug for multi-site suppliers (Batson site, etc.)              |
| `productCode`            | `String`                  | Supplier SKU (`sku` today → rename)                                     |
| `category`               | `String`                  | One of `blank`, `guide`, `tipTop`, `grip`, `reelSeat`, `trim`, `endCap` |
| `family`                 | `String?`                 | Enum string from normalized types (`castingBlank`, `microGuide`, …)     |
| `brand`                  | `String?`                 | Canonical brand (RainShadow, Forecast, Winn)                            |
| `series`                 | `String?`                 | Series / program (`RX7`, `Winn Rod Grips`)                              |
| `material`               | `String?`                 | high-level material descriptor                                          |
| `color`                  | `String?`                 | canonical color string                                                  |
| `msrp`                   | `Decimal?`                | MSRP                                                                    |
| `availability`           | `String?`                 | constrained to `IN_STOCK` / `OUT_OF_STOCK` enum (text stored for now)   |
| `designStudioReady`      | `Boolean @default(false)` | importer-set readiness                                                  |
| `active`                 | `Boolean @default(true)`  | indicates whether supplier still lists it                               |
| `attributes`             | `Json?`                   | structured payload per category                                         |
| `description`            | `String?`                 | short marketing copy (existing)                                         |
| `images`                 | `Json?`                   | canonical gallery                                                       |
| `createdAt`, `updatedAt` | timestamps                | Prisma defaults                                                         |

Indexes:

- `@@unique([supplierId, productCode])` (replace old `sku`).
- `@@index([category, family])` for DS filtering.
- `@@index([designStudioReady])` optional for dashboards.

## 2. Attributes JSON contract

`attributes` is a JSON object whose keys **exactly match** the normalized union types from Step 2.

Example — Blank:

```json
{
  "itemTotalLengthIn": 90,
  "numberOfPieces": 2,
  "power": "ML",
  "action": "Fast",
  "application": ["kokanee", "trolling"],
  "blankType": "spinning",
  "materialConstruction": "RX7 Graphite",
  "lineRating": "4-10 lb",
  "lureRating": "1/8-1/2 oz",
  "tipOD_mm": 1.6,
  "buttOD_mm": 12.3
}
```

Example — Grip:

```json
{
  "itemLengthIn": 3,
  "insideDiameterIn": 0.3,
  "frontODIn": 0.9,
  "rearODIn": 1.0,
  "profileShape": "split",
  "urethaneFilled": true
}
```

Validation rules:

1. Only include fields that belong to that category's TS interface.
2. Keep camelCase names identical to TS definitions.
3. Store numbers as numbers, enums as strings.

## 3. Lifecycle + design fields

- `designStudioReady`: set by importer adapters using existing readiness heuristics (tip-tops require sizing, etc.).
- `active`: importer marks `false` when a previously seen SKU disappears in a full run.
- `status`, `latestVersion` relations remain for audit/version history — Step 3 focuses on the canonical row structure.

## 4. Migration outline

1. Rename `Product.sku` → `productCode` (Prisma `@map("sku")` for back-compat if needed).
2. Add new scalar columns: `supplierSiteId`, `category`, `family`, `brand`, `series`, `material`, `color`, `active` (default true).
3. Add `attributes Json?` column.
4. Update unique index to use `(supplierId, productCode)`.
5. Introduce new indexes for `(category, family)` and optionally `designStudioReady`.
6. Backfill data from existing columns (title, status) into new fields when available.

## 5. Adapter expectations

Each Step 2 normalized object must map cleanly:

- Set universal columns (brand, series, msrp, availability, etc.).
- Set `category` + `family` from normalized type metadata.
- Populate `attributes` JSON by selecting the category-specific fields only (no duplicates of universal columns).
- Provide `designStudioReady` boolean.

## 6. Sample upsert contract

Key = `(supplierId, productCode)`.

- Insert new rows for new SKUs.
- Update existing rows with fresh universal + attributes data.
- Mark missing SKUs as `active=false` during a full mirror apply.

## 7. Future extensions

- Additional indexes: `brand`, `series` for UI search.
- Postgres migration: same schema concepts apply.
- If categories push JSON limits, break out to per-category tables referencing `products.id` later.

## Appendix A: current schema inventory (Dec 2025)

Source: `prisma/schema.prisma` `model Product` (phase 1).

| Field                        | Status                                                    |
| ---------------------------- | --------------------------------------------------------- |
| `id`                         | keep                                                      |
| `supplierId` + relation      | keep                                                      |
| `sku`                        | rename → `productCode`                                    |
| `title`                      | keep (human readable name)                                |
| `type`                       | superseded by `category` (repurpose or drop)              |
| `designPartType`             | can mirror `category`/`family`, keep for DS compatibility |
| `status`                     | keep (DRAFT/READY/PUBLISHED)                              |
| `latestVersionId` / relation | keep                                                      |
| `publishHandle`              | keep                                                      |
| `description`                | keep                                                      |
| `images Json?`               | keep                                                      |
| `priceMsrp`                  | keep (also mapped to `msrp`)                              |
| `priceWholesale`             | keep (wholesale)                                          |
| `availability`               | keep but drive from normalized enum                       |
| `designStudio*` fields       | keep until DS 2.0 retires them                            |
| `createdAt/updatedAt`        | keep                                                      |

New fields to add: `supplierSiteId`, `category`, `family`, `brand`, `series`, `material`, `color`, `msrp` alias (reuse `priceMsrp`), `active`, `attributes Json`. Existing indexes: `@@unique([supplierId, sku])` rename; add new indexes listed above.
