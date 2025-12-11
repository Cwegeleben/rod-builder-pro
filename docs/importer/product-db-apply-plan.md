# Step 3 apply plan (schema + mapping)

## 1. Universal column mapping

| Product column      | Source (normalized object)                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `supplierId`        | looked up Supplier row for Batson (`supplier.slug = "batson"`)                             |
| `supplierSiteId`    | `normalized.context.siteId` (optional)                                                     |
| `productCode`       | `normalized.externalId`                                                                    |
| `title`             | `normalized.title`                                                                         |
| `category`          | discriminated union tag (`blank`, `guide`, `tipTop`, `grip`, `reelSeat`, `trim`, `endCap`) |
| `family`            | `normalized.family` enum (e.g., `castingBlank`)                                            |
| `brand`             | `normalized.brand`                                                                         |
| `series`            | `normalized.series`                                                                        |
| `material`          | `normalized.material` / `materialConstruction`                                             |
| `color`             | `normalized.color`                                                                         |
| `msrp`              | `normalized.priceMsrp`                                                                     |
| `availability`      | normalized availability enum mapped to `IN_STOCK` / `OUT_OF_STOCK`                         |
| `designStudioReady` | Step 2 readiness helpers (same logic used for staging)                                     |
| `active`            | true when present in current run; set false when SKU missing                               |
| `attributes`        | category-specific payload (see §2)                                                         |

## 2. Category adapters

Create `app/services/suppliers/batsonApply.server.ts` (or `productDbApply.server.ts`) with helpers:

```ts
type ProductRowInput = {
  supplierId: string
  supplierSiteId?: string
  productCode: string
  title: string
  category: ProductCategory
  family: string
  brand?: string
  series?: string
  material?: string
  color?: string
  msrp?: number
  availability?: ProductAvailability
  designStudioReady: boolean
  attributes: JsonObject
}
```

Adapter functions:

- `toProductRowFromBlank(normalized: NormalizedBlank): ProductRowInput`
- `toProductRowFromGuide(normalized: NormalizedGuide): ProductRowInput`
- `toProductRowFromTipTop(normalized: NormalizedTipTop): ProductRowInput`
- `toProductRowFromGrip(...)` etc. for all seven categories.

Each adapter:

1. Sets category/family enum values.
2. Copies universal fields listed above.
3. Uses a narrow `pickAttributes(normalized, ATTR_KEYS.blank)` helper so JSON only includes category fields.
4. Computes `designStudioReady` via existing readiness heuristics (tip-top readiness helper, blank coverage, etc.).

## 3. Upsert rules

- Primary identity: `(supplierId, productCode)` unique index.
- Upsert code path:
  ```ts
  await prisma.product.upsert({
    where: { supplierId_productCode: { supplierId, productCode } },
    update: mappedRow,
    create: mappedRow,
  })
  ```
- During full mirror runs, track the set of SKUs we processed; mark any existing rows for the supplier that are missing as `active=false`.
- Preserve `latestVersionId`, `status`, `publishHandle` until Step 4 integrates diff engine.

## 4. Apply loop skeleton

```
async function applyBatsonProducts(normalized: NormalizedBatsonProduct[]) {
  const supplier = await getSupplier("batson")
  const seen = new Set<string>()

  for (const item of normalized) {
    const mapped = mapNormalizedProduct(item, supplier)
    await prisma.product.upsert({
      where: { supplierId_productCode: { supplierId: supplier.id, productCode: mapped.productCode } },
      update: mapped,
      create: mapped,
    })
    seen.add(mapped.productCode)
  }

  await prisma.product.updateMany({
    where: { supplierId: supplier.id, productCode: { notIn: [...seen] }, active: true },
    data: { active: false },
  })
}
```

`mapNormalizedProduct` dispatches to the category adapters, includes `attributes`, and copies description/images in future steps.

## 5. Sample data plan

1. Export 2–3 normalized objects per category from staging normalization (use `scripts/diagnostics/batsonSourceDedupSample.ts`).
2. Run them through `mapNormalizedProduct` -> upsert into a dev DB.
3. Query `SELECT supplierId, productCode, category, family, brand, series, json_extract(attributes, '$') FROM Product WHERE supplierId = ...` to verify shape.
4. Confirm `designStudioReady` matches readiness helper output, `availability` matches normalized enum, `attributes` keys align with TS interfaces.

## 6. Next actions (implementation)

- Update Prisma schema + migration for new columns and indexes.
- Implement adapter module + apply service.
- Wire importer step to call `applyBatsonProducts` after normalization.
- Add Vitest coverage for adapters and apply logic (mock Prisma).
- Run pilot data load, capture screenshots/logs for Step 3 completion.
