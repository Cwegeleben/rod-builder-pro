import type { Prisma } from '@prisma/client'
import { prisma } from '../db.server'
import { getShopAccessToken } from './shopifyAdmin.server'
import { upsertShopifyForRun } from '../../packages/importer/src/sync/shopify'

export type CanonicalPublishResult =
  | {
      ok: true
      created: number
      updated: number
      failed: number
      skipped?: number
      shopDomain?: string
      handle?: string | null
    }
  | { ok: false; error: string }

/**
 * Publish a canonical Product (and its latest ProductVersion) to Shopify by reusing the existing run-based upsert.
 * Implementation detail: we materialize a temporary ImportRun and ImportDiff row and call upsertShopifyForRun.
 * This lets us leverage the mature upsert path (metafields, images, idempotency).
 */
export async function publishCanonicalProduct({
  productId,
  dryRun = false,
  shopDomain: shopDomainInput,
}: {
  productId: string
  dryRun?: boolean
  shopDomain?: string
}): Promise<CanonicalPublishResult> {
  const started = Date.now()
  let telemetryId: string | null = null
  try {
    telemetryId = crypto.randomUUID()
    await prisma.$executeRawUnsafe(
      'INSERT INTO PublishTelemetry (id, attempted, startedAt) VALUES (?, ?, CURRENT_TIMESTAMP)',
      telemetryId,
      0,
    )
  } catch {
    telemetryId = null
  }
  // Read canonical product + latest version + supplier slug
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      sku: string
      title: string
      type: string | null
      latestVersionId: string | null
      supplierSlug: string
      description: string | null
      images: string | null
      normSpecs: string | null
      rawSpecs: string | null
      priceMsrp: number | null
      priceWholesale: number | null
      contentHash: string | null
    }>
  >(
    `SELECT p.id, p.sku, p.title, p.type, p.latestVersionId, s.slug as supplierSlug,
            v.description, v.images, v.normSpecs, v.rawSpecs, v.priceMsrp, v.priceWholesale, v.contentHash
       FROM Product p
       JOIN Supplier s ON s.id = p.supplierId
  LEFT JOIN ProductVersion v ON v.id = p.latestVersionId
      WHERE p.id = ?
      LIMIT 1`,
    productId,
  )
  if (!rows || rows.length === 0) return { ok: false, error: 'not found' }
  const r = rows[0]
  if (!r.latestVersionId) return { ok: false, error: 'no version to publish' }

  const parseJson = (s: unknown): unknown => {
    if (typeof s !== 'string') return null
    try {
      return JSON.parse(s)
    } catch {
      return null
    }
  }

  // Build a minimal staging-like "after" shape understood by the Shopify sync module
  const after: Record<string, unknown> = {
    supplierId: r.supplierSlug,
    externalId: r.sku,
    sku: r.sku,
    title: r.title,
    description: r.description ?? '',
    partType: r.type ?? 'part',
    images: (Array.isArray(parseJson(r.images)) ? parseJson(r.images) : []) as unknown as string[],
    normSpecs: (parseJson(r.normSpecs) || undefined) as unknown,
    rawSpecs: (parseJson(r.rawSpecs) || undefined) as unknown,
    priceMsrp: r.priceMsrp ?? undefined,
    priceWh: r.priceWholesale ?? undefined,
    hashContent: r.contentHash ?? '',
  }

  // Create or reuse a synthetic run and a single approved diff row
  const runId = `canonical-${r.id}`
  await prisma.importRun.upsert({
    where: { id: runId },
    update: {},
    create: { id: runId, supplierId: r.supplierSlug, status: 'started', startedAt: new Date() },
  })
  const diffId = `canonical-diff-${r.id}`
  await prisma.importDiff.upsert({
    where: { id: diffId },
    update: { after: after as unknown as Prisma.InputJsonValue, resolution: 'approve', diffType: 'add' },
    create: {
      id: diffId,
      importRunId: runId,
      externalId: r.sku,
      diffType: 'add',
      after: after as unknown as Prisma.InputJsonValue,
      resolution: 'approve',
    },
  })

  if (dryRun) {
    // Dry-run heuristic: treat as created if product not yet published
    const created = 1
    const updated = 0
    try {
      if (telemetryId) {
        const duration = Date.now() - started
        await prisma.$executeRawUnsafe(
          'UPDATE PublishTelemetry SET attempted = ?, created = ?, updated = ?, failed = 0, skipped = 0, finishedAt = CURRENT_TIMESTAMP, durationMs = ? WHERE id = ?',
          1,
          created,
          updated,
          duration,
          telemetryId,
        )
      }
    } catch {
      /* ignore */
    }
    console.log(
      JSON.stringify({
        telemetry: 'publish',
        mode: 'dry-run',
        productId,
        created,
        updated,
        failed: 0,
        durationMs: Date.now() - started,
        telemetryId,
      }),
    )
    return { ok: true, created, updated, failed: 0 }
  }

  // Resolve shop domain
  let shopDomain = shopDomainInput || process.env.SHOP_CUSTOM_DOMAIN || process.env.SHOP || ''
  if (!shopDomain) {
    const sess = await prisma.session.findFirst({ where: { isOnline: false } })
    if (sess?.shop) shopDomain = sess.shop
  }
  if (!shopDomain) return { ok: false, error: 'no shop domain' }
  const accessToken = await getShopAccessToken(shopDomain)

  const results = await upsertShopifyForRun(runId, {
    shopName: shopDomain,
    accessToken,
    approvedOnly: true,
    addsOnly: false,
    deleteOverride: false,
    onlyExternalIds: [r.sku],
  })

  const created = results.filter(r => r.action === 'created').length
  const updated = results.filter(r => r.action === 'updated').length
  // Persist handle for future reference if available
  const handle = results.length ? results[0].handle : null
  try {
    if (handle) {
      await prisma.$executeRawUnsafe('UPDATE Product SET publishHandle = ? WHERE id = ?', handle, r.id)
    }
  } catch {
    // non-fatal
  }

  try {
    if (telemetryId) {
      const duration = Date.now() - started
      await prisma.$executeRawUnsafe(
        'UPDATE PublishTelemetry SET attempted = ?, created = ?, updated = ?, failed = 0, skipped = ?, productIds = ?, finishedAt = CURRENT_TIMESTAMP, durationMs = ? WHERE id = ?',
        results.length,
        created,
        updated,
        results.length === 0 ? 1 : 0,
        JSON.stringify(results.map(r => r.externalId)),
        duration,
        telemetryId,
      )
    }
  } catch {
    /* ignore */
  }
  console.log(
    JSON.stringify({
      telemetry: 'publish',
      mode: 'real',
      productId,
      created,
      updated,
      failed: 0,
      skipped: results.length === 0 ? 1 : 0,
      handle,
      shopDomain,
      durationMs: Date.now() - started,
      telemetryId,
    }),
  )
  return { ok: true, created, updated, failed: 0, shopDomain, handle }
}
