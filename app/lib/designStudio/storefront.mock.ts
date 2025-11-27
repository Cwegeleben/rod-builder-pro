import type { DesignStudioTier } from '@prisma/client'
export type { DesignStorefrontSummary } from './storefront.summary'
export { summarizeSelections } from './storefront.summary'

export type DesignStorefrontPartRole =
  | 'blank'
  | 'rear_grip'
  | 'fore_grip'
  | 'reel_seat'
  | 'butt_cap'
  | 'guide_set'
  | 'guide'
  | 'guide_tip'
  | 'tip_top'
  | 'winding_check'
  | 'decal'
  | 'handle'
  | 'component'
  | 'accessory'

export type DesignStorefrontStep = {
  id: string
  label: string
  description?: string
  roles: DesignStorefrontPartRole[]
}

export type DesignStorefrontOption = {
  id: string
  role: DesignStorefrontPartRole
  title: string
  vendor?: string
  productId?: string
  sku?: string | null
  subtitle?: string
  notes?: string
  price: number
  weightOz?: number
  leadTimeDays?: number
  specs: Array<{ label: string; value: string }>
  imageUrl?: string
  badge?: string
  family?: string | null
  ready?: boolean | null
}

export type DesignStorefrontConfig = {
  hero: {
    title: string
    body: string
  }
  tier: DesignStudioTier
  currency: 'USD'
  basePrice: number
  featureFlags: string[]
  steps: DesignStorefrontStep[]
}

const MOCK_STEPS: DesignStorefrontStep[] = [
  {
    id: 'step-blank',
    label: 'Step 1 · Blank',
    description: 'Pick the performance backbone for your build.',
    roles: ['blank'],
  },
  {
    id: 'step-handle',
    label: 'Step 2 · Handle & Seat',
    description: 'Dial in ergonomics with grips, reel seat, and trim pieces.',
    roles: ['rear_grip', 'fore_grip', 'reel_seat', 'butt_cap'],
  },
  {
    id: 'step-guides',
    label: 'Step 3 · Guides & Tip',
    description: 'Choose a guide train optimized for your technique.',
    roles: ['guide_set', 'tip_top'],
  },
  {
    id: 'step-finishing',
    label: 'Step 4 · Finishing',
    description: 'Lock in finishing touches like winding checks and decals.',
    roles: ['winding_check', 'decal'],
  },
]

const MOCK_OPTIONS: Record<DesignStorefrontPartRole, DesignStorefrontOption[]> = {
  blank: [
    {
      id: 'blank-rx10-76ml',
      role: 'blank',
      sku: 'RX10-76ML',
      title: 'Rainshadow Eternity RX10 7\'11" ML',
      vendor: 'Batson',
      subtitle: 'Fast • 6-12 lb • 1/8-1/2 oz',
      price: 189,
      specs: [
        { label: 'Length', value: '7\'11"' },
        { label: 'Power', value: 'ML' },
        { label: 'Action', value: 'Fast' },
      ],
      badge: 'Most popular',
    },
    {
      id: 'blank-rclb80m',
      role: 'blank',
      sku: 'RCLB80M',
      title: 'Rainshadow Revelation RCLB80M',
      subtitle: 'Moderate-Fast • 12-25 lb',
      price: 129,
      specs: [
        { label: 'Length', value: '8\'11"' },
        { label: 'Power', value: 'Medium' },
        { label: 'Action', value: 'Mod-Fast' },
      ],
    },
  ],
  rear_grip: [
    {
      id: 'rear-carbon-10',
      role: 'rear_grip',
      sku: 'REAR-CARBON-10',
      title: 'Carbon Fiber Rear Grip 10"',
      price: 42,
      specs: [
        { label: 'Material', value: 'Carbon fiber' },
        { label: 'Finish', value: 'Matte' },
      ],
    },
    {
      id: 'rear-cork-9',
      role: 'rear_grip',
      sku: 'REAR-CORK-9',
      title: 'AAA Cork Rear Grip 9"',
      price: 36,
      specs: [
        { label: 'Material', value: 'AAA cork' },
        { label: 'Diameter', value: '0.95"' },
      ],
    },
  ],
  fore_grip: [
    {
      id: 'fore-carbon-4',
      role: 'fore_grip',
      sku: 'FORE-CARBON-4',
      title: 'Carbon Fiber Foregrip 4"',
      price: 18,
      specs: [
        { label: 'Material', value: 'Carbon fiber' },
        { label: 'OD', value: '0.88"' },
      ],
    },
    {
      id: 'fore-cork-3',
      role: 'fore_grip',
      sku: 'FORE-CORK-3',
      title: 'Slim Cork Foregrip 3"',
      price: 14,
      specs: [
        { label: 'Material', value: 'AAA cork' },
        { label: 'OD', value: '0.82"' },
      ],
    },
  ],
  reel_seat: [
    {
      id: 'seat-eclipse',
      role: 'reel_seat',
      sku: 'SEAT-ECLIPSE',
      title: 'Eclipse Carbon Reel Seat',
      price: 54,
      specs: [
        { label: 'Size', value: '16' },
        { label: 'Hardware', value: 'Black anodized' },
      ],
      badge: 'New',
    },
    {
      id: 'seat-alps-mx',
      role: 'reel_seat',
      sku: 'SEAT-ALPS-MX',
      title: 'ALPS MVT Reel Seat',
      price: 47,
      specs: [
        { label: 'Size', value: '16' },
        { label: 'Hardware', value: 'Titanium smoke' },
      ],
    },
  ],
  butt_cap: [
    {
      id: 'butt-carbon',
      role: 'butt_cap',
      sku: 'BUTT-CARBON',
      title: 'Carbon Tenon Butt Cap',
      price: 15,
      specs: [{ label: 'Weight', value: '0.4 oz' }],
    },
    {
      id: 'butt-rubber',
      role: 'butt_cap',
      sku: 'BUTT-RUBBER',
      title: 'Rubber Gimbal Cap',
      price: 11,
      specs: [{ label: 'Weight', value: '0.6 oz' }],
    },
  ],
  guide_set: [
    {
      id: 'guides-xray-ti',
      role: 'guide_set',
      sku: 'GUIDE-SET-TI',
      title: 'X-Ray Titanium Guide Set',
      price: 129,
      specs: [
        { label: 'Ring', value: 'SiC' },
        { label: 'Count', value: '10 + tip' },
      ],
    },
    {
      id: 'guides-alconite',
      role: 'guide_set',
      sku: 'GUIDE-SET-ALC',
      title: 'Alconite KR Concept Set',
      price: 92,
      specs: [
        { label: 'Ring', value: 'Alconite' },
        { label: 'Count', value: '11 + tip' },
      ],
    },
  ],
  tip_top: [
    {
      id: 'tip-ti-sic',
      role: 'tip_top',
      sku: 'TIP-TI-SIC',
      title: 'Titanium SiC Tip Top',
      price: 18,
      specs: [
        { label: 'Ring', value: 'SiC' },
        { label: 'Tube', value: '5.0' },
      ],
    },
    {
      id: 'tip-alconite',
      role: 'tip_top',
      sku: 'TIP-ALCONITE',
      title: 'Alconite Tip Top',
      price: 9,
      specs: [
        { label: 'Ring', value: 'Alconite' },
        { label: 'Tube', value: '5.0' },
      ],
    },
  ],
  winding_check: [
    {
      id: 'winding-gunmetal',
      role: 'winding_check',
      sku: 'WIND-GUNMETAL',
      title: 'Gunmetal Winding Check',
      price: 6,
      specs: [{ label: 'Finish', value: 'Gunmetal' }],
    },
    {
      id: 'winding-anodized',
      role: 'winding_check',
      sku: 'WIND-ANODIZED',
      title: 'Anodized Winding Check',
      price: 8,
      specs: [{ label: 'Finish', value: 'Copper' }],
    },
  ],
  decal: [
    {
      id: 'decal-rainshadow',
      role: 'decal',
      sku: 'DECAL-RBS',
      title: 'Rainshadow Crest Decal',
      price: 5,
      specs: [{ label: 'Finish', value: 'Matte silver' }],
    },
    {
      id: 'decal-custom',
      role: 'decal',
      sku: 'DECAL-CUSTOM',
      title: 'Custom Name Decal',
      price: 15,
      specs: [{ label: 'Lead time', value: '5 days' }],
      notes: 'Enter personalization details during checkout.',
    },
  ],
  handle: [],
  guide: [],
  guide_tip: [],
  component: [],
  accessory: [],
}

const MOCK_CONFIG: DesignStorefrontConfig = {
  hero: {
    title: 'Design your Rainshadow build',
    body: 'Work through curated steps to assemble a balanced blank, handle system, guide train, and finishing touches. Pricing updates in real time as you mix and match components.',
  },
  tier: 'PLUS',
  currency: 'USD',
  basePrice: 225,
  featureFlags: ['saved-builds'],
  steps: MOCK_STEPS,
}

export async function getMockDesignStorefrontConfig(): Promise<DesignStorefrontConfig> {
  await delay(150)
  return MOCK_CONFIG
}

export async function getMockDesignStorefrontOptions(
  role: DesignStorefrontPartRole | null | undefined,
): Promise<DesignStorefrontOption[]> {
  await delay(150)
  if (!role) return []
  return MOCK_OPTIONS[role] ?? []
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
