# Batson Target Attribute Matrix

This document captures the canonical Design Studio attribute requirements for every Batson supplier slug. Use it as the contract for importer normalization and readiness validation.

## Shared Audit Flow

1. **Raw Inputs**: Crawler output (`packages/importer/src/extractors/batson.parse.ts`) and staged `ProductSource` documents.
2. **Comparison**: For each slug, measure the percentage of SKUs that satisfy each must-have attribute group below.
3. **Coverage Logging**: Emit coverage metrics during importer runs (counts per slug + reason codes) and store mapping version used.

## Slug Requirements

### batson-rod-blanks

- **Must-have (DS Ready):**
  - Series name + model code
  - Length (feet + inches normalized)
  - Power, Action
  - Line rating min/max, Lure rating min/max (or full range)
  - Number of pieces
  - Material/family (RX7 graphite, composite, etc.)
  - Blank weight (oz)
  - Tip & butt diameters (normalized units)
  - Catalog status / availability
- **Nice-to-have:** color/finish, technique tags.

### batson-reel-seats

- **Must-have:**
  - Series/model code, seat type (spinning/casting/fly/etc.)
  - Tube/bore size (mm or inches)
  - Overall length
  - Material family
  - Compatibility tags (DS categories) + acceptable blank butt OD range
  - Grip interface type (if required)
  - Physical weight
  - Catalog status
- **Nice-to-have:** color/finish, insert type (carbon/anodized/etc.).

### batson-guides-tops

- **Must-have:**
  - Series/model code, part type (guide vs tip-top)
  - Ring size, frame height, foot type
  - Frame material + ring material
  - Tip-top only: tube ID
  - Physical weight per part
  - Catalog status
- **Nice-to-have:** guide style tags, usage hints (stripper vs running).

### batson-grips

- **Must-have:**
  - Series/model code, grip type (rear/fore/full/etc.)
  - Overall length
  - Inner bore diameter at blank end
  - Outer diameters at key points (seat interface, butt/fore ends)
  - Material family (EVA/cork/carbon/composite)
  - Profile/shape descriptor
  - Physical weight
  - Catalog status
- **Nice-to-have:** color pattern, texture, inlay notes.

### batson-end-caps-gimbals

- **Must-have:**
  - Series/model code, part type (end cap vs gimbal)
  - Inner diameter (ID) and outer diameter (OD)
  - Overall length/height
  - Material
  - Physical weight
  - Catalog status
- **Nice-to-have:** harness compatibility, color/finish codes.

### batson-trim-pieces

- **Must-have:**
  - Series/model code, trim type (winding check, trim ring, etc.)
  - Inner diameter (ID) matching blank/grip interface
  - Outer diameter envelope
  - Thickness/length
  - Material
  - Physical weight (or traceable approximation)
  - Catalog status
- **Nice-to-have:** color/plating/decorative patterns.

## Coverage Checklist

For each slug, log:

- `% coverage` per must-have field group.
- Missing-field reason codes (e.g., `MISSING_LENGTH`, `MISSING_TUBE_SIZE`).
- Sample SKU IDs where coverage fails.

These stats feed into the Batson metrics snapshot and readiness gating.
