import type { Prisma } from '@prisma/client'
import { DesignStudioTier } from '@prisma/client'
import { prisma } from '../../db.server'
import { isDesignStudioFeatureEnabled } from '../flags.server'

const SHOP_PARAM_KEYS = ['shop', 'shopDomain', 'shopifyShop', 'shop-name']

let _authenticate: typeof import('../../shopify.server').authenticate | null = null
async function getAuthenticate() {
  if (_authenticate) return _authenticate
  const mod = await import('../../shopify.server')
  _authenticate = mod.authenticate
  return _authenticate
}

function normalizeShopDomain(value: string | null | undefined): string | null {
  if (!value) return null
  let refined = value.trim().toLowerCase()
  if (!refined) return null
  refined = refined.replace(/^https?:\/\//, '')
  if (!refined) return null
  if (refined.includes('/')) {
    refined = refined.split('/')[0] || ''
  }
  if (!refined) return null
  if (!refined.includes('.')) {
    refined = `${refined}.myshopify.com`
  }
  return refined
}

async function resolveShopDomainFromSession(request: Request): Promise<string | null> {
  try {
    const authenticate = await getAuthenticate()
    const { session } = await authenticate.admin(request)
    const shop = (session as { shop?: string } | undefined)?.shop
    return normalizeShopDomain(shop)
  } catch {
    return null
  }
}

async function resolveShopDomainFromOfflineSession(): Promise<string | null> {
  try {
    const sess = await prisma.session.findFirst({ where: { isOnline: false } })
    return normalizeShopDomain(sess?.shop)
  } catch {
    return null
  }
}

export async function resolveShopDomain(request: Request): Promise<string | null> {
  try {
    const url = new URL(request.url)
    for (const key of SHOP_PARAM_KEYS) {
      const fromParam = url.searchParams.get(key)
      const normalized = normalizeShopDomain(fromParam)
      if (normalized) return normalized
    }
  } catch {
    /* ignore URL parsing issues */
  }
  const headerDomain = normalizeShopDomain(request.headers.get('x-shopify-shop-domain'))
  if (headerDomain) return headerDomain
  const envDomain = normalizeShopDomain(process.env.SHOP_CUSTOM_DOMAIN || process.env.SHOP)
  if (envDomain) return envDomain
  const sessionDomain = await resolveShopDomainFromSession(request)
  if (sessionDomain) return sessionDomain
  return resolveShopDomainFromOfflineSession()
}

export type DesignStudioAccessReason = 'flag-disabled' | 'no-shop' | 'tenant-missing' | 'tenant-disabled' | 'enabled'

export type DesignStudioAccess = {
  enabled: boolean
  tier: DesignStudioTier
  config: Prisma.JsonValue | null
  shopDomain: string | null
  reason: DesignStudioAccessReason
}

const DISABLED_ACCESS: DesignStudioAccess = {
  enabled: false,
  tier: DesignStudioTier.STARTER,
  config: null,
  shopDomain: null,
  reason: 'flag-disabled',
}

export async function getDesignStudioAccess(request: Request): Promise<DesignStudioAccess> {
  if (!isDesignStudioFeatureEnabled()) {
    return DISABLED_ACCESS
  }
  const shopDomain = await resolveShopDomain(request)
  if (!shopDomain) {
    return { ...DISABLED_ACCESS, reason: 'no-shop' }
  }
  const tenant = await prisma.tenantSettings.findUnique({ where: { shopDomain } })
  if (!tenant) {
    return { ...DISABLED_ACCESS, shopDomain, reason: 'tenant-missing' }
  }
  if (!tenant.designStudioEnabled) {
    return { ...DISABLED_ACCESS, shopDomain, reason: 'tenant-disabled' }
  }
  return {
    enabled: true,
    tier: tenant.designStudioTier,
    config: tenant.designStudioConfig as Prisma.JsonValue | null,
    shopDomain,
    reason: 'enabled',
  }
}
