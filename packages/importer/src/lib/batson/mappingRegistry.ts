import type { Prisma } from '@prisma/client'

export const BATSON_SLUGS = [
  'batson-rod-blanks',
  'batson-reel-seats',
  'batson-guides-tops',
  'batson-grips',
  'batson-end-caps-gimbals',
  'batson-trim-pieces',
] as const

export type BatsonSlug = (typeof BATSON_SLUGS)[number]

export type BatsonReasonCode =
  | 'MISSING_SERIES'
  | 'MISSING_LENGTH'
  | 'MISSING_POWER'
  | 'MISSING_ACTION'
  | 'MISSING_LINE_RANGE'
  | 'MISSING_LURE_RANGE'
  | 'MISSING_PIECES'
  | 'MISSING_MATERIAL'
  | 'MISSING_WEIGHT'
  | 'MISSING_TIP_DIAMETER'
  | 'MISSING_BUTT_DIAMETER'
  | 'MISSING_STATUS'
  | 'MISSING_SEAT_TYPE'
  | 'MISSING_TUBE_SIZE'
  | 'MISSING_OVERALL_LENGTH'
  | 'MISSING_COMPATIBILITY'
  | 'MISSING_RING_SIZE'
  | 'MISSING_FRAME_HEIGHT'
  | 'MISSING_FOOT_TYPE'
  | 'MISSING_FRAME_MATERIAL'
  | 'MISSING_RING_MATERIAL'
  | 'MISSING_TUBE_ID'
  | 'MISSING_INNER_DIAMETER'
  | 'MISSING_OUTER_DIAMETER'
  | 'MISSING_PROFILE'
  | 'MISSING_PART_TYPE'

export type BatsonFieldCategory =
  | 'dimensions'
  | 'performance'
  | 'materials'
  | 'compatibility'
  | 'classification'
  | 'status'
  | 'weight'

export type BatsonFieldSpec = {
  id: string
  label: string
  category: BatsonFieldCategory
  reasonCode: BatsonReasonCode
  required: boolean
  description: string
}

export type BatsonMappingVersion = `v${number}`

export type BatsonMappingConfig = {
  slug: BatsonSlug
  version: BatsonMappingVersion
  partType: 'blank' | 'seat' | 'guide' | 'tip_top' | 'grip' | 'trim' | 'end_cap'
  requiredFields: BatsonFieldSpec[]
  niceToHaveFields?: BatsonFieldSpec[]
}

export const BATSON_MAPPING_REGISTRY: Record<BatsonSlug, BatsonMappingConfig> = {
  'batson-rod-blanks': {
    slug: 'batson-rod-blanks',
    version: 'v1',
    partType: 'blank',
    requiredFields: [
      {
        id: 'series',
        label: 'Series + model code',
        category: 'classification',
        reasonCode: 'MISSING_SERIES',
        required: true,
        description: 'Series name and blank model identifier',
      },
      {
        id: 'length',
        label: 'Length (ft/in)',
        category: 'dimensions',
        reasonCode: 'MISSING_LENGTH',
        required: true,
        description: 'Normalize to total inches but retain ft/in breakdown',
      },
      {
        id: 'power',
        label: 'Power',
        category: 'performance',
        reasonCode: 'MISSING_POWER',
        required: true,
        description: 'Canonical DS power enum derived from Batson spec',
      },
      {
        id: 'action',
        label: 'Action',
        category: 'performance',
        reasonCode: 'MISSING_ACTION',
        required: true,
        description: 'Fast/Moderate/Slow etc.',
      },
      {
        id: 'line_rating',
        label: 'Line rating (min/max)',
        category: 'performance',
        reasonCode: 'MISSING_LINE_RANGE',
        required: true,
        description: 'Record both min and max in lbs',
      },
      {
        id: 'lure_rating',
        label: 'Lure rating (range)',
        category: 'performance',
        reasonCode: 'MISSING_LURE_RANGE',
        required: true,
        description: 'Minimum and maximum lure weight',
      },
      {
        id: 'pieces',
        label: '# Pieces',
        category: 'classification',
        reasonCode: 'MISSING_PIECES',
        required: true,
        description: 'Number of rod sections',
      },
      {
        id: 'material',
        label: 'Material / family',
        category: 'materials',
        reasonCode: 'MISSING_MATERIAL',
        required: true,
        description: 'RX7 graphite, composite, etc.',
      },
      {
        id: 'weight',
        label: 'Blank weight (oz)',
        category: 'weight',
        reasonCode: 'MISSING_WEIGHT',
        required: true,
        description: 'Physical blank weight in ounces',
      },
      {
        id: 'tip_dia',
        label: 'Tip diameter',
        category: 'dimensions',
        reasonCode: 'MISSING_TIP_DIAMETER',
        required: true,
        description: 'Tip diameter normalized to mm or inches',
      },
      {
        id: 'butt_dia',
        label: 'Butt diameter',
        category: 'dimensions',
        reasonCode: 'MISSING_BUTT_DIAMETER',
        required: true,
        description: 'Butt diameter normalized to mm or inches',
      },
      {
        id: 'status',
        label: 'Catalog status',
        category: 'status',
        reasonCode: 'MISSING_STATUS',
        required: true,
        description: 'Availability flag (active/discontinued)',
      },
    ],
    niceToHaveFields: [
      {
        id: 'finish',
        label: 'Finish / color',
        category: 'materials',
        reasonCode: 'MISSING_PART_TYPE',
        required: false,
        description: 'Optional finish descriptor for visual cues',
      },
    ],
  },
  'batson-reel-seats': {
    slug: 'batson-reel-seats',
    version: 'v1',
    partType: 'seat',
    requiredFields: [
      {
        id: 'series',
        label: 'Series + model code',
        category: 'classification',
        reasonCode: 'MISSING_SERIES',
        required: true,
        description: 'Series name and seat model identifier',
      },
      {
        id: 'seat_type',
        label: 'Seat type',
        category: 'classification',
        reasonCode: 'MISSING_SEAT_TYPE',
        required: true,
        description: 'Spinning, casting, fly, trigger, skeleton, etc.',
      },
      {
        id: 'tube_size',
        label: 'Tube / bore size',
        category: 'dimensions',
        reasonCode: 'MISSING_TUBE_SIZE',
        required: true,
        description: 'Normalize to mm and inches',
      },
      {
        id: 'overall_length',
        label: 'Overall length',
        category: 'dimensions',
        reasonCode: 'MISSING_OVERALL_LENGTH',
        required: true,
        description: 'Physical length of seat',
      },
      {
        id: 'material',
        label: 'Material family',
        category: 'materials',
        reasonCode: 'MISSING_MATERIAL',
        required: true,
        description: 'Graphite, aluminum, carbon insert, etc.',
      },
      {
        id: 'compatibility',
        label: 'Compatibility tags',
        category: 'compatibility',
        reasonCode: 'MISSING_COMPATIBILITY',
        required: true,
        description: 'Categories + acceptable butt ODs',
      },
      {
        id: 'weight',
        label: 'Seat weight',
        category: 'weight',
        reasonCode: 'MISSING_WEIGHT',
        required: true,
        description: 'Physical seat weight in oz or grams',
      },
      {
        id: 'status',
        label: 'Catalog status',
        category: 'status',
        reasonCode: 'MISSING_STATUS',
        required: true,
        description: 'Availability flag',
      },
    ],
  },
  'batson-guides-tops': {
    slug: 'batson-guides-tops',
    version: 'v1',
    partType: 'guide',
    requiredFields: [
      {
        id: 'series',
        label: 'Series + model code',
        category: 'classification',
        reasonCode: 'MISSING_SERIES',
        required: true,
        description: 'Series and part identifier',
      },
      {
        id: 'part_type',
        label: 'Part type',
        category: 'classification',
        reasonCode: 'MISSING_PART_TYPE',
        required: true,
        description: 'Guide vs tip-top',
      },
      {
        id: 'ring_size',
        label: 'Ring size',
        category: 'dimensions',
        reasonCode: 'MISSING_RING_SIZE',
        required: true,
        description: 'Ring ID/size normalized',
      },
      {
        id: 'frame_height',
        label: 'Frame height',
        category: 'dimensions',
        reasonCode: 'MISSING_FRAME_HEIGHT',
        required: true,
        description: 'Canonical frame height measure',
      },
      {
        id: 'foot_type',
        label: 'Foot type',
        category: 'classification',
        reasonCode: 'MISSING_FOOT_TYPE',
        required: true,
        description: 'Single-foot, double-foot, micro, etc.',
      },
      {
        id: 'frame_material',
        label: 'Frame material',
        category: 'materials',
        reasonCode: 'MISSING_FRAME_MATERIAL',
        required: true,
        description: 'Frame material composition',
      },
      {
        id: 'ring_material',
        label: 'Ring material',
        category: 'materials',
        reasonCode: 'MISSING_RING_MATERIAL',
        required: true,
        description: 'Ring insert material',
      },
      {
        id: 'tube_id',
        label: 'Tube ID (tip-tops)',
        category: 'dimensions',
        reasonCode: 'MISSING_TUBE_ID',
        required: true,
        description: 'Tube inner diameter (tip tops only)',
      },
      {
        id: 'weight',
        label: 'Component weight',
        category: 'weight',
        reasonCode: 'MISSING_WEIGHT',
        required: true,
        description: 'Per-part weight',
      },
      {
        id: 'status',
        label: 'Catalog status',
        category: 'status',
        reasonCode: 'MISSING_STATUS',
        required: true,
        description: 'Availability flag',
      },
    ],
  },
  'batson-grips': {
    slug: 'batson-grips',
    version: 'v1',
    partType: 'grip',
    requiredFields: [
      {
        id: 'series',
        label: 'Series + model code',
        category: 'classification',
        reasonCode: 'MISSING_SERIES',
        required: true,
        description: 'Series + grip identifier',
      },
      {
        id: 'grip_type',
        label: 'Grip type',
        category: 'classification',
        reasonCode: 'MISSING_PART_TYPE',
        required: true,
        description: 'Rear, fore, full, split, etc.',
      },
      {
        id: 'length',
        label: 'Overall length',
        category: 'dimensions',
        reasonCode: 'MISSING_LENGTH',
        required: true,
        description: 'Length in inches/mm',
      },
      {
        id: 'inner_diameter',
        label: 'Inner diameter',
        category: 'dimensions',
        reasonCode: 'MISSING_INNER_DIAMETER',
        required: true,
        description: 'Bore size at blank end',
      },
      {
        id: 'outer_diameter',
        label: 'Outer diameters',
        category: 'dimensions',
        reasonCode: 'MISSING_OUTER_DIAMETER',
        required: true,
        description: 'OD at key interface points',
      },
      {
        id: 'material',
        label: 'Material family',
        category: 'materials',
        reasonCode: 'MISSING_MATERIAL',
        required: true,
        description: 'EVA, cork, carbon, etc.',
      },
      {
        id: 'profile',
        label: 'Profile / shape',
        category: 'classification',
        reasonCode: 'MISSING_PROFILE',
        required: true,
        description: 'Tapered, full wells, split, etc.',
      },
      {
        id: 'weight',
        label: 'Grip weight',
        category: 'weight',
        reasonCode: 'MISSING_WEIGHT',
        required: true,
        description: 'Weight in oz/grams',
      },
      {
        id: 'status',
        label: 'Catalog status',
        category: 'status',
        reasonCode: 'MISSING_STATUS',
        required: true,
        description: 'Availability flag',
      },
    ],
  },
  'batson-end-caps-gimbals': {
    slug: 'batson-end-caps-gimbals',
    version: 'v1',
    partType: 'end_cap',
    requiredFields: [
      {
        id: 'series',
        label: 'Series + model code',
        category: 'classification',
        reasonCode: 'MISSING_SERIES',
        required: true,
        description: 'Series + part identifier',
      },
      {
        id: 'part_type',
        label: 'Part type',
        category: 'classification',
        reasonCode: 'MISSING_PART_TYPE',
        required: true,
        description: 'End cap vs gimbal',
      },
      {
        id: 'inner_diameter',
        label: 'Inner diameter',
        category: 'dimensions',
        reasonCode: 'MISSING_INNER_DIAMETER',
        required: true,
        description: 'ID matching rear grip or blank',
      },
      {
        id: 'outer_diameter',
        label: 'Outer diameter',
        category: 'dimensions',
        reasonCode: 'MISSING_OUTER_DIAMETER',
        required: true,
        description: 'OD at key interface',
      },
      {
        id: 'length',
        label: 'Length / height',
        category: 'dimensions',
        reasonCode: 'MISSING_LENGTH',
        required: true,
        description: 'Overall height/length',
      },
      {
        id: 'material',
        label: 'Material',
        category: 'materials',
        reasonCode: 'MISSING_MATERIAL',
        required: true,
        description: 'Rubber, aluminum, composite, etc.',
      },
      {
        id: 'weight',
        label: 'Part weight',
        category: 'weight',
        reasonCode: 'MISSING_WEIGHT',
        required: true,
        description: 'Physical weight',
      },
      {
        id: 'status',
        label: 'Catalog status',
        category: 'status',
        reasonCode: 'MISSING_STATUS',
        required: true,
        description: 'Availability flag',
      },
    ],
  },
  'batson-trim-pieces': {
    slug: 'batson-trim-pieces',
    version: 'v1',
    partType: 'trim',
    requiredFields: [
      {
        id: 'series',
        label: 'Series + model code',
        category: 'classification',
        reasonCode: 'MISSING_SERIES',
        required: true,
        description: 'Series and trim identifier',
      },
      {
        id: 'part_type',
        label: 'Trim type',
        category: 'classification',
        reasonCode: 'MISSING_PART_TYPE',
        required: true,
        description: 'Winding check, trim ring, etc.',
      },
      {
        id: 'inner_diameter',
        label: 'Inner diameter',
        category: 'dimensions',
        reasonCode: 'MISSING_INNER_DIAMETER',
        required: true,
        description: 'ID matching blank/grip interface',
      },
      {
        id: 'outer_diameter',
        label: 'Outer diameter',
        category: 'dimensions',
        reasonCode: 'MISSING_OUTER_DIAMETER',
        required: true,
        description: 'OD envelope for clearance',
      },
      {
        id: 'thickness',
        label: 'Thickness / length',
        category: 'dimensions',
        reasonCode: 'MISSING_LENGTH',
        required: true,
        description: 'Thickness or overall length of trim piece',
      },
      {
        id: 'material',
        label: 'Material',
        category: 'materials',
        reasonCode: 'MISSING_MATERIAL',
        required: true,
        description: 'Metal, rubber, composite, etc.',
      },
      {
        id: 'weight',
        label: 'Part weight',
        category: 'weight',
        reasonCode: 'MISSING_WEIGHT',
        required: true,
        description: 'Physical or derived weight',
      },
      {
        id: 'status',
        label: 'Catalog status',
        category: 'status',
        reasonCode: 'MISSING_STATUS',
        required: true,
        description: 'Availability flag',
      },
    ],
  },
}

export type BatsonMappingTelemetry = {
  slug: BatsonSlug
  version: BatsonMappingVersion
  totals: {
    products: number
    ready: number
    missingByReason: Partial<Record<BatsonReasonCode, number>>
  }
}

export type BatsonNormalizationContext = {
  slug: BatsonSlug
  rawSpecs: Record<string, unknown>
  normSpecs?: Record<string, Prisma.JsonValue>
}
