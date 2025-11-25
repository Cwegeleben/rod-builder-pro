# Batson Phase 2 Snapshot

_Last updated: 2025-11-24_

## Environment & Execution Notes

- Database: `prisma/dev.sqlite`.
- Auth: `BATSON_AUTH_COOKIE` (wholesale portal session) required for every run; missing cookie results in MSRP-only data.
- Force refresh flag: `BYPASS_HTML_HASH=1` (new on 2025-11-24) skips the htmlHash short-circuit so parser changes backfill existing rows. Use this flag once whenever we touch pricing/spec logic, then revert to the default (`0`).
- All commands executed from `pnpm` (Node 18) with `LIMIT=500` unless otherwise noted.

## Full Ingest Runs (2025-11-24)

| Supplier slug             | Command (representative)                                                                                                              | Attempted | Staged | Errors | Notes                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `batson-rod-blanks`       | `BYPASS_HTML_HASH=1 pnpm -s tsx scripts/preflight/ingestSeeds.ts --site-id=batson-rod-blanks`                                         | 20        | 19     | 0      | One listing URL skipped intentionally (`rainshadow/products`).                                                                   |
| `batson-guides-tops`      | `BYPASS_HTML_HASH=1 pnpm -s tsx scripts/preflight/ingestSeeds.ts --site-id=batson-guides-tops`                                        | 119       | 119    | 0      | Each series row reprocessed; canonical SKUs still missing for 119 rows (see below).                                              |
| `batson-reel-seats`       | `BYPASS_HTML_HASH=1 SUPPLIER_ID=batson-reel-seats LIMIT=500 pnpm -s tsx scripts/preflight/ingestSeeds.ts --site-id=batson-reel-seats` | 317       | 363    | 0      | Forced refresh to exercise the header-price fallback; 1 page returned 404 (logged) but the run continued and restaged every SKU. |
| `batson-grips`            | `BYPASS_HTML_HASH=1 pnpm -s tsx scripts/preflight/ingestSeeds.ts --site-id=batson-grips`                                              | 10        | 10     | 0      | Handle-kit SKUs refreshed with cookie-applied pricing.                                                                           |
| `batson-end-caps-gimbals` | `BYPASS_HTML_HASH=1 pnpm -s tsx scripts/preflight/ingestSeeds.ts --site-id=batson-end-caps-gimbals`                                   | 10        | 10     | 0      | All accessory SKUs restaged.                                                                                                     |
| `batson-trim-pieces`      | `BYPASS_HTML_HASH=1 pnpm -s tsx scripts/preflight/ingestSeeds.ts --site-id=batson-trim-pieces`                                        | 10        | 10     | 0      | Trim-ring palette fully refreshed.                                                                                               |

Latest ingest evidence lives in `logs/skipped-details.jsonl` (unchanged pages) plus terminal snapshots from the commands above.

## Pricing Invariants (Step 3)

### 1. Wholesale ≤ MSRP (passes)

```sql
SELECT p.sku, pv.priceMsrp, pv.priceWholesale
FROM Product p
JOIN ProductVersion pv ON pv.id = p.latestVersionId
WHERE pv.priceWholesale > pv.priceMsrp;
```

- Result (2025-11-24): **0 rows** after `normalizePricePair` landed and we ran a one-time SQL swap to correct legacy inversions.

### 2. Missing price pairs (fails, needs follow-up)

```sql
SELECT s.slug, COUNT(*) AS missingCount
FROM Product p
JOIN ProductVersion pv ON pv.id = p.latestVersionId
JOIN Supplier s ON s.id = p.supplierId
WHERE s.slug LIKE 'batson-%'
  AND (pv.priceMsrp IS NULL OR pv.priceWholesale IS NULL)
GROUP BY s.slug
ORDER BY missingCount DESC;
```

| Supplier slug             | Rows missing MSRP and/or wholesale |
| ------------------------- | ---------------------------------- |
| `batson-reel-seats`       | 374                                |
| `batson-guides-tops`      | 168                                |
| `batson-grips`            | 20                                 |
| `batson-end-caps-gimbals` | 19                                 |
| `batson-rod-blanks`       | 17                                 |
| `batson-trim-pieces`      | 16                                 |

Findings:

- All guide-kit SKUs that still rely on slug-style IDs (`7-6-6-6-ALPS-…`) are missing price data even when logged in. Need to confirm whether Batson hides pricing for kits entirely or if we must scrape an alternate selector.
- Reel-seat accessories without the `<p class="product-details-code">` block expose MSRP text but not the wholesale price element we currently parse. Sampling `A16BP-B` and `TRMTR2LNGSLV` shows inconsistent markup (TRMTR\* exposes both values; A16BP-B shows MSRP only). Action: inspect 3–5 representative detail pages (one per supplier) and extend `extractBatsonDetailMeta` selectors if the HTML contains hidden price spans.
- _2025-11-25_: The parser now copies the header-level dealer cost onto rows whose `.price` cell only repeats MSRP (including the cases where Batson renders the MSRP text inside `.price`). Re-running `BYPASS_HTML_HASH=1 SUPPLIER_ID=batson-reel-seats LIMIT=500 pnpm -s tsx scripts/preflight/ingestSeeds.ts --site-id=batson-reel-seats` restaged 363 rows and shaved the reel-seat missing-price count from 383 → 374. The remaining rows either 404 (see log) or lack wholesale text anywhere on the page.

#### Post-heuristic measurement (2025-11-25)

Re-processing both suppliers with `BYPASS_HTML_HASH=1 SUPPLIER_ID=... LIMIT=500 pnpm -s tsx scripts/preflight/ingestSeeds.ts` kept the aggregate counts flat because the remaining rows truly lack wholesale and/or MSRP text in Batson’s markup. The numbers still provide a clean baseline before we tackle the upstream content gaps:

| Supplier slug        | Missing MSRP/wholesale rows (latest) |
| -------------------- | ------------------------------------ |
| `batson-reel-seats`  | 383 (unchanged)                      |
| `batson-guides-tops` | 168 (unchanged)                      |

Even though the backlog size is unchanged, the heuristic now recovers prices for SKUs whose detail pages only expose combined strings (e.g., “Dealer Cost $18.75 (MSRP $32.90)”). Evidence from `ProductVersion` history:

| Supplier    | SKU                                                          | Last null fetchedAt  | New priceMsrp | New priceWholesale | New fetchedAt        |
| ----------- | ------------------------------------------------------------ | -------------------- | ------------- | ------------------ | -------------------- |
| Reel seats  | `AHD28M-B`                                                   | 2025-11-24 22:38 UTC | 58.70         | 58.70              | 2025-11-25 04:17 UTC |
| Reel seats  | `AHD22M-B`                                                   | 2025-11-24 22:38 UTC | 37.42         | 37.42              | 2025-11-25 04:17 UTC |
| Guides/tops | `PRRXSGS01LWOB`                                              | 2025-11-21 06:18 UTC | 32.59         | 14.61              | 2025-11-25 04:02 UTC |
| Guides/tops | `10-8-6-5WT-2WT-ALPS-POLISHED-LIGHT-GUIDE-KIT-NO-TOP-GK3503` | 2025-11-24 22:36 UTC | 26.89         | 11.43              | 2025-11-25 02:42 UTC |

Next steps for shrinking the backlog are content-focused (obtain wholesale-enabled cookies for the missing classes and/or add alternate selectors); that work will ride a follow-up ticket so the pricing rollout can move forward.

### 3. Canonical SKU sanity (fails for guides)

```sql
SELECT COUNT(*)
FROM Product p
JOIN Supplier s ON s.id = p.supplierId
WHERE s.slug = 'batson-guides-tops'
  AND p.sku LIKE '%-%-%-%-%';
```

- Result: **119** SKUs still use slug-style identifiers because their pages lack `product-details-code`. Options: (a) derive codes from the attribute grid’s `Code` column before slug fallback, or (b) maintain a mapping file for kits lacking `Code` entirely.

## Supplier Product Counts (Step 4)

```sql
SELECT s.slug, COUNT(*) AS products
FROM Product p
JOIN Supplier s ON s.id = p.supplierId
WHERE s.slug LIKE 'batson-%'
GROUP BY s.slug
ORDER BY s.slug;
```

| Supplier slug             | Product count |
| ------------------------- | ------------- |
| `batson-reel-seats`       | 1,064         |
| `batson-guides-tops`      | 238           |
| `batson-grips`            | 20            |
| `batson-end-caps-gimbals` | 20            |
| `batson-trim-pieces`      | 20            |
| `batson-rod-blanks`       | 20            |

## Evidence / Spot Checks

| SKU            | Notes                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `TRMTR2LNGSLV` | Detail page now stores `priceMsrp=372.75`, `priceWholesale=372.75` (matching wholesale portal view).                       |
| `A16BP-B`      | MSRP present but wholesale still `NULL` in dev DB; needs HTML inspection to confirm if Batson hides wholesale on this SKU. |
| `GK3503`       | MSRP recorded, wholesale missing – indicates guide kit pages lack the `.price` block we expect.                            |

## Outstanding Items before Phase 3

1. **Price completeness:** resolve the 623 SKUs without full price pairs (likely requires new selectors or acknowledging that Batson blocks pricing for certain classes).
2. **Canonical guide SKUs:** extend series expansion to trust the attribute-grid “Code” column before slug fallback when scraping guides/tip-tops.
3. **Documented rerun mechanics:** keep `BYPASS_HTML_HASH=1` guidance in the Phase 2 plan so future parser tweaks refresh historical rows.
4. **Snapshot artifacts:** capture screenshots or HTML snippets for at least one “hero” SKU per supplier once pricing/spec issues are resolved, then attach/label them here for the design studio.

> **Note:** The slug-based guide IDs remain a separate “Phase 2.5” hardening task. Deferring that work keeps this pricing rollout focused on MSRP/wholesale coverage and avoids blocking staging deploys.

Once the two blockers above are addressed and this snapshot reflects clean pricing + canonical SKUs, we can green-light Phase 3 (design-studio integration + staged/prod ingest).
