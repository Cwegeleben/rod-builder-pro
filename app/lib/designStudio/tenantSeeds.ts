import { DesignFulfillmentMode, DesignStudioTier } from '@prisma/client'

export type DesignStudioWizardStep = 'baseline' | 'blank' | 'components' | 'review'

export type SandboxDesignStudioTenantConfig = {
  wizardSteps: DesignStudioWizardStep[]
  curatedFamilies: Array<{
    handle: string
    label: string
    defaultFulfillmentMode: DesignFulfillmentMode
    coverageScore: number
    notes?: string
  }>
  componentRoles: Array<{
    role: string
    required: boolean
    minOptions: number
    notes?: string
  }>
  featureFlags: {
    savedBuilds: boolean
    exportToS3: boolean
    dropship: boolean
  }
  sla: {
    reviewHours: number
    approvalHours: number
  }
  copy: {
    heroTitle: string
    heroBody: string
    successHeadline: string
  }
}

export type SandboxDesignStudioTenantSeed = {
  label: string
  shopDomain: string
  tier: DesignStudioTier
  enabled: boolean
  tags: string[]
  config: SandboxDesignStudioTenantConfig
}

export const SANDBOX_TENANT_SEEDS: SandboxDesignStudioTenantSeed[] = [
  {
    label: 'Starter reference (read-only)',
    shopDomain: 'starter-sandbox.myshopify.com',
    tier: DesignStudioTier.STARTER,
    enabled: true,
    tags: ['internal-demo', 'starter'],
    config: {
      wizardSteps: [],
      curatedFamilies: [
        {
          handle: 'rainshadow-revelation',
          label: 'Rainshadow Revelation',
          defaultFulfillmentMode: DesignFulfillmentMode.RBP_BUILD,
          coverageScore: 0.35,
          notes: 'Static marketing tiles only; no checkout flow.',
        },
      ],
      componentRoles: [],
      featureFlags: {
        savedBuilds: false,
        exportToS3: false,
        dropship: false,
      },
      sla: {
        reviewHours: 72,
        approvalHours: 0,
      },
      copy: {
        heroTitle: 'Preview the Rainshadow Design Studio',
        heroBody: 'Starter tenants can browse featured builds and request an upgrade for interactive flows.',
        successHeadline: 'Thanks for exploring the Design Studio preview',
      },
    },
  },
  {
    label: 'Core sandbox tenant',
    shopDomain: 'core-sandbox.myshopify.com',
    tier: DesignStudioTier.CORE,
    enabled: true,
    tags: ['pilot', 'core'],
    config: {
      wizardSteps: ['baseline', 'blank', 'components', 'review'],
      curatedFamilies: [
        {
          handle: 'rainshadow-eternity',
          label: 'Rainshadow Eternity RX10',
          defaultFulfillmentMode: DesignFulfillmentMode.RBP_BUILD,
          coverageScore: 0.82,
          notes: 'Flagship family for Core tenants. Built by RBP.',
        },
        {
          handle: 'rainshadow-revelation',
          label: 'Rainshadow Revelation RX7',
          defaultFulfillmentMode: DesignFulfillmentMode.RBP_BUILD,
          coverageScore: 0.74,
          notes: 'Balanced coverage; auto-selected in wizard baseline.',
        },
      ],
      componentRoles: [
        { role: 'blank', required: true, minOptions: 1 },
        { role: 'handle', required: true, minOptions: 1 },
        { role: 'guide_set', required: true, minOptions: 1 },
        { role: 'accessory', required: false, minOptions: 0, notes: 'Optional decals / cases' },
      ],
      featureFlags: {
        savedBuilds: false,
        exportToS3: true,
        dropship: false,
      },
      sla: {
        reviewHours: 24,
        approvalHours: 72,
      },
      copy: {
        heroTitle: 'Core Design Studio sandbox',
        heroBody: 'Full wizard with curated blanks, handles, and guide sets for Rainshadow partners running Core tier.',
        successHeadline: 'We received your Core sandbox build request',
      },
    },
  },
  {
    label: 'Plus sandbox tenant',
    shopDomain: 'plus-sandbox.myshopify.com',
    tier: DesignStudioTier.PLUS,
    enabled: true,
    tags: ['pilot-plus', 'dropship'],
    config: {
      wizardSteps: ['baseline', 'blank', 'components', 'review'],
      curatedFamilies: [
        {
          handle: 'rainshadow-immortal',
          label: 'Rainshadow Immortal',
          defaultFulfillmentMode: DesignFulfillmentMode.RBP_BUILD,
          coverageScore: 0.88,
          notes: 'High-touch builds kept inside RBP.',
        },
        {
          handle: 'batson-recon',
          label: 'Batson Recon Dropship',
          defaultFulfillmentMode: DesignFulfillmentMode.SUPPLIER_BUILD,
          coverageScore: 0.64,
          notes: 'Supplier-fulfilled pilot family for Plus tenants.',
        },
      ],
      componentRoles: [
        { role: 'blank', required: true, minOptions: 1 },
        { role: 'handle', required: true, minOptions: 1 },
        { role: 'reel_seat', required: true, minOptions: 1 },
        { role: 'guide_set', required: true, minOptions: 1 },
        { role: 'accessory', required: false, minOptions: 0 },
      ],
      featureFlags: {
        savedBuilds: true,
        exportToS3: true,
        dropship: true,
      },
      sla: {
        reviewHours: 12,
        approvalHours: 48,
      },
      copy: {
        heroTitle: 'Plus Design Studio sandbox',
        heroBody:
          'Includes dropship families, saved builds list, and export workflows for Plus/Enterprise style demos.',
        successHeadline: 'Plus sandbox build created',
      },
    },
  },
]
