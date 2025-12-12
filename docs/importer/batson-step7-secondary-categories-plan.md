# Batson Step 7 · Secondary Categories Plan

Step 7 tracks the Design Studio enablement work for the remaining Batson
categories (reel seats, grips/handles, trim, end caps, accessories). Each
vertical follows the same checklist:

1. Define/extend the Design Studio contract (what makes a SKU ready?).
2. Emit the required normalized fields + hero/price in the importer.
3. Ensure `applyBatsonProducts` writes Product + ProductVersion rows with the new
   readiness logic.
4. Backfill/diagnose existing rows and capture evidence (SQL + API payloads).

## Tracking table

| Category    | Status      | Notes                                                               |
| ----------- | ----------- | ------------------------------------------------------------------- |
| Reel seats  | ✅ complete | Ready rows + ProductVersion evidence captured 2025-12-11.           |
| Grips       | ✅ complete | Ready rows + ProductVersion + options evidence captured 2025-12-11. |
| Trim        | ✅ complete | Ready trims + component evidence captured 2025-12-11.               |
| End caps    | ✅ complete | Ready rows + ProductVersion + options evidence captured 2025-12-11. |
| Accessories | ⏳ queued   | Requires storefront role split (hook keepers vs decals).            |

## Reel seats (Step 7a)

**Contract summary**

- Role: `REEL_SEAT`, storefront alias `reel_seat`.
- Required fields: family/series, seat size, bore ID (inside diameter), body OD,
  length, orientation (up-lock/down-lock/trigger/etc.), finish/material, hero
  image, MSRP.
- Compatibility metadata: store bore + size inside `Product.attributes` and the
  ProductVersion snapshot so downstream tooling can filter by tube size.

**Importer tasks**

- [x] Normalization emits `category = reelSeat`, `designStudioRole = REEL_SEAT`,
      hero image URL, and structured specs (seat size, bore ID, OD, orientation,
      finish, weight, insert material, thread spec). Bore/OD fallback to the
      seat size (mm) so every row has deterministic compatibility dimensions.
- [x] `applyBatsonProducts` reuses the shared ProductVersion writer plus the
      reel seat readiness gate + compatibility payload.
- [x] Diagnostics script reuses `reapplyBatsonBlanks.ts` with
      `TARGET_CATEGORY=reelseat` to backfill seats.
- [x] Evidence doc captures SQL + `/api/design-studio/options` output for the
      `reel_seat` role.

**Verification commands (as of 2025-12-11)**

```bash
SUPPLIER_SLUG=batson \
  SUPPLIER_SITE_ID=batson-reel-seats \
  TARGET_CATEGORY=reelseat \
  npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts

sqlite3 prisma/dev.sqlite "SELECT p.id, p.sku, p.designStudioReady, p.latestVersionId FROM Product p JOIN Supplier s ON p.supplierId = s.id WHERE s.slug = 'batson-reel-seats' AND p.designStudioReady = 1;"

DESIGN_STUDIO_V1=1 PRODUCT_DB_ENABLED=1 \
  DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
  npx tsx scripts/diagnostics/dumpDesignStudioOptions.ts reel_seat

Result snapshot: 1 ready Batson reel seat (`ALPS-TRIGGER-SEAT-MH`) now feeds the
`reel_seat` role with hero imagery + price from product_db.
```

## Grips (Step 7b)

**Contract summary**

- Role: `HANDLE` (storefront role `handle`, future-friendly for `rear_grip`
  and `fore_grip`).
- Required fields: family/series, hero image, MSRP, dimensions (length,
  inside diameter, front OD, rear OD), shape, and placement flag
  (`gripPosition`).
- Compatibility metadata: surface length + IDs in `Product.attributes` and the
  ProductVersion snapshot so layout tools can match grips to seats/blank IDs.

**Importer tasks**

- [x] Normalization emits `category = grip`, `designStudioRole = HANDLE`, hero
      image URL, and structured specs including `gripPosition`.
- [x] `applyBatsonProducts` reuses readiness gate + ProductVersion writer to
      capture handle compatibility in `designStudioCompatibility`.
- [x] Diagnostics reuse `reapplyBatsonBlanks.ts` with `TARGET_CATEGORY=grip`
      and capture SQL + `/api/design-studio/options handle` output.

**Verification commands (2025-12-11)**

```bash
SUPPLIER_SLUG=batson \
  SUPPLIER_SITE_ID=batson-grips \
  TARGET_CATEGORY=grip \
  DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
  npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts

sqlite3 prisma/dev.sqlite "SELECT sku, designStudioReady, latestVersionId FROM Product WHERE category = 'grip' ORDER BY sku;"

DESIGN_STUDIO_V1=1 PRODUCT_DB_ENABLED=1 \
  DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
  npx tsx scripts/diagnostics/dumpDesignStudioOptions.ts handle
```

Result snapshot: two Batson grips (`FG-3.5-CORK`, `SG-8.5-EVA`) now publish with
`designStudioReady = 1`, non-null `latestVersionId`, hero imagery, and the
`handle` role returns `count = 2` with the Forecast cork fore grip as the sample
payload.

## Trim pieces (Step 7c)

**Contract summary**

- Role: `COMPONENT` (storefront role `component`).
- Required fields: family/series (trim ring, winding check, hook keeper, etc.),
  hero image, MSRP, dimensional specs (`insideDiameterIn`, `outsideDiameterIn`,
  plus `itemLengthIn` or `heightIn`), and finish metadata (`plating`,
  `pattern`, or equivalent catalog descriptors).
- Compatibility metadata: persist ID/OD/length inside `Product.attributes` and
  the ProductVersion snapshot so trims can be filtered by bore and stack
  height.

**Importer tasks**

- [x] Normalization emits `category = trim`, `designStudioRole = COMPONENT`,
      hero image URL, and structured specs (ID/OD/length/plating/pattern).
- [x] `applyBatsonProducts` enforces the new readiness gate for trims and
      writes trim dimensions into the ProductVersion compatibility payload.
- [x] Unit tests cover one ready trim record and one blocked record that lacks
      dimensions.
- [x] Diagnostics: targeted `reapplyBatsonBlanks.ts` run with
      `TARGET_CATEGORY=trim`, sqlite verification, and
      `/api/design-studio/options component` snapshot.

**Verification commands (2025-12-11)**

```bash
SUPPLIER_SLUG=batson \
  SUPPLIER_SITE_ID=batson-trim-pieces \
  TARGET_CATEGORY=trim \
  DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
  npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts

sqlite3 prisma/dev.sqlite "SELECT sku, designStudioReady, latestVersionId FROM Product WHERE category = 'trim' ORDER BY sku;"

DESIGN_STUDIO_V1=1 PRODUCT_DB_ENABLED=1 \
  DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
  npx tsx scripts/diagnostics/dumpDesignStudioOptions.ts component
```

Result snapshot: two Batson trims (`ALPS-TRIM-RING-XL`, `FORECAST-HOOK-KEEPER`)
now publish with `designStudioReady = 1`, populated `latestVersionId`
pointers, compatibility payloads (ID/OD/length + finish) and surface under the
`component` role with live imagery and MSRP.

## End caps & gimbals (Step 7d)

**Contract summary**

- Role: `BUTT_CAP` (storefront role `butt_cap`).
- Required fields: family/series, hero image, MSRP, bore (`insideDiameterIn`),
  `outsideDiameterIn`, and either `itemLengthIn` or `endCapDepthIn` so the UI
  can confirm stack height. Style metadata (`capStyle`, `mountInterface`) keeps
  gimbals separate from flat caps/fighting butts.
- Compatibility metadata: persist the ID/OD/depth/style fields inside
  `Product.attributes` and `designStudioCompatibility` so downstream logic can
  match caps to rear grip IDs and blank diameters.

**Importer tasks**

- [x] Normalization emits `category = endCap`, `designStudioRole = BUTT_CAP`,
      hero image URL, and structured specs (ID/OD/depth/style/material/isGimbal).
- [x] `applyBatsonProducts` gates readiness on the new contract and extends the
      ProductVersion writer to save butt-cap compatibility payloads.
- [x] Diagnostics reuse `reapplyBatsonBlanks.ts` with
      `TARGET_CATEGORY=endcap` (see importer category mapping) and capture
      `/api/design-studio/options butt_cap` output.

**Verification commands (2025-12-11)**

```bash
DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
SUPPLIER_SLUG=batson SUPPLIER_SITE_ID=batson-end-caps-gimbals TARGET_CATEGORY=endcap \
npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts

sqlite3 prisma/dev.sqlite "SELECT sku, designStudioReady, latestVersionId FROM Product WHERE category = 'endCap' ORDER BY sku;"

DESIGN_STUDIO_V1=1 PRODUCT_DB_ENABLED=1 \
DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
npx tsx scripts/diagnostics/dumpDesignStudioOptions.ts butt_cap
```

Result snapshot: `ALPS-BUTT-CAP-XL` and `ALPS-GIMBAL-CAP-L` now publish with
`designStudioReady = 1`, hero images, dimension-rich compatibility payloads, and
the `butt_cap` storefront role returns `count = 4` (two Batson caps plus two
legacy handle fallbacks) with ALPS Aluminum Butt Cap XL as the sample option.

## Upcoming categories

Add the same contract + verification notes for accessories once the trim work
ships.
