# Design Studio Product Contract

This note captures the minimum product_db fields a Batson record needs before
`designStudioReady` can be flipped to `true`. Each category reuses the shared
fields, then adds its own readiness checklist.

## Shared fields

- `category`: canonical picker category (e.g. `blank`, `guide`).
- `family`: normalized subtype (e.g. `spinningBlank`, `castingBlank`).
- `designStudioRole`: wizard-facing role (`BLANK`, `GUIDE`, `TIP_TOP`, etc.).
- `designStudioReady`: boolean gate computed from required specs.
- `images` / `imageUrl`: at least one hero image URL.
- `msrp`: retail price the UI can show.

## Blanks-specific requirements

A blank can only be marked ready when the normalized payload includes:

- `itemTotalLengthIn`
- `power`
- `action`
- `tipOD_mm`
- `buttOD_mm`

If any of these are missing, the importer must leave `designStudioReady = false`
and surface blocking reasons in staging. Once blanks satisfy this contract end to
end we will mirror the same pattern for guides and tip tops before flipping the
Design Studio loaders over to product_db.

## Guides-specific requirements

Guides power multiple wizard roles (running, stripper, transition). To mark a
guide ready we need, in addition to the shared fields:

- `ringSize` (a numeric size or "10" style string the UI can filter on).
- `frameMaterial`
- `ringMaterial`
- `frameFinish` (e.g. polished chrome, TiChrome).
- `footStyle` (singleFoot, doubleFoot, etc.).
- `frameHeightMm` (or inches converted to mm) so the layout tool can stack
  guides correctly.

Optional enrichments (still nice-to-have for coverage notes): `recommendedRoles`
(stripper/running), `compatibility` hints (e.g. blank power ranges), and weight.

## Tip-top-specific requirements

Batson tops piggyback on the `packages/importer/src/lib/tipTop.ts`
normalization helpers so every row ships the same spec payload (`tipTop`
object) that `Design Studio` and the readiness evaluators know how to read.
For a tip top to be considered `designStudioReady` we need the following in the
normalized payload **plus** the shared fields above:

- `tubeSize` in millimeters (ID) – `normalizeTipTop` clamps/parses this value
  and stores it as `tipTop.tubeSizeMm` so contract consumers can rely on the
  same units as guides.
- `ringSize` – the gauge number that aligns with running guides and filtering.
- `frameMaterial` and `ringMaterial` – the long-form values come from
  `expandFrameMaterial` / `expandRingMaterial` so the UI can display readable
  alloys and inserts.
- `frameFinish` – chrome, TiChrome, polished, etc.
- `tipTopType` / `loopStyle` – derived from `getTipTopType` (Standard, Heavy
  Duty, Micro, Fly, etc.) and stored both as the `tipTopType` enum and a lower
  case `loopStyle` string for picker facets.
- `family` – the Master Attribute Map expects the canonical Batson families
  (`castingTipTop`, `spinningTipTop`, `flyTipTop`, `microTipTop`, `boatTipTop`,
  `rollerTipTop`). The helper exposes a `familyHint` so normalization can pin
  the correct family even when titles are sparse.
- `tipTop` spec blob – we persist the entire helper output so
  `extractTipTopReadinessContext` (and any downstream diagnostics) can read the
  exact tube/ring numbers without re-parsing raw specs.

Missing any of the above keeps `designStudioReady = false` and the apply layer
must surface blocking reasons just like blanks/guides.

## Reel seat-specific requirements

Builders need enough structured data to understand how a seat pairs with a
handle kit and blank. Batson reel seats can only be marked ready when the
normalized payload includes the following, in addition to the shared fields:

- `family` / `series` that map back to the Master Attribute Map (e.g.
  `spinningSeat`, `castingSeat`, `triggerCastingSeat`, `flySeat`).
- `designStudioRole = REEL_SEAT` so storefront roles resolve to the proper step.
- Hero image URL and MSRP.
- Bore / tube info: `insideDiameterIn` or equivalent bore ID that the builder
  can match to grip IDs.
- Exterior dimensions: `bodyOutsideDiameterIn` and `itemLengthIn` so the UI can
  flag oversized seats.
- `seatSize` (Batson’s designation, e.g. 16/17/18) plus `seatOrientation`
  (up-lock, down-lock, trigger, rail, etc.).
- `hardwareFinish` or colorway so the kit configurator can display a readable
  finish label.

If any of those are missing the importer must leave `designStudioReady = false`
for reel seats and expose the missing specs via diagnostics before publishing
to Design Studio.

## Grip-specific requirements

Handle components fuel multiple wizard roles (`handle`, `rear_grip`,
`fore_grip`). A Batson grip/handle can only flip `designStudioReady = true`
when the normalized payload includes, in addition to the shared fields:

- `category = grip` and `designStudioRole = HANDLE` so storefront roles map to
  the handle picker.
- `family` / `series` that align with the Master Attribute Map (fore grip,
  rear grip, full wells, switch, fighting butt, carbon split, etc.).
- Hero image + MSRP so the UI can show the part during selection.
- Dimensional specs the builder relies on: `itemLengthIn`, `insideDiameterIn`,
  `frontODIn`, `rearODIn`.
- Shape + placement metadata: `profileShape` (e.g. straight, tapered, full
  wells) and a discrete `gripPosition` flag (`fore`, `rear`, `full`, `butt`,
  `ice`, `switch`) so downstream steps know whether the grip fits before or
  behind the reel seat.
- Material or texture context (already provided via `material`, `texture`,
  `winnPattern`) to keep compatibility labels readable.

Grips that miss any of those required specs stay blocked with
`designStudioReady = false` until diagnostics show the missing data.

## End cap / gimbal-specific requirements

Butt caps, fighting butts, and gimbals finish the handle stack. To surface them
in Design Studio we treat them as the `BUTT_CAP` role (storefront role
`butt_cap`). Batson caps can only be marked ready when the normalized payload
includes, in addition to the shared fields:

- `category = endCap` and `designStudioRole = BUTT_CAP`.
- Family/series mapping to the Master Attribute Map (`buttCap`, `gimbal`,
  `fightingButtCap`, etc.).
- Hero image + MSRP.
- Dimensional specs builders rely on: `insideDiameterIn`, `outsideDiameterIn`,
  and either `itemLengthIn` or `endCapDepthIn` (gimbals need the depth so the
  layout tool can confirm fit under the grip).
- Style metadata: `capStyle` (buttCap vs gimbal vs fighting butt) and
  `mountInterface` (press-fit, pin, threaded) so compatibility logic can pair
  them with matching grips/blanks.
- Material context (aluminum, EVA, rubber, carbon) which already flows via the
  universal block but must be present to meet readiness.

If any of those required specs are missing, `designStudioReady` stays false and
diagnostics should call out which dimensions or style fields were absent.

## Trim / decorative component requirements

Trim hardware (winding checks, hook keepers, trim rings, decorative collars)
fills the Design Studio `COMPONENT` role. Batson trims can only be marked ready
when the normalized payload includes, alongside the shared fields:

- `category = trim` and `designStudioRole = COMPONENT` so storefront queries hit
  the component rail instead of the handle picker.
- Family/series mapping to the Master Attribute Map (`trimRing`, `decorativeTrim`,
  `windingCheck`, `hookKeeper`, etc.) so storefront filters can bucket styles.
- Hero image + MSRP.
- Dimensional specs builders rely on when pairing trims with grips/seats:
  `insideDiameterIn`, `outsideDiameterIn`, and at least one vertical dimension
  (`itemLengthIn` or `heightIn`). Without bore + OD we cannot validate fit.
- Finish cues that appear in UI labels: `plating`, `pattern`, or similar style
  tokens pulled from Batson’s catalog copy.

Missing any of the above keeps `designStudioReady = false` for trims and the
diagnostics scripts must surface which dimension/finish fields blocked
readiness.
