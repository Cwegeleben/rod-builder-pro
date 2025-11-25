# Batson Phase 2 – Full Ingest & System Hardening

_Last updated:_ 2025-11-24

## Goals

1. Move from LIMIT-based sampling to full catalog ingestion for every Batson supplier (rod blanks, guides/tops, reel seats, grips, end-caps & gimbals, trim pieces).
2. Harden the importer so repeated runs are idempotent, performant, and stable: canonical SKUs, htmlHash short-circuiting, pricing fallbacks, and logging.
3. Guarantee pricing/spec completeness so the dataset is production-ready and safe to pipe into design-studio + staging/prod imports.
4. Produce a Phase 2 snapshot capturing evidence (counts, SQL checks, hero SKUs, cookie requirements) for sign-off.
5. Stage the information the design studio will need in Phase 3 (field coverage, normalization notes, readiness summary).

### Explicit Non-goals

- No design studio UI or workflow changes yet.
- No Shopify publish / tenant catalog pushes.
- No background scheduling / cron wiring for importer runs.
- No cross-supplier normalization (Batson-only scope).
- No large-scale importer refactors unless required for correctness.

## Work Plan

### Step 1 – Tests for Phase 1 Additions

- **`extractProductCodeFromHtml`**
  - Should return `A16BP-B` when fed a fixture containing `<p class="product-details-code">` markup.
  - Falls back to slug/hash when the product code is missing.
- **Grid→Detail pricing fallback** (optional but recommended)
  - Simulate a reel-seat grid row lacking `.price`, assert `resolveBatsonRowPrices` now injects MSRP + wholesale from detail metadata.

### Step 2 – Full Dev Ingest (no LIMIT)

Execute in this order (all with `BATSON_AUTH_COOKIE` set):

```
pnpm -s tsx scripts/preflight/ingestSeeds.ts --site-id=batson-rod-blanks
pnpm -s tsx scripts/preflight/ingestSeeds.ts --site-id=batson-guides-tops
pnpm -s tsx scripts/preflight/ingestSeeds.ts --site-id=batson-reel-seats
pnpm -s tsx scripts/preflight/ingestSeeds.ts --site-id=batson-grips
pnpm -s tsx scripts/preflight/ingestSeeds.ts --site-id=batson-end-caps-gimbals
pnpm -s tsx scripts/preflight/ingestSeeds.ts --site-id=batson-trim-pieces
```

- htmlHash ensures re-runs skip unchanged pages quickly.
- Capture logs for any fetch or Prisma errors; rerun targeted URLs if needed.
- **When parser logic changes:** run the same list once with `BYPASS_HTML_HASH=1` so cached hashes do not short-circuit new price/spec fields. Subsequent maintenance runs should keep the flag off so unchanged pages stay fast.

### Step 3 – Pricing Invariants

Run the following SQL against `prisma/dev.sqlite`:

1. **Wholesale never above MSRP**
   ```sql
   SELECT sku, priceMsrp, priceWholesale
   FROM ProductVersion
   WHERE priceWholesale > priceMsrp;
   ```
   Expect 0 rows (document exceptions if Batson truly lists wholesale > MSRP).

- _2025-11-24_: `0` rows after swapping inverted pairs via `normalizePricePair` + a one-time SQL correction.

2. **No missing price pairs**
   ```sql
   SELECT sku
   FROM ProductVersion
   WHERE (priceMsrp IS NULL OR priceWholesale IS NULL)
     AND sku NOT IN ('A16BP-B'); -- extend if other intentional exceptions arise
   ```
   - _2025-11-24_: still **623** Batson rows missing at least one value (mostly guides/tops + reel-seat accessories). They fall into two buckets:
     - legacy slug SKUs that never exposed price/availability even with the wholesale cookie (needs manual scrape confirmation).
     - new grid-derived kits where Batson omits MSRP entirely (wholesale present) — evaluate whether MSRP should be `NULL` or derived from retail site copy.
   - Breakout for visibility: `batson-reel-seats=383`, `batson-guides-tops=168`, `batson-grips=20`, `batson-end-caps-gimbals=19`, `batson-rod-blanks=17`, `batson-trim-pieces=16`.
   - Next action: sample 3–5 SKUs per bucket to confirm whether the price block is genuinely missing or if the parser is skipping an alternate selector.
3. **Canonical SKU sanity**
   ```sql
   SELECT sku
   FROM ProductVersion
   WHERE sku LIKE '%-%-%-%-%';
   ```
   Should return 0 rows after the product-code fix.

- _2025-11-24_: `batson-guides-tops` still has **119** slug-derived SKUs. Their detail pages do not expose the `<p class="product-details-code">` block, so we still fall back to slugging. Need either a guide-specific code extractor or a Supplier override mapping.

### Step 4 – Canonical Product Counts

```
SELECT supplierId, COUNT(*)
FROM Product
GROUP BY supplierId;
```

- Record counts for each Batson supplier inside the Phase 2 snapshot.
- Compare vs historical inventories; investigate large deltas.
- _2025-11-24 counts (via Supplier slug join)_:

  | Supplier slug             | Count |
  | ------------------------- | ----- |
  | `batson-reel-seats`       | 1,064 |
  | `batson-guides-tops`      | 238   |
  | `batson-grips`            | 20    |
  | `batson-end-caps-gimbals` | 20    |
  | `batson-trim-pieces`      | 20    |
  | `batson-rod-blanks`       | 20    |

### Step 5 – Phase 2 Snapshot (`docs/importer/batson-phase-2-snapshot.md`)

Include:

- Final product counts per supplier.
- Output of the three pricing invariants (copy/paste SQL + 0-row confirmation).
- List of intentional exceptions (e.g., `A16BP-B` needing cookie access, archived legacy SKUs).
- Evidence snippets/screengrabs for representative SKUs per supplier (pricing + specs).
- SQL used for validation, plus notes about the `BATSON_AUTH_COOKIE` prerequisite and htmlHash behavior.
- Confirmation that htmlHash prevented redundant processing during full ingest.
- Working document lives at `docs/importer/batson-phase-2-snapshot.md` (created 2025-11-24).

### Step 6 – Phase 3 Readiness Notes

- Enumerate ProductVersion fields required by design studio (series, length/power/action, ID/OD/length, sizes, frame material, pricing, etc.).
- Identify normalization/to-do items (color vocab, unit conversions, brand/family naming).
- Summarize outstanding gaps (if any) blocking design-studio integration.

## Checklist

### Importer Hardening

- [x] Unit test: `extractProductCodeFromHtml` (positive + fallback cases).
- [x] Unit test: grid→detail pricing fallback (series row inherits detail MSRP/wholesale).
- [ ] Confirm htmlHash prevents redundant upserts during repeated Phase 2 runs.
  - _Status 2025-11-24_: first two tests merged (`app/server/importer/preview/batsonDetailHelpers.test.ts`, `batsonAttributeGrid.unit.test.ts`). htmlHash short-circuit verified during full ingest; use `BYPASS_HTML_HASH=1` for forced refreshes.

### Full Dev Ingest

- [ ] Run six supplier ingests with no LIMIT.
- [ ] Resolve/record any fetch or Prisma errors.
- [ ] Ensure no slug-style duplicate SKUs return.
- [ ] Verify canonical replacements (e.g., `DALT20-*`, `ALUM-BUTT-*`) remain authoritative.

### Pricing Validation

- [ ] Wholesale ≤ MSRP for all rows.
- [ ] No missing price pairs (outside documented exceptions).
- [ ] Spot-check reel-seat series to confirm detail-meta fallback still works under full load.

### Data Quality Checks

- [ ] Titles & series normalized (title builder still produces expected copy).
- [ ] `normSpecs` populated with key metrics (length/power/action, ID/OD, ring sizes, etc.).
- [ ] Random spot checks across each supplier to confirm specs, pricing, and availability tags.

### Snapshot

- [ ] Write Phase 2 snapshot (counts, SQL, exceptions, evidence, cookie note, htmlHash note).
- [ ] Attach hero SKU references/screenshots per supplier.

### Phase 3 Readiness

- [ ] Document fields needed for design studio consumption.
- [ ] Capture normalization backlog (colors, materials, unit conversions).
- [ ] Draft readiness summary + dependencies for Phase 3 kickoff.
