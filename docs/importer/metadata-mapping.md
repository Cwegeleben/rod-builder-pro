# Importer → Shopify Metafield Mapping (Batson rod blanks)

This document describes how the importer maps normalized/spec fields from Batson rod blanks into Shopify product attributes using metafields.

## Namespaces and keys

- Namespace `rbp_spec` (discrete attributes):

  - Stored exclusively as `single_line_text_field` strings (no numeric or list metafield types)
  - Required core keys: `series`, `length_in`, `pieces`
  - Canonical additional keys (Batson rod blanks): `color`, `action`, `power`, `material`, `line_lb`, `lure_oz`, `weight_oz`, `butt_dia_in`, `tip_top_size`, `applications`, `ten_in_dia`, `twenty_in_dia`, `thirty_in_dia`
  - Range decompositions (`*_min` / `*_max`) were removed in favor of the friendly combined strings (`line_lb`, `lure_oz`)
  - Unknown keys from normalized specs are sanitized and included as additional `rbp_spec.*` entries when string-like

- Namespace `rbp` (JSON + linkage + diagnostics):
  - `rbp.specs` (type `json`): Full normalized specs (subject to size budget)
  - `rbp.unknown_spec_keys` (type `json`): Array of additional spec keys emitted to `rbp_spec.*`
  - `rbp.supplier_external_id` (`single_line_text_field`): Pattern-safe token of the source externalId
  - `rbp.hash` (`single_line_text_field`): Content hash of mapped payload; dropped if blank
  - `rbp.specs_full_hash` (`single_line_text_field`): Hash of full specs when `rbp.specs` was truncated to a summary
  - `rbp.image_sources` (type `json`): Internal memory of previously imported image URLs
  - `rbp.delete_mark` (`single_line_text_field`): Set to `1` when a product was archived by header classification or delete override

## Handles, tags, and identity

- Deterministic product handle: `rbp-<supplierId>-<externalId>`
- Tag: `importRun:<runId>` for grouping products created/updated during a run
- Linkage uses both handle and `rbp.supplier_external_id`

## Required keys and headers

- For real products, `rbp_spec.series`, `rbp_spec.length_in`, `rbp_spec.pieces` are always emitted
- For series/category header rows (non-products), the importer detects and archives/skips them; these are excluded from spec validation and may not have discrete `rbp_spec.*` keys

## Sanitization and budgets

- All `rbp_spec.*` values are strings and trimmed to ≤255 chars with newlines removed
- Array source values are joined with `, ` into a single string
- Keys are lowercased, non-alphanumerics replaced with `_`, leading digits prefixed (e.g., `10_in_dia` → `x_10_in_dia`)
- `rbp.supplier_external_id` is coerced to a safe token matching store regex (alnum, `-`, `_`)
- `rbp.hash` is dropped when empty to avoid 422 errors
- `rbp.specs` JSON is size-budgeted (default 80KB); when truncated, a summary is saved and `rbp.specs_full_hash` is written

## Verification

- Verify locates products by handle and by `importRun:<runId>` tag; falls back to scanning metafields for `rbp.supplier_external_id`
- Spec completeness:
  - Checks `rbp_spec.series`, `rbp_spec.length_in`, `rbp_spec.pieces`
  - If missing, falls back to checking values inside `rbp.specs` JSON
  - Series headers are excluded from spec-missing counts

## Rate limits and retries

- Shopify Admin calls are retried with exponential backoff on 429s; diagnostics include retry counts and wait time
- Metafield writes that hit store-specific regex are retried with sanitized `patternSafe` values

## Known behaviors

- On unchanged `rbp.hash`, importer still backfills missing `rbp_spec.*` for Batson products and records skipReason `unchanged-specs-backfilled`
- Images are deduped by `rbp.image_sources` metafield to avoid re-uploading

## How to inspect on a run

- Enriched debug (compact core):

  - `GET /api/importer/runs/{runId}/debug?hq=1&metas=1&_data=routes%2Fapi.importer.runs.%24runId.debug`

- Full metafields listing for each product (including all `rbp_spec.*`):
  - `GET /api/importer/runs/{runId}/debug?hq=1&metas=full`

Notes:

- `hq=1` requires an authenticated HQ admin session; omit it if hitting the route from a logged-in admin context

## Example (SU1569F-M)

- `rbp_spec` core: `series=RX7`, `length_in=156`, `pieces=2`, `action=Mod-Fast`, `power=X-Heavy`, `material=RX7-Graphite`
- `rbp.specs`: full normalized JSON present
- `rbp.unknown_spec_keys`: present (store-specific extras beyond the standard set)

## Adjacent improvements

- Consider generalizing header detection patterns as more non-product rows are observed
- Optional: map popular attributes into Shopify native product fields or tags for storefront filtering (beyond metafields)
