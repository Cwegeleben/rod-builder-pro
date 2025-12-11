# Batson Attribute Matrix

> This file defines the canonical normalized shape for all Batson product categories used by the importer and Design Studio. All normalizers must obey these required and optional fields.

## Universal Attribute Standard

All Batson records share the following base fields. Required everywhere unless noted.

- `brand` (string) – RainShadow, Alps, Forecast, etc. Auto-detected from SKU/title.
- `series` (string) – Batson marketing series or sub-line.
- `family` (category specific enum) – see each section.
- `material` (string) – dominant material or construction call-out.
- `productCode` (string) – canonical SKU/externalId.
- `msrp?` (number) – manufacturer retail price.
- `availability?` (`'inStock' | 'outOfStock' | 'discontinued' | 'preorder'`) – normalized state.
- `color?` (string) – primary finish/colorway descriptor.

Normalizers may include additional shared helpers (e.g., `notes`, `images`, `specVersion`). Those must never replace the required core above.

---

## Category 1 — Rod Blanks

**Families**: `spinningBlank`, `castingBlank`, `flyBlank`, `surfBlank`, `saltwaterBlank`, `centerPinBlank`, `iceBlank`, `glassBlank`, `compositeBlank`, `trollingBlank`.

**Required Attributes**

- `itemTotalLengthIn` (number) – finished blank length in inches.
- `numberOfPieces` (number) – piece count (1 for one-piece).
- `power` (string) – UL/L/ML/M/MH/H/XH codes.
- `action` (string) – XF/F/MF/M/SF/etc.
- `application` (string[]) – free-form DS technique tags (kokanee, fly, trolling...)
- `blankType` (string) – marketing call-out (mag bass, popping, switch, etc.).
- `materialConstruction` (string) – e.g., RX7 Graphite, RX10 HM, Glass Composite.
- `lineRating` (string) – normalized min–max (e.g., `6-12 lb`).
- `lureRating` (string) – normalized min–max oz text.
- `tipOD_mm` (number) – tip outside diameter in millimeters.
- `buttOD_mm` (number) – butt diameter in millimeters.
- `blankWeightOz` (number).

**Optional Attributes**

- `intrinsicPower_g?`, `actionAngle_deg?`, `ern?` – CCS metrics when provided.
- `tenInDiameter_mm?`, `twentyInDiameter_mm?`, `thirtyInDiameter_mm?` – large OD checkpoints.
- `finish?`, `notes?`, `suitableFor?` (string[] of target species/platform).

---

## Category 2 — Guides (incl. Kits)

**Families**: `singleFootGuide`, `doubleFootGuide`, `flyGuide`, `castingBoatGuide`, `microGuide`, `rollerGuide`, `guideKit`.

**Required Attributes**

- `frameMaterial` (string) + `frameMaterialCode?` when shorthand (SS316, TI, etc.).
- `frameFinish` (string) – polished, PVD TiChrome, black, etc.
- `ringMaterial` (string) + `ringMaterialCode?`.
- `ringSize` (number) – running ring integer.
- `tubeSize?` (number) – only for combo/transition hardware that includes a tube.
- `footType` (string) – single, double, micro, slotted.
- `height_mm` (number) – centerline height.
- `weightOz` (number).
- `kitContents?` (array) – required when `family === 'guideKit'` (list of SKUs/size counts).

**Optional Attributes**

- `footLength_mm?`, `frameProfile?`, `usageHints?` (stripper vs running), `color?`.

---

## Category 3 — Tip Tops

**Families**: `castingTipTop`, `spinningTipTop`, `flyTipTop`, `rollerTipTop`, `microTipTop`, `boatTipTop`.

**Required Attributes**

- `frameMaterial`/`frameMaterialCode` and `frameFinish`.
- `ringMaterial`/`ringMaterialCode`.
- `tubeSize` (number, 1.0 – 10.0 mm, 0.1 increments).
- `ringSize` (number).
- `tipTopType` (`'Standard' | 'Heavy Duty' | 'Medium Duty' | 'Boat' | 'Fly' | 'Micro'`).
- `displayName` (string) – builder-facing label from the title helper.

**Optional Attributes**

- `weightOz?`, `height_mm?`, `notes?`, `pricingTier?`.

---

## Category 4 — Grips

**Families**: `splitGrip`, `rearGrip`, `foreGrip`, `fullWells`, `halfWells`, `fightingButt`, `switchGrip`, `carbonSplitGrip`, `carbonRearGrip`, `winnGrip`, `iceGrip`.

**Required Attributes**

- `itemLengthIn` (number).
- `insideDiameterIn` (number) – bore at blank interface.
- `frontODIn` (number) – OD at reel seat side.
- `rearODIn` (number) – OD at butt end.
- `profileShape` (string) – e.g., “full wells”, “tapered rear”.
- `material` (string) – cork/EVA/Winn/carbon/composite.
- `productCode`, `brand`, `series`, `family` from universal block.

**Optional Attributes**

- `weight_g?`, `urethaneFilled?` (boolean), `winnPattern?`, `texture?`, `notes?`.

---

## Category 5 — Reel Seats

**Families**: `spinningSeat`, `castingSeat`, `triggerCastingSeat`, `flySeat`, `trollingSeat`, `saltwaterSeat`, `iceSeat`, `railSeat`.

**Required Attributes**

- `seatSize` (string) – seat code, e.g., `16`, `17`, `UL3`.
- `itemLengthIn` (number).
- `insideDiameterIn` (number) – bore/tube ID.
- `bodyOutsideDiameterIn` (number).
- `material` (string) – graphite, aluminum, carbon insert, etc.
- `seatOrientation` (`'upLock' | 'downLock' | 'trigger' | 'pistol'`).
- `productCode`, `brand`, `series`, `family`.

**Optional Attributes**

- `hoodOutsideDiameterIn?`, `insertMaterial?`, `threadSpec?`, `hardwareFinish?`, `weightOz?`.

---

## Category 6 — Trim + Decorative Pieces

**Families**: `trimRing`, `pipeExtension`, `windingCheck`, `lockingRing`, `hookKeeper`, `decorativeTrim`, `buttWrap`, `carbonTube`.

**Required Attributes**

- `itemLengthIn` (number) – or height for rings.
- `insideDiameterIn` (number).
- `outsideDiameterIn` (number).
- `material` (string).
- `productCode`, `brand`, `series`, `family`.

**Optional Attributes**

- `heightIn?`, `weightOz?`, `plating?`, `pattern?`, `notes?`.

---

## Category 7 — End Caps & Gimbals

**Families**: `buttCap`, `rubberCap`, `evaCap`, `pvcCap`, `fightingButtCap`, `gimbal`, `aluminumCap`, `carbonButtCap`.

**Required Attributes**

- `itemLengthIn` (number) – or depth when inline.
- `insideDiameterIn` (number).
- `outsideDiameterIn` (number).
- `material` (string) – EVA, rubber, anodized aluminum, carbon.
- `family` (enum above) + `productCode`, `brand`, `series`.

**Optional Attributes**

- `endCapDepthIn?`, `weightOz?`, `hardwareInterface?`, `color?`, `notes?`.

---

## Coverage Checklist

1. Every Batson SKU must map to one (and only one) category/family.
2. All required fields above must be present prior to Design Studio readiness gating.
3. Universal attributes must never be omitted or null.
4. Optional fields should be populated whenever the scraper or upstream data exposes them; missing optional data should be logged for diagnostics rather than blocking readiness.
5. Importer instrumentation must log coverage per category and highlight any SKU that fails validation (`MISSING_TUBE_SIZE`, `INVALID_FAMILY`, etc.).
