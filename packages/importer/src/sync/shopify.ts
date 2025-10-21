// <!-- BEGIN RBP GENERATED: shopify-sync-v1 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
// Idempotent Shopify upsert keyed by deterministic product handle and rbp.supplier_external_id metafield.
// Note: We use Shopify metafields as the linkage to avoid DB migrations. Handle = rbp-<supplierId>-<externalId>.
// At update time, we compare rbp.hash metafield against PartStaging.hashContent and skip if unchanged.

// @ts-expect-error - lightweight shim acceptable for runtime usage
import Shopify from 'shopify-api-node'
import { prisma } from '../../../../app/db.server'

const NS = 'rbp'

export type ShopCfg = { shopName: string; accessToken: string; apiVersion?: string }

function mkClient(cfg: ShopCfg) {
  return new Shopify({
    shopName: cfg.shopName,
    accessToken: cfg.accessToken,
    apiVersion: cfg.apiVersion || '2024-10',
  })
}

async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (e: any) {
      const code = e?.statusCode || e?.response?.status
      if (code === 429 && attempt < tries - 1) {
        const wait = Math.min(1000 * Math.pow(2, attempt), 8000)
        await new Promise(r => setTimeout(r, wait))
        attempt++
        continue
      }
      throw e
    }
  }
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

function buildHandle(supplierId: string, externalId: string) {
  return `rbp-${slugify(supplierId)}-${slugify(externalId)}`
}

async function findProductByHandle(shopify: any, handle: string) {
  const list = await withRetry(() => shopify.product.list({ handle }))
  return Array.isArray(list) && list.length ? list[0] : null
}

async function listProductMetafields(shopify: any, productId: number): Promise<any[]> {
  return withRetry(() =>
    shopify.metafield.list({ metafield: { owner_resource: 'product', owner_id: productId }, limit: 250 }),
  )
}

async function upsertProductMetafield(
  shopify: any,
  productId: number,
  namespace: string,
  key: string,
  type: string,
  value: string,
) {
  const existing = await listProductMetafields(shopify, productId)
  const found = existing.find((m: any) => m.namespace === namespace && m.key === key)
  if (!found) {
    await withRetry(() =>
      shopify.metafield.create({ owner_resource: 'product', owner_id: productId, namespace, key, type, value }),
    )
  } else {
    await withRetry(() => shopify.metafield.update(found.id, { type, value }))
  }
}

// <!-- BEGIN RBP GENERATED: shopify-sync-images-v1 -->
function toAbsolute(urlStr: string): string | null {
  if (!urlStr) return null
  try {
    const u = new URL(urlStr, 'https://batsonenterprises.com')
    if (!/^https?:$/i.test(u.protocol)) return null
    // Normalize to HTTPS
    if (u.protocol === 'http:') u.protocol = 'https:'
    return u.toString()
  } catch {
    return null
  }
}

async function createProductImageFromSrc(shopify: any, productId: number, src: string, alt?: string) {
  return await withRetry(() => shopify.productImage.create(productId, { src, alt }))
}

async function readImageSourcesMetafield(shopify: any, productId: number, namespace: string) {
  const all = await withRetry<any[]>(() =>
    shopify.metafield.list({ metafield: { owner_resource: 'product', owner_id: productId }, limit: 250 }),
  )
  return (all as any[]).find((m: any) => m.namespace === namespace && m.key === 'image_sources') || null
}

async function writeImageSourcesMetafield(shopify: any, productId: number, namespace: string, sources: string[]) {
  const existing = await readImageSourcesMetafield(shopify, productId, namespace)
  const payload = {
    owner_resource: 'product',
    owner_id: productId,
    namespace,
    key: 'image_sources',
    type: 'json',
    value: JSON.stringify(sources),
  }
  if (!existing) {
    return await withRetry(() => shopify.metafield.create(payload))
  }
  return await withRetry(() => shopify.metafield.update(existing.id, { type: 'json', value: JSON.stringify(sources) }))
}
// <!-- END RBP GENERATED: shopify-sync-images-v1 -->

export async function upsertShopifyForRun(runId: string, cfg: ShopCfg) {
  const shopify = mkClient(cfg)
  const db: any = prisma as any
  const diffs = await db.importDiff.findMany({
    where: {
      importRunId: runId,
      diffType: { in: ['add', 'change'] },
      OR: [{ resolution: 'approve' }, { resolution: null }],
    },
  })

  for (const d of diffs) {
    const after: any = d.after
    if (!after) continue

    const supplierId = String(after.supplierId || 'batson')
    const externalId = String(after.externalId)
    const title = String(after.title || externalId)
    const body_html = String(after.description || '')
    const product_type = String(after.partType || 'part')
    const vendor = supplierId.charAt(0).toUpperCase() + supplierId.slice(1)
    const handle = buildHandle(supplierId, externalId)
    const specs = (after.normSpecs as any) || (after.rawSpecs as any) || {}
    const contentHash = String(after.hashContent || '')

    let product = await findProductByHandle(shopify, handle)
    const tags = [product_type, supplierId]

    if (!product) {
      product = await withRetry(() => shopify.product.create({ title, body_html, vendor, product_type, handle, tags }))
    } else {
      // Check rbp.hash metafield; skip if unchanged
      const mfs = await listProductMetafields(shopify, Number(product.id))
      const mfHash = mfs.find((m: any) => m.namespace === NS && m.key === 'hash')
      const prevHash = mfHash?.value || ''
      if (prevHash === contentHash) {
        continue
      }
      await withRetry(() =>
        shopify.product.update(Number(product.id), { title, body_html, vendor, product_type, tags }),
      )
    }

    const pid = Number(product.id)
    await upsertProductMetafield(shopify, pid, NS, 'specs', 'json', JSON.stringify(specs))
    await upsertProductMetafield(shopify, pid, NS, 'supplier_external_id', 'single_line_text_field', externalId)
    await upsertProductMetafield(shopify, pid, NS, 'hash', 'single_line_text_field', contentHash)

    // <!-- BEGIN RBP GENERATED: shopify-sync-images-v1 -->
    // Images v1: pass-through by src, dedupe by remembered source URLs
    const imageSrcs: string[] = (Array.isArray(after.images) ? after.images : [])
      .map((u: any) => toAbsolute(String(u)))
      .filter(Boolean) as string[]
    if (imageSrcs.length) {
      // Read previous image sources metafield (if any)
      const sourcesMf = await readImageSourcesMetafield(shopify, pid, NS)
      const prevSources: string[] = sourcesMf?.value ? JSON.parse(sourcesMf.value) : []

      // Only upload images with source URLs not seen before
      const toCreate = imageSrcs.filter(src => !prevSources.includes(src))

      if (toCreate.length) {
        // Optional: set alt text from title / externalId
        const altBase = `${title} (${externalId})`
        for (const src of toCreate) {
          try {
            await createProductImageFromSrc(shopify, pid, src, altBase)
          } catch {
            // Non-fatal: continue with next image
          }
        }
        const newSources = Array.from(new Set([...prevSources, ...toCreate]))
        await writeImageSourcesMetafield(shopify, pid, NS, newSources)
      }
    }
    // <!-- END RBP GENERATED: shopify-sync-images-v1 -->
  }
}
// <!-- END RBP GENERATED: shopify-sync-v1 -->
