# Batson Phase 1 Snapshot (2025-11-24)

## Pricing logic recap

- Added `resolveBatsonRowPrices` fallback wired through `scripts/preflight/ingestSeeds.ts` so MSRP/wholesale now flow from detail metadata when grid rows omit price cells.
- Cached `extractBatsonDetailMeta` per page to avoid redundant DOM work; single-product path now inherits availability notes and MSRP.
- Unit coverage lives in `app/server/importer/preview/parsers/batsonAttributeGrid.unit.test.ts` to guard the fallback against regressions.

## Ingest evidence

- Re-ran `pnpm -s tsx scripts/preflight/ingestSeeds.ts` with `SUPPLIER_ID=batson-reel-seats LIMIT=10` plus targeted URL overrides:
  - AES exposed spin (silver/black/cobalt), AT trigger, BUB trolling butt, SHA shims, BUL skeleton, RA801 fly seats, AHD machined series.
  - New slug coverage for `DALT20-*` and `ALUM-BUTT-SHORT-CURVED-50-80-*`.
- Supplier sweeps (LIMIT=10) completed for `batson-grips`, `batson-end-caps-gimbals`, and `batson-trim-pieces`; each run staged all 10 entries without errors.

## SQL verification

```
-- Reel seats with missing MSRP/wholesale (post-archive)
select p.sku, pv.priceMsrp, pv.priceWholesale
from Product p
join ProductVersion pv on pv.id = p.latestVersionId
where p.supplierId = 'f509b3b0-4c6f-4bb7-b32b-a7f5d0a81799'
  and (pv.priceMsrp is null or pv.priceWholesale is null)
order by p.sku;
```

_Result: 0 rows after ingesting `A16BP-B` with a wholesale-enabled cookie and archiving obsolete slugs._

```
-- Supplier sweeps sanity checks
select count(*)
from Product p
join ProductVersion pv on pv.id = p.latestVersionId
where p.supplierId = '<supplier-id>'
  and (pv.priceMsrp is null or pv.priceWholesale is null);
```

- `batson-grips` (`47f68198-f56c-4fc8-9fe4-b386c46127f1`): 0
- `batson-end-caps-gimbals` (`a5f3437b-e314-4d8c-8f0d-93705d5bf466`): 0
- `batson-trim-pieces` (`61dc326d-2aee-4b52-ad34-f86318d6d144`): 0

## Legacy SKU handling

- Archived the obsolete slug variants after repeated 404s:
  - `17-ALUMINUM-DOUBLE-TRIGGER-REEL-SEAT-BLACK-DALT20-B`
  - `17-ALUMINUM-DOUBLE-TRIGGER-REEL-SEAT-SILVER-DALT20-S`
  - `2-ALUM-TROLLING-BUTT-SHORT-CURVED-BLACK-BUBS4C-B`
  - `2-ALUM-TROLLING-BUTT-SHORT-CURVED-SILVER-BUBS4C-S`
- Each now carries status `ARCHIVED`, `latestVersionId = NULL`, and title suffix "(unavailable at source)" so reporting scripts can ignore them.

## Known edge cases

- `A16BP-B` requires a wholesale-enabled Batson session; without the `.ASPXAUTH` cookie the page hides wholesale pricing and the ingest falls back to MSRP-only.
- When a Batson page returns 404, rerunning the ingest script automatically marks the SKU as unavailable; keep the old URL in `ProductSource` for auditability.
- Detail pages that share a slug but change the variant list (e.g., AES/AT/ALUM) should be restaged with `URLS="...,..."` to trigger the fallback before archiving anything.

## Next actions

1. Obtain a wholesale-enabled Batson cookie (or direct API response) for `A16BP-B` and rerun ingest so wholesale pricing lands.
2. Normalize catalog references to the new `20-ALUMINUM-…` and `ALUM-BUTT…` SKUs inside downstream systems (merch, publish jobs).
3. Extend this verification pattern to rod blanks and guides when Phase 2 kicks off.
