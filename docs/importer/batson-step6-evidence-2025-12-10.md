# Batson Step 6 Evidence — 2025-12-10

## SupplierSyncState snapshot

| Supplier slug | Status  | Last sync (ms) | Last sync (UTC)          | Summary job/run                            |
| ------------- | ------- | -------------- | ------------------------ | ------------------------------------------ |
| batson        | success | 1765409393030  | 2025-12-10T23:29:53.030Z | jobId=6b489509-29d3-4587-b148-9fcb99ba1ca7 |
| batson-smoke  | applied | 1765349866562  | 2025-12-10T06:57:46.562Z | runId=cmiznqat40007s8dbk3h3o5lr            |

> Notes
>
> - `batson` reflects the multi-category importer execution from the CLI runner.
> - `batson-smoke` is still the only supplier slug with applied product_db rows.

## Last sync summaries

### Supplier `batson`

```json
{
  "jobId": "6b489509-29d3-4587-b148-9fcb99ba1ca7",
  "startedBy": "cli-runner",
  "startedAt": "2025-12-10T23:29:53.030Z",
  "finishedAt": "2025-12-11T03:01:13.188Z",
  "suppliers": [
    {
      "slug": "batson-rod-blanks",
      "status": null,
      "ok": true,
      "startedAt": "2025-12-11T03:00:01.982Z",
      "finishedAt": "2025-12-11T03:00:15.933Z",
      "durationMs": 13941,
      "error": null,
      "summary": {
        "diff": {
          "runId": "cmj0uopmj033ts8vwfbbr22y0",
          "counts": { "adds": 0, "changes": 0, "deletes": 0 },
          "totals": { "existing": 0, "staging": 0 }
        }
      }
    },
    {
      "slug": "batson-reel-seats",
      "status": null,
      "ok": true,
      "startedAt": "2025-12-11T03:00:15.935Z",
      "finishedAt": "2025-12-11T03:00:31.434Z",
      "durationMs": 15493,
      "error": null,
      "summary": {
        "diff": {
          "runId": "cmj0up1l4033us8vwh4uum1ut",
          "counts": { "adds": 0, "changes": 0, "deletes": 0 },
          "totals": { "existing": 0, "staging": 0 }
        }
      }
    },
    {
      "slug": "batson-guides-tops",
      "status": null,
      "ok": true,
      "startedAt": "2025-12-11T03:00:31.435Z",
      "finishedAt": "2025-12-11T03:00:46.835Z",
      "durationMs": 15394,
      "error": null,
      "summary": {
        "diff": {
          "runId": "cmj0updgy033vs8vws877n7w7",
          "counts": { "adds": 0, "changes": 0, "deletes": 0 },
          "totals": { "existing": 0, "staging": 0 }
        }
      }
    },
    {
      "slug": "batson-grips",
      "status": null,
      "ok": true,
      "startedAt": "2025-12-11T03:00:46.837Z",
      "finishedAt": "2025-12-11T03:00:49.199Z",
      "durationMs": 2358,
      "error": null,
      "summary": {
        "diff": {
          "runId": "cmj0upfam033ws8vwfgrg158s",
          "counts": { "adds": 0, "changes": 0, "deletes": 0 },
          "totals": { "existing": 0, "staging": 0 }
        }
      }
    },
    {
      "slug": "batson-end-caps-gimbals",
      "status": null,
      "ok": true,
      "startedAt": "2025-12-11T03:00:49.200Z",
      "finishedAt": "2025-12-11T03:01:01.104Z",
      "durationMs": 11899,
      "error": null,
      "summary": {
        "diff": {
          "runId": "cmj0upohb033xs8vwh9h0g0jd",
          "counts": { "adds": 0, "changes": 0, "deletes": 0 },
          "totals": { "existing": 0, "staging": 0 }
        }
      }
    },
    {
      "slug": "batson-trim-pieces",
      "status": null,
      "ok": true,
      "startedAt": "2025-12-11T03:01:01.105Z",
      "finishedAt": "2025-12-11T03:01:12.590Z",
      "durationMs": 11479,
      "error": null,
      "summary": {
        "diff": {
          "runId": "cmj0upxcc033ys8vwfr3xke45",
          "counts": { "adds": 0, "changes": 0, "deletes": 0 },
          "totals": { "existing": 0, "staging": 0 }
        }
      }
    }
  ],
  "discovery": [
    {
      "slug": "batson-rod-blanks",
      "url": "https://batsonenterprises.com/rod-blanks",
      "ok": true,
      "durationMs": 2761450,
      "stagedCount": 60,
      "headerSkipCount": 4,
      "error": null
    },
    {
      "slug": "batson-reel-seats",
      "url": "https://batsonenterprises.com/reel-seats",
      "ok": true,
      "durationMs": 5384629,
      "stagedCount": 25,
      "headerSkipCount": 0,
      "error": null
    },
    {
      "slug": "batson-guides-tops",
      "url": "https://batsonenterprises.com/guides-tip-tops",
      "ok": true,
      "durationMs": 1384863,
      "stagedCount": 25,
      "headerSkipCount": 0,
      "error": null
    },
    {
      "slug": "batson-grips",
      "url": "https://batsonenterprises.com/grips",
      "ok": true,
      "durationMs": 33455,
      "stagedCount": 1,
      "headerSkipCount": 0,
      "error": null
    },
    {
      "slug": "batson-end-caps-gimbals",
      "url": "https://batsonenterprises.com/end-caps-gimbals",
      "ok": true,
      "durationMs": 1517846,
      "stagedCount": 25,
      "headerSkipCount": 0,
      "error": null
    },
    {
      "slug": "batson-trim-pieces",
      "url": "https://batsonenterprises.com/trim-pieces",
      "ok": true,
      "durationMs": 1526700,
      "stagedCount": 25,
      "headerSkipCount": 0,
      "error": null
    }
  ],
  "postProcessing": {
    "designStudioBackfill": {
      "ok": true,
      "durationMs": 596,
      "error": null,
      "summary": null
    }
  }
}
```

### Supplier `batson-smoke`

```json
{
  "runId": "cmiznqat40007s8dbk3h3o5lr",
  "supplierSlug": "batson-smoke",
  "totals": { "adds": 1, "changes": 1, "deletes": 1 },
  "summary": {
    "source": "ui-smoke-script",
    "apply": {
      "appliedAt": "2025-12-10T06:57:46.562Z",
      "actor": null,
      "counts": {
        "addsAttempted": 1,
        "addsApplied": 1,
        "changesAttempted": 1,
        "changesApplied": 1,
        "deletesAttempted": 1,
        "deletesApplied": 1
      },
      "errors": []
    }
  }
}
```

## Catalog counts for Design Studio

### Total catalog rows per supplier (Product table)

| Supplier slug           | Total products |
| ----------------------- | -------------- |
| batson                  | 6              |
| batson-end-caps-gimbals | 46             |
| batson-grips            | 4              |
| batson-guides-tops      | 32             |
| batson-reel-seats       | 29             |
| batson-rod-blanks       | 28             |
| batson-smoke            | 3              |
| batson-trim-pieces      | 47             |

### `designStudioReady = 1` coverage

| Supplier slug | Ready products |
| ------------- | -------------- |
| batson        | 6              |
| batson-smoke  | 2              |

### Role coverage (Product.designStudioRole)

| Role    | Ready products |
| ------- | -------------- |
| BLANK   | 4              |
| GUIDE   | 1              |
| TIP_TOP | 1              |
| (null)  | 2              |

### Ready product detail

| Product ID                | Title                                   | Supplier slug | Role    |
| ------------------------- | --------------------------------------- | ------------- | ------- |
| cmj0zi1gq0001s8irvbgzbbed | Rainshadow Eternity RX10 7'6" MH-F      | batson        | BLANK   |
| cmj0zi1gs0003s8ir7vb834wj | Rainshadow Immortal 7'2" M              | batson        | BLANK   |
| cmj0zi1gt0005s8irxkhwgzaq | Rainshadow Revelation 7'0" ML           | batson        | BLANK   |
| cmj0zi1gv0007s8ir0ndl7y8q | Rainshadow Revelation 7'6" H            | batson        | BLANK   |
| cmj0zi7fx0001s8ol1l11fvrz | ALPS MXN Size 5 Single Foot Guide       | batson        | GUIDE   |
| cmj1vyoqc0001s8nl86qhz1mt | ALPS Titanium Size 6 / 5.5 Tube Tip Top | batson        | TIP_TOP |
| cmiznqasy0004s8db4uh505xi | Smoke QA Guide Change                   | batson-smoke  | (null)  |
| cmiznqatb000cs8dbnykhekf3 | Smoke QA Guide Add                      | batson-smoke  | (null)  |

## Batson blank readiness snapshot (2025-12-10)

```
SUPPLIER_SLUG=batson SUPPLIER_SITE_ID=batson-rod-blanks TARGET_CATEGORY=blank npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts
[reapplyBatsonBlanks] upserts=4 applied=4 category=blank
```

### Ready blank specs now persisted in Product.attributes

| SKU                | Title                              | Role  | Length (in) | Power | Action | Tip (mm) | Butt (mm) |
| ------------------ | ---------------------------------- | ----- | ----------- | ----- | ------ | -------- | --------- |
| RS-ETERNITY-76MH   | Rainshadow Eternity RX10 7'6" MH-F | BLANK | 90          | MH    | F      | 4.5      | 13.72     |
| RS-IMMORTAL-72M    | Rainshadow Immortal 7'2" M         | BLANK | 86          | M     | MF     | 4.2      | 12.7      |
| RS-REVELATION-70ML | Rainshadow Revelation 7'0" ML      | BLANK | 84          | ML    | MF     | 4        | 12.19     |
| RS-REVELATION-76H  | Rainshadow Revelation 7'6" H       | BLANK | 90          | H     | F      | 5        | 15.24     |

Example hero image + attributes payload for `RS-ETERNITY-76MH`:

```
sqlite3 prisma/dev.sqlite "SELECT sku, images FROM Product WHERE sku='RS-ETERNITY-76MH';"
RS-ETERNITY-76MH|["https://cdn.rbp.dev/samples/rs-eternity-76mh.jpg"]

sqlite3 prisma/dev.sqlite "SELECT attributes FROM Product WHERE id='cmj0zi1gq0001s8irvbgzbbed';"
{"itemTotalLengthIn":90,"numberOfPieces":1,"power":"MH","action":"F","application":["Bass","Freshwater"],"blankType":"blank","materialConstruction":"Composite","lineRating":"","lureRating":"","tipOD_mm":4.5,"buttOD_mm":13.72,"blankWeightOz":1.9,"finish":"Matte Clear","suitableFor":["Bass","Freshwater"]}

```

## Batson guide readiness snapshot (2025-12-10)

```
SUPPLIER_SLUG=batson SUPPLIER_SITE_ID=batson-guides-tops TARGET_CATEGORY=guide npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts
[reapplyBatsonBlanks] upserts=2 applied=2 category=guide
```

### Ready guide specs now persisted in Product.attributes

| SKU        | Title                             | Role  | Ring size | Frame material      | Frame finish | Foot style | Height (mm) |
| ---------- | --------------------------------- | ----- | --------- | ------------------- | ------------ | ---------- | ----------- |
| ALPS-MXN-5 | ALPS MXN Size 5 Single Foot Guide | GUIDE | 5         | 316 Stainless Steel | TiChrome     | single     | 15.2        |

Example hero image + attributes payload for `ALPS-MXN-5`:

```
sqlite3 prisma/dev.sqlite "SELECT sku, images FROM Product WHERE sku='ALPS-MXN-5';"
ALPS-MXN-5|["https://cdn.rbp.dev/samples/alps-mxn-guide-5.jpg"]

sqlite3 prisma/dev.sqlite "SELECT attributes FROM Product WHERE id='cmj0zi7fx0001s8ol1l11fvrz';"
{"frameMaterial":"316 Stainless Steel","frameMaterialCode":"SS316","frameFinish":"TiChrome","ringMaterial":"Silicon Carbide","ringMaterialCode":"SIC","ringSize":5,"footType":"single","height_mm":15.2,"weightOz":0.05}
```

```

## Batson tip-top readiness snapshot (2025-12-10)

```

SUPPLIER_SLUG=batson SUPPLIER_SITE_ID=batson-guides-tops TARGET_CATEGORY=tiptop npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts
[reapplyBatsonBlanks] upserts=1 applied=1 category=tiptop

```

### Ready tip-top specs now persisted in Product.attributes

| SKU                    | Title                                   | Role    | Ring size | Tube size (mm) | Frame material | Ring material   | Loop style |
| ---------------------- | --------------------------------------- | ------- | --------- | -------------- | -------------- | --------------- | ---------- |
| ALPS-TITANIUM-TOP-6-55 | ALPS Titanium Size 6 / 5.5 Tube Tip Top | TIP_TOP | 6         | 5.5            | Titanium       | Silicon Carbide | standard   |

Example hero image + attributes payload for `ALPS-TITANIUM-TOP-6-55`:

```

sqlite3 prisma/dev.sqlite "SELECT sku, images FROM Product WHERE sku='ALPS-TITANIUM-TOP-6-55';"
ALPS-TITANIUM-TOP-6-55|["https://cdn.rbp.dev/samples/alps-titanium-tip-top.jpg"]

sqlite3 prisma/dev.sqlite "SELECT attributes FROM Product WHERE sku='ALPS-TITANIUM-TOP-6-55';"
{"frameMaterial":"Titanium","frameMaterialCode":"TI","frameFinish":"Polished","ringMaterial":"Silicon Carbide","ringMaterialCode":"SIC","ringSize":6,"tubeSize":5.5,"tipTopType":"Standard","loopStyle":"standard","displayName":"Standard Tip Top Titanium 5.5 Tube – Silicon Carbide 6 Ring","height_mm":28,"tipTop":{"tipTopType":"Standard","familyHint":"spinningTipTop","loopStyle":"standard","frameMaterialCode":"TI","frameMaterialLong":"Titanium","ringMaterialCode":"SIC","ringMaterialLong":"Silicon Carbide","tubeSizeMm":5.5,"ringSize":6,"title":"Standard Tip Top Titanium 5.5 Tube – Silicon Carbide 6 Ring"}}

```

## Batson end cap readiness snapshot (2025-12-11)

```

DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
SUPPLIER_SLUG=batson SUPPLIER_SITE_ID=batson-end-caps-gimbals TARGET_CATEGORY=endcap \
npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts
[reapplyBatsonBlanks] upserts=2 applied=2 category=endcap

```

### Ready end-cap specs now persisted in Product.attributes

| SKU                | Title                          | Role      | Length (in) | Depth (in) | ID (in) | OD (in) | Style        | Interface |
| ------------------ | ------------------------------ | --------- | ----------- | ---------- | ------- | ------- | ------------ | --------- |
| ALPS-BUTT-CAP-XL   | ALPS Aluminum Butt Cap XL      | BUTT_CAP  | 2.0         | 1.1        | 0.85    | 1.5     | aluminumCap  | press-fit |
| ALPS-GIMBAL-CAP-L  | ALPS Aluminum Gimbal Cap Large | BUTT_CAP  | 2.5         | 1.2        | 0.9     | 1.6     | gimbal       | Pin-Lock  |

Example hero image + attributes payloads:

```

sqlite3 prisma/dev.sqlite "SELECT sku, images FROM Product WHERE sku='ALPS-BUTT-CAP-XL';"
ALPS-BUTT-CAP-XL|["https://cdn.rbp.dev/samples/alps-butt-cap-xl.jpg"]

sqlite3 prisma/dev.sqlite "SELECT attributes FROM Product WHERE sku='ALPS-BUTT-CAP-XL';"
{"itemLengthIn":2,"insideDiameterIn":0.85,"outsideDiameterIn":1.5,"endCapDepthIn":1.1,"capStyle":"aluminumCap","isGimbal":false,"hardwareInterface":"press-fit"}

sqlite3 prisma/dev.sqlite "SELECT sku, images FROM Product WHERE sku='ALPS-GIMBAL-CAP-L';"
ALPS-GIMBAL-CAP-L|["https://cdn.rbp.dev/samples/alps-gimbal-cap-large.jpg"]

sqlite3 prisma/dev.sqlite "SELECT attributes FROM Product WHERE sku='ALPS-GIMBAL-CAP-L';"
{"itemLengthIn":2.5,"insideDiameterIn":0.9,"outsideDiameterIn":1.6,"endCapDepthIn":1.2,"weightOz":1.2,"capStyle":"gimbal","isGimbal":true,"hardwareInterface":"Pin-Lock"}

```

ProductVersion compatibility payloads now include the cap dimensions + style metadata:

```

sqlite3 prisma/dev.sqlite "SELECT pv.id, pv.designStudioCompatibility FROM ProductVersion pv JOIN Product p ON pv.id = p.latestVersionId WHERE p.sku = 'ALPS-BUTT-CAP-XL';"
cmj23zfqw0007s8zvk2jbbaej|{"lengthIn":null,"power":null,"action":null,"finish":"Anodized Blue","rodPieces":null,"categories":["component","butt_cap","alps aluminum"],"itemLengthIn":2,"endCapDepthIn":1.1,"insideDiameterIn":0.85,"outsideDiameterIn":1.5,"capStyle":"aluminumCap","isGimbal":false,"mountInterface":"press-fit"}

sqlite3 prisma/dev.sqlite "SELECT pv.id, pv.designStudioCompatibility FROM ProductVersion pv JOIN Product p ON pv.id = p.latestVersionId WHERE p.sku = 'ALPS-GIMBAL-CAP-L';"
cmj23zfqq0003s8zvbwmnk8w5|{"lengthIn":null,"power":null,"action":null,"finish":"Silver","rodPieces":null,"categories":["component","butt_cap","gimbal"],"itemLengthIn":2.5,"endCapDepthIn":1.2,"insideDiameterIn":0.9,"outsideDiameterIn":1.6,"capStyle":"gimbal","isGimbal":true,"mountInterface":"Pin-Lock"}

```

`/api/design-studio/options butt_cap` now surfaces the ready caps (still falling back to handle data if needed):

```

DESIGN_STUDIO_V1=1 PRODUCT_DB_ENABLED=1 DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
npx tsx scripts/diagnostics/dumpDesignStudioOptions.ts butt_cap
{
"role": "butt_cap",
"count": 4,
"sample": {
"id": "cmj23zfqt0005s8zv07b1nr81",
"productId": "cmj23zfqt0005s8zv07b1nr81",
"role": "butt_cap",
"title": "ALPS Aluminum Butt Cap XL",
"vendor": "Batson Enterprises",
"sku": "ALPS-BUTT-CAP-XL",
"price": 24,
"specs": [
{
"label": "Finish",
"value": "Anodized Blue"
}
],
"imageUrl": "https://cdn.rbp.dev/samples/alps-butt-cap-xl.jpg",
"ready": true
}
}

```

## ProductVersion Backfill and PRODUCT_DB Options Validation (2025-12-11)

### Backfill script + SQL verification

```

DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" FORCE_REFRESH=1 \
 npx tsx scripts/diagnostics/backfillBatsonProductVersions.ts

```

`telemetry` summary:

```

{
"telemetry": "backfillBatsonProductVersions",
"inspected": 6,
"updated": 6,
"forceRefresh": true,
"skippedNoStaging": 0,
"skippedNoNormSpecs": 0,
"sample": {
"id": "cmj0zi1gq0001s8irvbgzbbed",
"sku": "RS-ETERNITY-76MH",
"latestVersionId": "cmj1zxurp0001s8g32ajgh714"
}
}

```

SQL check (every ready Batson row now holds a version pointer):

```

sqlite3 prisma/dev.sqlite "SELECT p.id, p.sku, p.designStudioReady, p.latestVersionId
FROM Product p JOIN Supplier s ON p.supplierId = s.id
WHERE s.slug = 'batson' AND p.designStudioReady = 1;"

cmj0zi7fx0001s8ol1l11fvrz|ALPS-MXN-5|1|cmj1zxus50009s8g3fv1pp9kq
cmj1vyoqc0001s8nl86qhz1mt|ALPS-TITANIUM-TOP-6-55|1|cmj1zxus7000bs8g3xr9n4po4
cmj0zi1gq0001s8irvbgzbbed|RS-ETERNITY-76MH|1|cmj1zxurp0001s8g32ajgh714
cmj0zi1gs0003s8ir7vb834wj|RS-IMMORTAL-72M|1|cmj1zxurv0003s8g3abnlxjla
cmj0zi1gt0005s8irxkhwgzaq|RS-REVELATION-70ML|1|cmj1zxury0005s8g3210ozvd8
cmj0zi1gv0007s8ir0ndl7y8q|RS-REVELATION-76H|1|cmj1zxus10007s8g3j0mg3c97

```

### PRODUCT_DB options API validation

```

DESIGN_STUDIO_V1=1 PRODUCT_DB_ENABLED=1 \
 DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
 npx tsx scripts/diagnostics/dumpDesignStudioOptions.ts blank guide tip_top

```

Results:

| Role   | Count | Sample payload (truncated) |
| ------ | ----- | -------------------------- |
| blank  | 4     | `{ "title": "Rainshadow Revelation 7'6\" H", "sku": "RS-REVELATION-76H", "subtitle": "H · F", "imageUrl": "https://cdn.rbp.dev/samples/rs-revelation-76h.jpg" }` |
| guide  | 1     | `{ "title": "ALPS MXN Size 5 Single Foot Guide", "sku": "ALPS-MXN-5", "price": 5, "imageUrl": "https://cdn.rbp.dev/samples/alps-mxn-guide-5.jpg" }` |
| tip_top | 1    | `{ "title": "ALPS Titanium Size 6 / 5.5 Tube Tip Top", "sku": "ALPS-TITANIUM-TOP-6-55", "price": 13, "imageUrl": "https://cdn.rbp.dev/samples/alps-titanium-tip-top.jpg" }` |

All three roles now return non-zero counts populated from `Product.latestVersion` instead of mock data, matching the hero imagery documented above.

## Step 7 evidence · Reel seats (2025-12-11)

### Targeted apply + SQL

```

DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
 SUPPLIER_SLUG=batson \
 SUPPLIER_SITE_ID=batson-reel-seats \
 TARGET_CATEGORY=reelseat \
 npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts

sqlite3 prisma/dev.sqlite "SELECT sku, designStudioReady, latestVersionId
FROM Product WHERE category = 'reelSeat' ORDER BY sku;"

ALPS-TRIGGER-SEAT-MH|1|cmj21jlns0003s8kijp7smdvb

```

Attributes + hero image for the ready SKU:

```

sqlite3 prisma/dev.sqlite "SELECT images, attributes FROM Product WHERE sku='ALPS-TRIGGER-SEAT-MH';"
["https://cdn.rbp.dev/samples/alps-trigger-seat-mh.jpg"]
{"seatSize":"16","itemLengthIn":4.5,"insideDiameterIn":0.63,"bodyOutsideDiameterIn":0.83,"seatOrientation":"trigger","hardwareFinish":"Black"}

```

### PRODUCT_DB options payload (role = reel_seat)

```

DESIGN_STUDIO_V1=1 PRODUCT_DB_ENABLED=1 \
 DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
 npx tsx scripts/diagnostics/dumpDesignStudioOptions.ts reel_seat

```

Result snapshot:

| Role      | Count | Sample payload |
| --------- | ----- | -------------- |
| reel_seat | 1     | `{ "title": "ALPS Trigger Seat Medium-Heavy", "sku": "ALPS-TRIGGER-SEAT-MH", "price": 34, "imageUrl": "https://cdn.rbp.dev/samples/alps-trigger-seat-mh.jpg" }` |

The reel seat role now pulls live product_db data (designStudioReady = 1 with
`latestVersionId` populated) and surfaces the hero imagery + finish metadata
called out in the Step 7 plan.

## Step 7 evidence · Grips (2025-12-11)

### Targeted apply + SQL

```

DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
 SUPPLIER_SLUG=batson \
 SUPPLIER_SITE_ID=batson-grips \
 TARGET_CATEGORY=grip \
 npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts

sqlite3 prisma/dev.sqlite "SELECT sku, designStudioReady, latestVersionId
FROM Product WHERE category = 'grip' ORDER BY sku;"

ALPS-CARBON-GRIP-L|0|cmj21xbff0003s82r25uq84f7
FG-3.5-CORK|1|cmj22rpy60007s8by8eyv2bka
SG-8.5-EVA|1|cmj22rpxy0003s8byl8sx8ju3

```

Sample attributes + hero for the rear grip:

```

sqlite3 prisma/dev.sqlite "SELECT sku, images, attributes FROM Product WHERE sku='SG-8.5-EVA';"
SG-8.5-EVA|["https://cdn.rbp.dev/samples/forecast-sg-8-5.jpg"]|{"itemLengthIn":8.5,"insideDiameterIn":0.25,"frontODIn":0.9,"rearODIn":1,"profileShape":"split","gripPosition":"rear","weight_g":28,"urethaneFilled":false}

```

`ProductVersion` compatibility snapshot confirms the handle metadata flows into
`designStudioCompatibility`:

```

sqlite3 prisma/dev.sqlite "SELECT id, designStudioCompatibility FROM ProductVersion WHERE productId = (SELECT id FROM Product WHERE sku='SG-8.5-EVA') ORDER BY createdAt DESC LIMIT 1;"
cmj22rpxy0003s8byl8sx8ju3|{"lengthIn":null,"power":null,"action":null,"finish":null,"rodPieces":null,"categories":["handle","forecast"],"itemLengthIn":8.5,"insideDiameterIn":0.25,"frontODIn":0.9,"rearODIn":1,"gripPosition":"rear","profileShape":"split"}

```

### PRODUCT_DB options payload (role = handle)

```

DESIGN_STUDIO_V1=1 PRODUCT_DB_ENABLED=1 \
 DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
 npx tsx scripts/diagnostics/dumpDesignStudioOptions.ts handle

```

Result snapshot:

| Role   | Count | Sample payload |
| ------ | ----- | -------------- |
| handle | 2     | `{ "title": "Forecast FG-3.5 Cork Fore Grip", "sku": "FG-3.5-CORK", "price": 10, "imageUrl": "https://cdn.rbp.dev/samples/forecast-fg-3-5.jpg" }` |

Two Batson grips (Forecast cork fore + EVA rear) now return via the `handle`
role with populated `latestVersionId`, compatibility payload (length + IDs +
gripPosition), and hero imagery sourced from staging.

## Step 7 evidence · Trim pieces (2025-12-11)

### Targeted apply + SQL

```

DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
 SUPPLIER_SLUG=batson \
 SUPPLIER_SITE_ID=batson-trim-pieces \
 TARGET_CATEGORY=trim \
 npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts

sqlite3 prisma/dev.sqlite "SELECT sku, designStudioReady, latestVersionId
FROM Product WHERE category = 'trim' ORDER BY sku;"

ALPS-TRIM-RING-XL|1|cmj24yiwa0003s8b2ir6zn8mz
FORECAST-HOOK-KEEPER|1|cmj2511dy0003s855subpg9fo

```

Both Batson trim SKUs now report `designStudioReady = 1` with non-null
`latestVersionId` pointers.

### Compatibility snapshot

```

sqlite3 prisma/dev.sqlite "SELECT pv.id, p.sku, pv.designStudioCompatibility
FROM ProductVersion pv JOIN Product p ON pv.id = p.latestVersionId
WHERE p.category = 'trim' ORDER BY p.sku;"

cmj24yiwa0003s8b2ir6zn8mz|ALPS-TRIM-RING-XL|{"lengthIn":null,"power":null,"action":null,"finish":null,"rodPieces":null,"categories":["component","trim ring"],"itemLengthIn":0.5,"heightIn":0.3,"insideDiameterIn":0.75,"outsideDiameterIn":1.1,"plating":"TiChrome","pattern":"Knurled"}
cmj2511dy0003s855subpg9fo|FORECAST-HOOK-KEEPER|{"lengthIn":null,"power":null,"action":null,"finish":null,"rodPieces":null,"categories":["component","hook keeper"],"itemLengthIn":0.65,"heightIn":0.25,"insideDiameterIn":0.4,"outsideDiameterIn":0.8,"plating":"Polished Chrome","pattern":"Smooth"}

```

`designStudioCompatibility` now carries the trim ID/OD/length data plus finish
metadata so downstream filters can match stack height and plating.

### PRODUCT_DB options payload (role = component)

```

DESIGN_STUDIO_V1=1 PRODUCT_DB_ENABLED=1 \
 DATABASE_URL="file:/Users/cwegeleben/rbp-app/prisma/dev.sqlite" \
 npx tsx scripts/diagnostics/dumpDesignStudioOptions.ts component

{
"role": "component",
"count": 2,
"sample": {
"id": "cmj24yiw60001s8b25tti3b3k",
"productId": "cmj24yiw60001s8b25tti3b3k",
"role": "component",
"title": "ALPS Trim Ring XL",
"vendor": "Batson Enterprises",
"sku": "ALPS-TRIM-RING-XL",
"price": 7,
"specs": [],
"imageUrl": "https://cdn.rbp.dev/samples/alps-trim-ring-xl.jpg",
"ready": true
}
}

```

`/api/design-studio/options component` now serves two Batson trim pieces with
real imagery + pricing backed by Product DB instead of placeholder data.

## Next steps

1. **Step 6 ✅ – lock today’s evidence** – PRODUCT_DB-backed blanks/guides/tip tops now power `/api/design-studio/options`; no further Step 6 work remains beyond regression coverage.
2. **Plan Step 7 (secondary components)** – Follow the new plan in `docs/importer/batson-step7-secondary-categories-plan.md` to tackle grips, reel seats, trim, and caps.
3. **Regression + release checklist** – Re-run unit + e2e + importer smoke suites, then push the staging/prod deploy plan (Prisma migrate + Fly/Shopify releases) referencing this document.

## Source queries

```

sqlite3 prisma/dev.sqlite "SELECT supplierSlug, lastSyncAt, lastSyncStatus FROM SupplierSyncState;"
sqlite3 prisma/dev.sqlite "SELECT json(lastSyncSummary) FROM SupplierSyncState WHERE supplierSlug='batson';"
sqlite3 prisma/dev.sqlite "SELECT json(lastSyncSummary) FROM SupplierSyncState WHERE supplierSlug='batson-smoke';"
sqlite3 prisma/dev.sqlite "SELECT s.slug, COUNT(_) FROM Product p JOIN Supplier s ON p.supplierId = s.id GROUP BY s.slug ORDER BY s.slug;"
sqlite3 prisma/dev.sqlite "SELECT s.slug, COUNT(_) FROM Product p JOIN Supplier s ON p.supplierId = s.id WHERE p.designStudioReady = 1 GROUP BY s.slug ORDER BY s.slug;"
sqlite3 prisma/dev.sqlite "SELECT COALESCE(designStudioRole,'(null)'), COUNT(\*) FROM Product WHERE designStudioReady = 1 GROUP BY designStudioRole;"
sqlite3 prisma/dev.sqlite "SELECT p.id, p.title, s.slug, p.designStudioRole FROM Product p JOIN Supplier s ON p.supplierId = s.id WHERE p.designStudioReady = 1 ORDER BY p.title;"
sqlite3 prisma/dev.sqlite "SELECT sku, title, designStudioRole, json_extract(attributes,'$.itemTotalLengthIn') AS lengthInches, json_extract(attributes,'$.power') AS power, json_extract(attributes,'$.action') AS action, json_extract(attributes,'$.tipOD_mm') AS tipMm, json_extract(attributes,'$.buttOD_mm') AS buttMm FROM Product WHERE designStudioReady=1 AND designStudioRole='BLANK' ORDER BY title;"
sqlite3 prisma/dev.sqlite "SELECT sku, designStudioReady FROM Product WHERE designStudioRole='GUIDE';"
sqlite3 prisma/dev.sqlite "SELECT sku, images FROM Product WHERE sku='RS-ETERNITY-76MH';"
sqlite3 prisma/dev.sqlite "SELECT attributes FROM Product WHERE id='cmj0zi1gq0001s8irvbgzbbed';"
sqlite3 prisma/dev.sqlite "SELECT sku, images FROM Product WHERE sku='ALPS-MXN-5';"
sqlite3 prisma/dev.sqlite "SELECT attributes FROM Product WHERE id='cmj0zi7fx0001s8ol1l11fvrz';"
sqlite3 prisma/dev.sqlite "SELECT sku, designStudioReady FROM Product WHERE designStudioRole='TIP_TOP';"
sqlite3 prisma/dev.sqlite "SELECT sku, images FROM Product WHERE sku='ALPS-TITANIUM-TOP-6-55';"
sqlite3 prisma/dev.sqlite "SELECT attributes FROM Product WHERE sku='ALPS-TITANIUM-TOP-6-55';"
SUPPLIER_SLUG=batson SUPPLIER_SITE_ID=batson-rod-blanks TARGET_CATEGORY=blank npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts
SUPPLIER_SLUG=batson SUPPLIER_SITE_ID=batson-guides-tops TARGET_CATEGORY=guide npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts
SUPPLIER_SLUG=batson SUPPLIER_SITE_ID=batson-guides-tops TARGET_CATEGORY=tiptop npx tsx scripts/diagnostics/reapplyBatsonBlanks.ts

```

```
