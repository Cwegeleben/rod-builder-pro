// <!-- BEGIN RBP GENERATED: shopify-sync-v1 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
// Idempotent Shopify upsert keyed by deterministic product handle and rbp.supplier_external_id metafield.
// Note: We use Shopify metafields as the linkage to avoid DB migrations. Handle = rbp-<supplierId>-<externalId>.
// At update time, we compare rbp.hash metafield against PartStaging.hashContent and skip if unchanged.

import Shopify from 'shopify-api-node'
import { prisma } from '../../../../app/db.server'

const NS = 'rbp'
const SPEC_NS = 'rbp.spec'

export type ShopCfg = {
  shopName: string
  accessToken: string
  apiVersion?: string
  approvedOnly?: boolean
  deleteOverride?: boolean
  addsOnly?: boolean
}

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
  try {
    if (!found) {
      await withRetry(() =>
        shopify.metafield.create({ owner_resource: 'product', owner_id: productId, namespace, key, type, value }),
      )
    } else {
      await withRetry(() => shopify.metafield.update(found.id, { type, value }))
    }
  } catch (e: any) {
    const body = e?.response?.body ? safeStringify(e.response.body) : undefined
    const msg = `metafield upsert failed for ${namespace}.${key}: ${e?.message || e}`
    const err = new Error(body ? `${msg}; body=${body}` : msg)
    ;(err as any).statusCode = e?.statusCode || e?.response?.status
    throw err
  }
}

function toNumber(val: unknown): number | null {
  if (val == null) return null
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val === 'string') {
    const n = Number(val)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function extractPriceFields(after: any): { price: string | undefined; compare_at_price: string | undefined } {
  const pWh = toNumber(after?.priceWh)
  const pMsrp = toNumber(after?.priceMsrp)
  const priceNum = pWh ?? pMsrp ?? null
  let compareNum: number | null = null
  if (pMsrp != null && priceNum != null && pMsrp > priceNum) compareNum = pMsrp
  // Only use compare_at_price when strictly greater than price
  const price = priceNum != null ? priceNum.toFixed(2) : undefined
  const compare_at_price = compareNum != null ? compareNum.toFixed(2) : undefined
  return { price, compare_at_price }
}

function gramsFromSpec(spec: any): number | undefined {
  const oz = toNumber(spec?.weight_oz)
  if (oz == null) return undefined
  const grams = Math.round(oz * 28.3495)
  return Number.isFinite(grams) ? grams : undefined
}

function discreteSpecEntries(spec: Record<string, any>): Array<{ key: string; type: string; value: string }> {
  const mf: Array<{ key: string; type: string; value: string }> = []
  const push = (key: string, type: string, val: unknown) => {
    const present = val !== undefined && val !== null && !(Array.isArray(val) && !val.length)
    if (!present) return
    const value = Array.isArray(val) ? JSON.stringify(val) : String(val)
    mf.push({ key, type, value })
  }
  // Mirror preview mapper keys where available
  push('series', 'single_line_text_field', spec.series)
  push('length_in', 'number_integer', spec.length_in)
  push('pieces', 'number_integer', spec.pieces)
  push('color', 'single_line_text_field', spec.color)
  push('action', 'single_line_text_field', spec.action)
  push('power', 'single_line_text_field', spec.power)
  push('material', 'single_line_text_field', spec.material)
  push('line_lb_min', 'number_integer', spec.line_lb_min)
  push('line_lb_max', 'number_integer', spec.line_lb_max)
  push('lure_oz_min', 'number_decimal', spec.lure_oz_min)
  push('lure_oz_max', 'number_decimal', spec.lure_oz_max)
  push('weight_oz', 'number_decimal', spec.weight_oz)
  push('butt_dia_in', 'number_decimal', spec.butt_dia_in)
  push('tip_top_size', 'single_line_text_field', spec.tip_top_size)
  push('applications', 'list.single_line_text_field', spec.applications ?? [])
  return mf
}

export type ShopifyPreview = {
  core: {
    title: string
    body_html: string
    vendor: string
    product_type: string
    handle: string
    tags: string
  }
  variant: {
    sku: string
    price?: string
    compare_at_price?: string
    grams?: number
    taxable: boolean
    inventory_policy: 'deny'
    inventory_management: null
  }
  metafields: Array<{ namespace: string; key: string; type: string; value: string }>
  images: string[]
}

export function buildShopifyPreview(after: any, runId: string): ShopifyPreview {
  const supplierId = String(after?.supplierId || 'batson')
  const externalId = String(after?.externalId)
  const title = String(after?.title || externalId)
  const body_html = String(after?.description || '')
  const product_type = String(after?.partType || 'part')
  const vendor = supplierId.charAt(0).toUpperCase() + supplierId.slice(1)
  const handle = buildHandle(supplierId, externalId)
  const specs = (after?.normSpecs as any) || (after?.rawSpecs as any) || {}
  const contentHash = String(after?.hashContent || '')

  const { price, compare_at_price } = extractPriceFields(after)
  const grams = gramsFromSpec(specs)
  const sku = String(after?.sku || externalId).trim()
  const tagsArr = [product_type, supplierId, `importRun:${runId}`]
  const tags = tagsArr.join(', ')

  const metafields: Array<{ namespace: string; key: string; type: string; value: string }> = []
  metafields.push({ namespace: NS, key: 'specs', type: 'json', value: JSON.stringify(specs) })
  metafields.push({ namespace: NS, key: 'supplier_external_id', type: 'single_line_text_field', value: externalId })
  metafields.push({ namespace: NS, key: 'hash', type: 'single_line_text_field', value: contentHash })
  try {
    const entries = discreteSpecEntries(specs)
    for (const e of entries) metafields.push({ namespace: SPEC_NS, key: e.key, type: e.type, value: e.value })
  } catch {
    // ignore
  }

  const imageSrcs: string[] = (Array.isArray(after?.images) ? after.images : [])
    .map((u: any) => toAbsolute(String(u)))
    .filter(Boolean) as string[]

  return {
    core: { title, body_html, vendor, product_type, handle, tags },
    variant: {
      sku,
      price,
      compare_at_price,
      grams,
      taxable: true,
      inventory_policy: 'deny',
      inventory_management: null,
    },
    metafields,
    images: imageSrcs,
  }
}

export function validateShopifyPreview(p: ShopifyPreview): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const dec = /^-?\d+(?:\.\d+)?$/
  const int = /^-?\d+$/
  const noNewlines = /^(?!.*[\r\n]).*$/
  if (!p.core.title) errors.push('title is required')
  if (!p.core.handle) errors.push('handle is required')
  if (p.variant.price != null && !dec.test(p.variant.price)) errors.push('variant.price must be a decimal string')
  if (p.variant.compare_at_price != null && !dec.test(p.variant.compare_at_price))
    errors.push('variant.compare_at_price must be a decimal string')
  if (p.variant.grams != null && !Number.isInteger(p.variant.grams)) errors.push('variant.grams must be an integer')
  if (!p.variant.sku) errors.push('variant.sku is required')
  if (p.variant.sku && (!noNewlines.test(p.variant.sku) || p.variant.sku.length > 255)) {
    errors.push('variant.sku must be <=255 chars and contain no newlines')
  }
  for (const mf of p.metafields) {
    if (!mf.namespace || !mf.key || !mf.type) errors.push(`metafield missing fields: ${mf.namespace}.${mf.key}`)
    if (mf.type === 'number_integer' && !int.test(mf.value)) errors.push(`metafield ${mf.key} not integer`)
    if (mf.type === 'number_decimal' && !dec.test(mf.value)) errors.push(`metafield ${mf.key} not decimal`)
    if (mf.type?.startsWith('list.')) {
      try {
        const v = JSON.parse(mf.value)
        if (!Array.isArray(v) || v.some(x => typeof x !== 'string'))
          errors.push(`metafield ${mf.key} list must be array of strings`)
      } catch {
        errors.push(`metafield ${mf.key} list must be JSON array string`)
      }
    }
    if (mf.type === 'json') {
      try {
        JSON.parse(mf.value)
      } catch {
        errors.push(`metafield ${mf.key} json must be valid JSON`)
      }
    }
    if (mf.type === 'single_line_text_field') {
      if (!noNewlines.test(mf.value)) errors.push(`metafield ${mf.key} must not contain newlines`)
      if (mf.value.length > 255) errors.push(`metafield ${mf.key} must be <=255 chars`)
    }
    if (mf.type?.startsWith('list.single_line_text_field')) {
      try {
        const arr = JSON.parse(mf.value)
        if (Array.isArray(arr)) {
          for (const v of arr) {
            if (typeof v !== 'string') {
              errors.push(`metafield ${mf.key} list elements must be strings`)
              break
            }
            if (v.length > 255 || !noNewlines.test(v)) {
              errors.push(`metafield ${mf.key} list elements must be <=255 chars and no newlines`)
              break
            }
          }
        }
      } catch {
        // already handled
      }
    }
  }
  return { ok: errors.length === 0, errors }
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

export async function upsertShopifyForRun(
  runId: string,
  cfg: ShopCfg,
): Promise<Array<{ externalId: string; productId: number; handle: string; action: 'created' | 'updated' }>> {
  const shopify = mkClient(cfg)
  const db: any = prisma as any
  const where: any = {
    importRunId: runId,
    diffType: cfg.addsOnly
      ? { in: ['add'] }
      : { in: cfg.deleteOverride ? ['add', 'change', 'delete'] : ['add', 'change'] },
  }
  if (cfg.approvedOnly) {
    where.resolution = 'approve'
  } else {
    where.OR = [{ resolution: 'approve' }, { resolution: null }]
  }
  const diffs = await db.importDiff.findMany({ where })
  const results: Array<{ externalId: string; productId: number; handle: string; action: 'created' | 'updated' }> = []

  for (const d of diffs) {
    const after: any = d.after
    try {
      // Handle delete overrides separately using `before`
      if (d.diffType === 'delete' && cfg.deleteOverride) {
        const before: any = d.before
        if (!before) continue
        const supplierId = String(before.supplierId || 'batson')
        const externalId = String(before.externalId)
        const handle = buildHandle(supplierId, externalId)
        const product = await findProductByHandle(shopify, handle)
        if (!product) continue
        const pid = Number(product.id)
        // Skip if already archived or already marked for deletion
        const mfs = await listProductMetafields(shopify, pid)
        const delMark = mfs.find((m: any) => m.namespace === NS && m.key === 'delete_mark')
        const alreadyMarked = delMark?.value === '1'
        const alreadyArchived = product.status === 'archived'
        if (alreadyMarked && alreadyArchived) {
          continue
        }
        // Archive product and set delete_mark metafield
        await withRetry(() => shopify.product.update(pid, { status: 'archived' }))
        await upsertProductMetafield(shopify, pid, NS, 'delete_mark', 'single_line_text_field', '1')
        results.push({ externalId, productId: pid, handle, action: 'updated' })
        continue
      }
      if (!after) continue

      const preview = buildShopifyPreview(after, runId)
      const { ok, errors } = validateShopifyPreview(preview)
      if (!ok) {
        throw new Error(`Invalid Shopify payload: ${errors.join('; ')}`)
      }
      const { core, variant } = preview
      const { handle } = core
      const contentHash = String(after.hashContent || '')

      let product = await findProductByHandle(shopify, handle)

      if (!product) {
        // Create with a single default variant if available
        const variants = [variant]
        product = await withRetry(() => shopify.product.create({ ...core, variants }))
        const pid = Number(product.id)
        const externalId = String(after.externalId)
        results.push({ externalId, productId: pid, handle, action: 'created' })
        try {
          await db.importDiff.update({
            where: { id: d.id },
            data: {
              validation: {
                ...(d.validation as any),
                publish: {
                  at: new Date().toISOString(),
                  action: 'created',
                  productId: pid,
                  handle,
                },
              } as any,
            },
          })
        } catch {
          // non-fatal
        }
      } else {
        // Check rbp.hash metafield; skip if unchanged
        const mfs = await listProductMetafields(shopify, Number(product.id))
        const mfHash = mfs.find((m: any) => m.namespace === NS && m.key === 'hash')
        const prevHash = mfHash?.value || ''
        if (prevHash === contentHash) {
          continue
        }
        await withRetry(() => shopify.product.update(Number(product.id), core))
        const pid = Number(product.id)
        const externalId = String(after.externalId)
        results.push({ externalId, productId: pid, handle, action: 'updated' })
        try {
          await db.importDiff.update({
            where: { id: d.id },
            data: {
              validation: {
                ...(d.validation as any),
                publish: {
                  at: new Date().toISOString(),
                  action: 'updated',
                  productId: pid,
                  handle,
                },
              } as any,
            },
          })
        } catch {
          // non-fatal
        }
      }

      const pid = Number(product.id)
      for (const mf of preview.metafields) {
        await upsertProductMetafield(shopify, pid, mf.namespace, mf.key, mf.type, mf.value)
      }

      // Ensure the single variant reflects price/SKU/grams on updates as well
      try {
        const { price, compare_at_price, grams, sku } = {
          price: variant.price,
          compare_at_price: variant.compare_at_price,
          grams: variant.grams,
          sku: variant.sku,
        }
        const variants = Array.isArray((product as any).variants) ? (product as any).variants : []
        if (variants.length > 0 && variants[0]?.id) {
          const vid = Number(variants[0].id)
          await withRetry(() =>
            shopify.productVariant.update(vid, {
              sku,
              price,
              compare_at_price,
              grams,
              taxable: true,
              inventory_policy: 'deny',
              inventory_management: null,
            }),
          )
        } else {
          // If no variant exists for some reason, create one
          await withRetry(() =>
            shopify.productVariant.create(pid, {
              sku,
              price,
              compare_at_price,
              grams,
              taxable: true,
              inventory_policy: 'deny',
              inventory_management: null,
            }),
          )
        }
      } catch {
        // non-fatal
      }

      // <!-- BEGIN RBP GENERATED: shopify-sync-images-v1 -->
      // Images v1: pass-through by src, dedupe by remembered source URLs
      const imageSrcs: string[] = preview.images
      if (imageSrcs.length) {
        // Read previous image sources metafield (if any)
        const sourcesMf = await readImageSourcesMetafield(shopify, pid, NS)
        const prevSources: string[] = sourcesMf?.value ? JSON.parse(sourcesMf.value) : []

        // Only upload images with source URLs not seen before
        const toCreate = imageSrcs.filter(src => !prevSources.includes(src))

        if (toCreate.length) {
          // Optional: set alt text from title / externalId
          const altBase = `${core.title} (${String(after.externalId)})`
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
    } catch (err: any) {
      // Capture publish error details on the diff and continue
      try {
        await db.importDiff.update({
          where: { id: d.id },
          data: {
            validation: {
              ...(d.validation as any),
              publish: {
                ...(d.validation as any)?.publish,
                at: new Date().toISOString(),
                error: String(err?.message || err),
                status: err?.statusCode || err?.response?.status || null,
                detail: err?.response?.body ? safeStringify(err.response.body) : undefined,
              },
            } as any,
          },
        })
      } catch {
        /* ignore */
      }
      try {
        // Also mark staging row for quick triage if available
        const exId = String(after?.externalId || (d.before as any)?.externalId || '')
        if (exId) {
          await db.partStaging.updateMany({
            where: { supplierId: String(after?.supplierId || 'batson'), externalId: exId },
            data: { publishStatus: 'error', publishResult: { error: String(err?.message || err) } as any },
          })
        }
      } catch {
        /* ignore */
      }
      continue
    }
  }
  return results
}
// <!-- END RBP GENERATED: shopify-sync-v1 -->

function safeStringify(obj: any): string {
  try {
    if (typeof obj === 'string') return obj
    return JSON.stringify(obj)
  } catch {
    return String(obj)
  }
}
