// <!-- BEGIN RBP GENERATED: shopify-sync-v1 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
// Idempotent Shopify upsert keyed by deterministic product handle and rbp.supplier_external_id metafield.
// Note: We use Shopify metafields as the linkage to avoid DB migrations. Handle = rbp-<supplierId>-<externalId>.
// At update time, we compare rbp.hash metafield against PartStaging.hashContent and skip if unchanged.

import Shopify from 'shopify-api-node'
import crypto from 'node:crypto'
import { prisma } from '../../../../app/db.server'

const NS = 'rbp'
// Shopify namespace must match pattern: lowercase alnum, underscores, or hyphens; dots are NOT allowed.
// Use rbp_spec instead of rbp.spec to satisfy Shopify's namespace regex.
const SPEC_NS = 'rbp_spec'

export type ShopCfg = {
  shopName: string
  accessToken: string
  apiVersion?: string
  approvedOnly?: boolean
  deleteOverride?: boolean
  addsOnly?: boolean
  // Optional selectors to scope which diffs are processed during a run
  onlyExternalIds?: string[]
  failedOnly?: boolean
}

function mkClient(cfg: ShopCfg) {
  return new Shopify({
    shopName: cfg.shopName,
    accessToken: cfg.accessToken,
    apiVersion: cfg.apiVersion || '2024-10',
  })
}

async function withRetry<T>(
  fn: () => Promise<T>,
  tries = 5,
  onRetry?: (attempt: number, waitMs: number, error: any) => void,
): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (e: any) {
      const code = e?.statusCode || e?.response?.status
      if (code === 429 && attempt < tries - 1) {
        const wait = Math.min(1000 * Math.pow(2, attempt), 8000)
        try {
          onRetry?.(attempt, wait, e)
        } catch {
          // ignore onRetry hook errors
        }
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

// Conservative pattern-safe fallback for metafields with regex validation
function patternSafe(s: string) {
  if (!s) return ''
  // Allow alnum, dash and underscore; collapse others to '-'
  const cleaned = s
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)+/g, '')
  // Clamp to Shopify single_line_text_field limit
  return cleaned.slice(0, 255)
}

function buildHandle(supplierId: string, externalId: string) {
  return `rbp-${slugify(supplierId)}-${slugify(externalId)}`
}

async function findProductByHandle(
  shopify: any,
  handle: string,
  onRetry?: (attempt: number, waitMs: number, e: any) => void,
) {
  const list = await withRetry(() => shopify.product.list({ handle }), 5, onRetry)
  return Array.isArray(list) && list.length ? list[0] : null
}

async function listProductMetafields(
  shopify: any,
  productId: number,
  onRetry?: (attempt: number, waitMs: number, e: any) => void,
): Promise<any[]> {
  return withRetry(
    () => shopify.metafield.list({ metafield: { owner_resource: 'product', owner_id: productId }, limit: 250 }),
    5,
    onRetry,
  )
}

async function upsertProductMetafield(
  shopify: any,
  productId: number,
  namespace: string,
  key: string,
  type: string,
  value: string,
  onRetry?: (attempt: number, waitMs: number, e: any) => void,
) {
  const existing = await listProductMetafields(shopify, productId, onRetry)
  const found = existing.find((m: any) => m.namespace === namespace && m.key === key)
  const attempt = async (val: string) => {
    if (!found) {
      return await withRetry(
        () =>
          shopify.metafield.create({
            owner_resource: 'product',
            owner_id: productId,
            namespace,
            key,
            type,
            value: val,
          }),
        5,
        onRetry,
      )
    } else {
      return await withRetry(() => shopify.metafield.update(found.id, { type, value: val }), 5, onRetry)
    }
  }
  try {
    await attempt(value)
  } catch (e: any) {
    const bodyStr = e?.response?.body ? safeStringify(e.response.body) : ''
    const combined = `${e?.message || ''} ${bodyStr}`
    const isPattern = /did not match the expected pattern|expected pattern/i.test(combined)
    // If the store enforces a regex on this metafield, retry with a conservative sanitized value
    if (isPattern && type === 'single_line_text_field') {
      const fallback = patternSafe(value)
      try {
        await attempt(fallback)
        return
      } catch (e2: any) {
        const body2 = e2?.response?.body ? safeStringify(e2.response.body) : ''
        const msg2 = `metafield upsert failed for ${namespace}.${key}: ${e2?.message || e2}; orig='${value.slice(0, 80)}' fallback='${fallback}'`
        const err2 = new Error(body2 ? `${msg2}; body=${body2}` : msg2)
        ;(err2 as any).statusCode = e2?.statusCode || e2?.response?.status
        throw err2
      }
    }
    const msg = `metafield upsert failed for ${namespace}.${key}: ${e?.message || e}`
    const err = new Error(bodyStr ? `${msg}; body=${bodyStr}` : msg)
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

function discreteSpecEntries(spec: Record<string, any>): {
  entries: Array<{ key: string; type: string; value: string }>
  unknownKeys: string[]
} {
  // Batson rod blanks (current target): emit ONLY text metafields; no numeric decomposition (min/max) or list types.
  // Accept future extension by detecting additional suppliers, but keep this minimal for now.
  const entries: Array<{ key: string; type: string; value: string }> = []
  const unknown: Set<string> = new Set()
  const asString = (val: unknown): string | null => {
    if (val === undefined || val === null) return null
    if (Array.isArray(val)) {
      const parts = val
        .map(v => (v === undefined || v === null ? '' : String(v)))
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 25)
      return parts.length ? parts.join(', ') : null
    }
    const s = String(val).trim()
    return s.length ? s : null
  }
  const push = (key: string, val: unknown) => {
    const v = asString(val)
    if (v == null) return
    entries.push({ key, type: 'single_line_text_field', value: v })
  }
  // Canonical simple string keys (string-only mode)
  const orderedKeys = [
    'series',
    'length_in',
    'pieces',
    'color',
    'action',
    'power',
    'material',
    'line_lb',
    'lure_oz',
    'weight_oz',
    'butt_dia_in',
    'ten_in_dia',
    'twenty_in_dia',
    'thirty_in_dia',
    'tip_top_size',
    'applications',
  ] as const
  for (const k of orderedKeys) push(k, spec[k])

  const known = new Set(entries.map(e => e.key))
  // Unknown keys passthrough (stringifiable, excluding already included)
  const sanitizeKey = (k: string): string => {
    const base = String(k || '')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
    if (!base) return ''
    return /^[0-9]/.test(base) ? `x_${base}` : base
  }
  for (const [rawKey, rawVal] of Object.entries(spec || {})) {
    if (known.has(rawKey)) continue
    const str = asString(rawVal)
    if (str == null) continue
    const key = sanitizeKey(rawKey)
    if (!key || known.has(key)) continue
    entries.push({ key, type: 'single_line_text_field', value: str })
    known.add(key)
    unknown.add(key)
  }
  // Guarantee presence of core identifiers even if absent
  for (const req of ['series', 'length_in', 'pieces']) {
    if (!known.has(req)) entries.push({ key: req, type: 'single_line_text_field', value: '-' })
  }
  return { entries, unknownKeys: Array.from(unknown) }
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
  let contentHash = String(after?.hashContent || '')
  if (!contentHash) {
    // Fallback: deterministic hash from core fields & specs summary to avoid blank rbp.hash
    const summary = {
      supplierId,
      externalId,
      title,
      sku: String(after?.sku || externalId),
      priceWh: after?.priceWh ?? null,
      priceMsrp: after?.priceMsrp ?? null,
      specs,
    }
    try {
      contentHash = crypto.createHash('sha256').update(JSON.stringify(summary)).digest('hex')
    } catch {
      contentHash = 'hash-fallback-' + Math.random().toString(36).slice(2, 10)
    }
  }

  const { price, compare_at_price } = extractPriceFields(after)
  const grams = gramsFromSpec(specs)
  const sku = patternSafe(String(after?.sku || externalId).trim())
  const tagsArr = [product_type, supplierId, `importRun:${runId}`]
  const tags = tagsArr.join(', ')

  const sup = String(after?.supplierId || '')
  const WRITE_SPECS = process.env.IMPORTER_WRITE_SPECS === '1' || /^batson(\b|-)/i.test(sup)
  const metafields: Array<{ namespace: string; key: string; type: string; value: string }> = []
  if (WRITE_SPECS) {
    metafields.push({ namespace: NS, key: 'specs', type: 'json', value: JSON.stringify(specs) })
  }
  metafields.push({ namespace: NS, key: 'supplier_external_id', type: 'single_line_text_field', value: externalId })
  metafields.push({ namespace: NS, key: 'hash', type: 'single_line_text_field', value: contentHash })
  try {
    if (WRITE_SPECS) {
      const { entries, unknownKeys } = discreteSpecEntries(specs)
      for (const e of entries) metafields.push({ namespace: SPEC_NS, key: e.key, type: e.type, value: e.value })
      // Optionally, attach unknown keys as diagnostic (hidden) under rbp namespace as JSON
      if (unknownKeys.length) {
        try {
          metafields.push({ namespace: NS, key: 'unknown_spec_keys', type: 'json', value: JSON.stringify(unknownKeys) })
        } catch {
          /* ignore */
        }
      }
    }
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

// Wrap Shopify SDK calls to surface response body in thrown Error for better diagnostics
async function callWithBody<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e: any) {
    const body = e?.response?.body ? safeStringify(e.response.body) : ''
    const msg = e?.message || String(e)
    const err = new Error(body ? `${msg}; body=${body}` : msg)
    ;(err as any).statusCode = e?.statusCode || e?.response?.status
    throw err
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

async function createProductImageFromSrc(
  shopify: any,
  productId: number,
  src: string,
  alt?: string,
  onRetry?: (attempt: number, waitMs: number, e: any) => void,
) {
  return await withRetry(() => shopify.productImage.create(productId, { src, alt }), 5, onRetry)
}

async function readImageSourcesMetafield(
  shopify: any,
  productId: number,
  namespace: string,
  onRetry?: (attempt: number, waitMs: number, e: any) => void,
) {
  const all = await withRetry<any[]>(
    () => shopify.metafield.list({ metafield: { owner_resource: 'product', owner_id: productId }, limit: 250 }),
    5,
    onRetry,
  )
  return (all as any[]).find((m: any) => m.namespace === namespace && m.key === 'image_sources') || null
}

async function writeImageSourcesMetafield(
  shopify: any,
  productId: number,
  namespace: string,
  sources: string[],
  onRetry?: (attempt: number, waitMs: number, e: any) => void,
) {
  const existing = await readImageSourcesMetafield(shopify, productId, namespace, onRetry)
  const payload = {
    owner_resource: 'product',
    owner_id: productId,
    namespace,
    key: 'image_sources',
    type: 'json',
    value: JSON.stringify(sources),
  }
  if (!existing) {
    return await withRetry(() => shopify.metafield.create(payload), 5, onRetry)
  }
  return await withRetry(
    () => shopify.metafield.update(existing.id, { type: 'json', value: JSON.stringify(sources) }),
    5,
    onRetry,
  )
}
// <!-- END RBP GENERATED: shopify-sync-images-v1 -->

export async function upsertShopifyForRun(
  runId: string,
  cfg: ShopCfg,
): Promise<Array<{ externalId: string; productId: number; handle: string; action: 'created' | 'updated' }>> {
  const shopify = mkClient(cfg)
  const db: any = prisma as any
  // Read run to obtain canonical supplierId for this import context
  let runSupplierId: string | null = null
  try {
    const run = await db.importRun.findUnique({ where: { id: runId } })
    runSupplierId = run?.supplierId ? String(run.supplierId) : null
  } catch {
    runSupplierId = null
  }
  const baseTypes = cfg.addsOnly ? ['add'] : cfg.deleteOverride ? ['add', 'change', 'delete'] : ['add', 'change']
  // Include 'nochange' so we can backfill spec metafields for existing Batson products that previously lacked them.
  const diffTypes = Array.from(new Set([...baseTypes, 'nochange']))
  const where: any = {
    importRunId: runId,
    diffType: { in: diffTypes },
  }
  if (cfg.approvedOnly) {
    where.resolution = 'approve'
  } else {
    where.OR = [{ resolution: 'approve' }, { resolution: null }]
  }
  let diffs = await db.importDiff.findMany({ where })
  // Scope to requested externalIds if provided
  if (Array.isArray(cfg.onlyExternalIds) && cfg.onlyExternalIds.length) {
    const allow = new Set(cfg.onlyExternalIds.map((x: string) => String(x)))
    diffs = diffs.filter((d: any) => allow.has(String(d.externalId)))
  }
  // If failedOnly, restrict to those that previously recorded a publish.error
  if (cfg.failedOnly) {
    diffs = diffs.filter((d: any) => {
      try {
        const v = d?.validation
        const obj = typeof v === 'string' ? JSON.parse(v) : v || {}
        const pub = obj?.publish || {}
        return !!pub?.error
      } catch {
        return false
      }
    })
  }
  const results: Array<{ externalId: string; productId: number; handle: string; action: 'created' | 'updated' }> = []

  for (const d of diffs) {
    const after: any = d.after
    // Ensure externalId is present on the staging "after" shape. Older runs omitted it from JSON payloads
    // which caused buildShopifyPreview to slugify "undefined" and generate an incorrect handle (rbp-<supplier>-undefined).
    // Fallback to the diff row's externalId when missing.
    if (after) {
      if (after.externalId === undefined || after.externalId === null) after.externalId = d.externalId
      if (after.supplierId === undefined || after.supplierId === null) after.supplierId = runSupplierId || 'batson'
    }
    try {
      // Per-item diagnostics
      const imageErrors: Record<string, string> = {}
      let variantError: string | undefined
      let rateLimited = false
      let retryCount = 0
      let retryWaitMs = 0
      const onRetry = (attempt: number, waitMs: number, e: any) => {
        const code = e?.statusCode || e?.response?.status
        if (code === 429) {
          rateLimited = true
          retryCount += 1
          retryWaitMs += waitMs || 0
        }
      }
      // Classification: skip series/category header rows that are not real products.
      // Generalized heuristic:
      //   - normalized specs empty AND raw specs empty, AND
      //   - externalId either contains known header tokens (e.g. SURF) OR lacks any 2+ digit streak (most real SKUs include 2+ consecutive digits)
      const rawSpecs = (after?.rawSpecs || {}) as Record<string, any>
      const normSpecs = (after?.normSpecs || {}) as Record<string, any>
      const noSpecs = Object.keys(rawSpecs).length === 0 && Object.keys(normSpecs).length === 0
      // Treat specs as effectively empty if normalized specs lack any core product-defining keys
      const coreKeys = ['length_in', 'pieces', 'action', 'power', 'material']
      const hasCoreSpec = coreKeys.some(k => {
        const v = normSpecs?.[k]
        return v != null && String(v).trim().length > 0
      })
      const exIdStr = String(after?.externalId || '')
      const has2PlusDigits = /\d{2,}/.test(exIdStr)
      const totalDigits = (exIdStr.match(/\d/g) || []).length
      const has3PlusDigitsTotal = totalDigits >= 3
      const knownHeaderToken = /\bSURF\b/i.test(exIdStr)
      // Refined: treat as header if (no specs OR no core specs) AND any of:
      //  - contains known header token (SURF), OR
      //  - lacks any 2+ consecutive digits, OR
      //  - has fewer than 3 digits in total (e.g., 'RX7-60')
      const isHeaderCandidate =
        (noSpecs || !hasCoreSpec) && (knownHeaderToken || !has2PlusDigits || !has3PlusDigitsTotal)
      if (isHeaderCandidate) {
        const supplierIdLocal = String(after?.supplierId || runSupplierId || 'batson')
        const externalIdLocal = String(after?.externalId || 'header')
        const handleLocal = buildHandle(supplierIdLocal, externalIdLocal)
        let archived = false
        let pidArch: number | null = null
        try {
          const existing = await findProductByHandle(shopify, handleLocal, onRetry)
          if (existing) {
            const pid = Number(existing.id)
            pidArch = pid
            if ((existing as any)?.status !== 'archived') {
              await withRetry(() => callWithBody(() => shopify.product.update(pid, { status: 'archived' })), 5, onRetry)
            }
            // Mark delete flag for clarity
            try {
              await upsertProductMetafield(shopify, pid, NS, 'delete_mark', 'single_line_text_field', '1', onRetry)
            } catch {
              /* ignore */
            }
            archived = true
          }
        } catch {
          /* ignore */
        }
        try {
          await db.importDiff.update({
            where: { id: d.id },
            data: {
              validation: {
                ...(d.validation as any),
                publish: {
                  at: new Date().toISOString(),
                  action: archived ? 'updated' : 'skipped',
                  productId: pidArch ?? undefined,
                  handle: handleLocal,
                  status: archived ? 'archived' : undefined,
                  webUrl: mkProductUrl(cfg.shopName, handleLocal),
                  skipReason: archived ? 'series-header-archived' : 'series-header-skipped',
                  detail: 'Detected series/category header by no-specs heuristic; not a real product',
                },
              } as any,
            },
          })
        } catch {
          /* ignore */
        }
        if (archived && pidArch != null) {
          results.push({ externalId: externalIdLocal, productId: pidArch, handle: handleLocal, action: 'updated' })
        }
        continue
      }
      // Handle delete overrides separately using `before`
      if (d.diffType === 'delete' && cfg.deleteOverride) {
        const before: any = d.before
        if (!before) continue
        const supplierId = String(before?.supplierId || runSupplierId || 'batson')
        const externalId = String(before.externalId)
        const handle = buildHandle(supplierId, externalId)
        const product = await findProductByHandle(shopify, handle, onRetry)
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
        await withRetry(() => shopify.product.update(pid, { status: 'archived' }), 5, onRetry)
        await upsertProductMetafield(shopify, pid, NS, 'delete_mark', 'single_line_text_field', '1', onRetry)
        results.push({ externalId, productId: pid, handle, action: 'updated' })
        continue
      }
      if (!after) continue

      const preview = buildShopifyPreview(after, runId)
      const { ok, errors } = validateShopifyPreview(preview)
      if (!ok) {
        throw new Error(`Invalid Shopify payload: ${errors.join('; ')}`)
      }
      // Sanitize metafields and enforce size budgets
      const { metafields: sanitizedMetafields, warnings: mfWarnings } = sanitizeMetafields(preview.metafields)
      const { core, variant } = preview
      const { handle } = core
      const contentHash = String(after.hashContent || '')

      let product = await findProductByHandle(shopify, handle, onRetry)

      if (!product) {
        // Create with a single default variant if available
        const variants = [variant]
        // Ensure products are visible by default in Online Store
        product = await withRetry(
          () =>
            callWithBody(() =>
              shopify.product.create({
                ...core,
                status: 'active',
                // published_scope deprecated on some API versions; rely on status only
                variants,
              }),
            ),
          5,
          onRetry,
        )
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
                  status: (product as any)?.status || 'active',
                  webUrl: mkProductUrl(cfg.shopName, handle),
                },
              } as any,
            },
          })
        } catch {
          // non-fatal
        }
      } else {
        // Check rbp.hash metafield; skip if unchanged
        const mfs = await listProductMetafields(shopify, Number(product.id), onRetry)
        const mfHash = mfs.find((m: any) => m.namespace === NS && m.key === 'hash')
        const prevHash = mfHash?.value || ''
        if (prevHash === contentHash) {
          // Even if unchanged, ensure spec metafields exist for Batson products.
          let ensureSpecs = false
          try {
            const mfSpecKeys = new Set(mfs.filter((m: any) => m.namespace === SPEC_NS).map((m: any) => m.key))
            const supplierIdLocal = String(after?.supplierId || runSupplierId || '')
            if (/^batson(\b|-)/i.test(supplierIdLocal) && (!mfSpecKeys.size || !mfSpecKeys.has('series'))) {
              ensureSpecs = true
            }
          } catch {
            /* ignore */
          }
          // Additionally, allow title updates even when hash is unchanged so we can
          // publish normalized titles without forcing a content hash change.
          const currentTitle = String((product as any)?.title || '')
          const needTitleUpdate = currentTitle !== core.title
          if (needTitleUpdate) {
            await withRetry(
              () =>
                callWithBody(() => shopify.product.update(Number(product.id), { title: core.title, status: 'active' })),
              5,
              onRetry,
            )
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
                      status: 'active',
                      webUrl: mkProductUrl(cfg.shopName, handle),
                      skipReason: 'hash-unchanged-title-updated',
                    },
                  } as any,
                },
              })
            } catch {
              /* non-fatal */
            }
            // Title-only update path complete; skip further writes for this item.
            continue
          }
          if (ensureSpecs) {
            // Build preview solely to get metafields; skip core update (unchanged)
            const preview = buildShopifyPreview(after, runId)
            const { metafields: sanitizedMetafields } = sanitizeMetafields(preview.metafields)
            const pid = Number(product.id)
            for (const mf of sanitizedMetafields) {
              try {
                await upsertProductMetafield(shopify, pid, mf.namespace, mf.key, mf.type, mf.value, onRetry)
              } catch {
                /* continue */
              }
            }
          }
          // Activation enforcement if needed
          if ((product as any)?.status !== 'active') {
            await withRetry(
              () => callWithBody(() => shopify.product.update(Number(product.id), { status: 'active' })),
              5,
              onRetry,
            )
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
                      productId: Number(product.id),
                      handle,
                      status: 'active',
                      webUrl: mkProductUrl(cfg.shopName, handle),
                      skipReason: 'hash-unchanged-specs-backfilled',
                    },
                  } as any,
                },
              })
            } catch {
              /* non-fatal */
            }
          } else {
            try {
              await db.importDiff.update({
                where: { id: d.id },
                data: {
                  validation: {
                    ...(d.validation as any),
                    publish: {
                      at: new Date().toISOString(),
                      action: 'skipped',
                      productId: Number(product.id),
                      handle,
                      status: (product as any)?.status || 'active',
                      webUrl: mkProductUrl(cfg.shopName, handle),
                      skipReason: ensureSpecs ? 'unchanged-specs-backfilled' : 'unchanged-and-active',
                    },
                  } as any,
                },
              })
            } catch {
              /* ignore */
            }
          }
          continue
        }
        await withRetry(
          () => callWithBody(() => shopify.product.update(Number(product.id), { ...core, status: 'active' })),
          5,
          onRetry,
        )
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
                  status: 'active',
                  webUrl: mkProductUrl(cfg.shopName, handle),
                },
              } as any,
            },
          })
        } catch {
          // non-fatal
        }
      }

      const pid = Number(product.id)
      const perKeyErrors: Record<string, string> = {}
      for (const mf of sanitizedMetafields) {
        const keyId = `${mf.namespace}.${mf.key}`
        try {
          await upsertProductMetafield(shopify, pid, mf.namespace, mf.key, mf.type, mf.value, onRetry)
        } catch (e: any) {
          const body = e?.response?.body ? safeStringify(e.response.body) : ''
          perKeyErrors[keyId] = e?.message ? String(e.message) : body || 'metafield write failed'
          // continue with other metafields
        }
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
            callWithBody(() =>
              shopify.productVariant.update(vid, {
                sku,
                price,
                compare_at_price,
                grams,
                taxable: true,
                inventory_policy: 'deny',
                inventory_management: null,
              }),
            ),
          )
        } else {
          // If no variant exists for some reason, create one
          await withRetry(() =>
            callWithBody(() =>
              shopify.productVariant.create(pid, {
                sku,
                price,
                compare_at_price,
                grams,
                taxable: true,
                inventory_policy: 'deny',
                inventory_management: null,
              }),
            ),
          )
        }
      } catch (ve: any) {
        // non-fatal, record variant error
        variantError = String(ve?.message || ve)
      }

      // <!-- BEGIN RBP GENERATED: shopify-sync-images-v1 -->
      // Images v1: pass-through by src, dedupe by remembered source URLs
      const imageSrcs: string[] = preview.images
      if (imageSrcs.length) {
        // Read previous image sources metafield (if any)
        const sourcesMf = await readImageSourcesMetafield(shopify, pid, NS, onRetry)
        const prevSources: string[] = sourcesMf?.value ? JSON.parse(sourcesMf.value) : []

        // Only upload images with source URLs not seen before
        const toCreate = imageSrcs.filter(src => !prevSources.includes(src))

        if (toCreate.length) {
          // Optional: set alt text from title / externalId
          const altBase = `${core.title} (${String(after.externalId)})`
          for (const src of toCreate) {
            try {
              await createProductImageFromSrc(shopify, pid, src, altBase, onRetry)
            } catch (ie: any) {
              // Non-fatal: record per-image error and continue
              imageErrors[src] = String(ie?.message || ie)
            }
          }
          const newSources = Array.from(new Set([...prevSources, ...toCreate]))
          await writeImageSourcesMetafield(shopify, pid, NS, newSources, onRetry)
        }
      }
      // <!-- END RBP GENERATED: shopify-sync-images-v1 -->

      // Post-publish verification and diagnostics write
      try {
        const verify = await findProductByHandle(shopify, handle)
        const status = (verify as any)?.status || (product as any)?.status || null
        const webUrl = mkProductUrl(cfg.shopName, handle)
        const publishDiag: any = {
          at: new Date().toISOString(),
          productId: Number(product.id),
          handle,
          status,
          webUrl,
        }
        // Important: do NOT spread previous publish diagnostics here, as that can
        // accidentally re-introduce a prior publish.error after a successful retry.
        // Build a fresh publish object for the final snapshot.
        const diag: any = {
          ...(d.validation as any),
          publish: {
            ...publishDiag,
            metafieldErrors: Object.keys(perKeyErrors).length ? perKeyErrors : undefined,
            metafieldWarnings: mfWarnings.length ? mfWarnings : undefined,
            publishWarnings: rateLimited
              ? [`rate limited: retried ${retryCount} times; waited ~${retryWaitMs}ms`]
              : undefined,
            variantError,
            imageErrors: Object.keys(imageErrors).length ? imageErrors : undefined,
          },
        }
        await db.importDiff.update({ where: { id: d.id }, data: { validation: diag as any } })
      } catch {
        // ignore verification write issues
      }
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

// Metafield sanitization and size budgeting
export function sanitizeMetafields(
  metafields: Array<{ namespace: string; key: string; type: string; value: string }>,
): {
  metafields: Array<{ namespace: string; key: string; type: string; value: string }>
  warnings: string[]
} {
  const warnings: string[] = []
  const MAX_STR = 255
  const MAX_LIST = 25
  const MAX_JSON_BYTES = toNumber(process.env.SPECS_MAX_BYTES) || 80000

  const cleanSingle = (s: string) => s.replace(/[\r\n]+/g, ' ').slice(0, MAX_STR)
  const isListType = (t: string) => t.startsWith('list.')

  const out: Array<{ namespace: string; key: string; type: string; value: string }> = []

  for (const mf of metafields) {
    const { namespace, key } = mf
    // Coerce all SPEC_NS attributes to single_line_text_field regardless of input type
    let type = mf.type
    let value = mf.value
    if (namespace === SPEC_NS) {
      type = 'single_line_text_field'
      // If the value was a list JSON, parse and join into a single string
      try {
        const maybeArr = JSON.parse(String(value))
        if (Array.isArray(maybeArr)) {
          const parts = maybeArr
            .map(v => (v === undefined || v === null ? '' : String(v)))
            .map(s => s.trim())
            .filter(Boolean)
            .slice(0, MAX_LIST)
          value = parts.join(', ')
        } else {
          value = String(value)
        }
      } catch {
        value = String(value)
      }
    }
    try {
      // Special-case: supplier_external_id may have a store-defined regex pattern; coerce to a slug-safe token
      if (namespace === 'rbp' && key === 'supplier_external_id') {
        const raw = String(value || '')
        // Use existing slugify but keep underscores if present by replacing spaces and illegal chars with '-'
        const cleaned = slugify(raw.replace(/_/g, '-'))
        // Silent sanitation: do not emit a warning for routine normalization (keeps tests stable)
        value = cleaned
      }
      // Special-case: drop rbp.hash when empty after sanitization to avoid 422 "can't be blank" from Shopify
      if (namespace === 'rbp' && key === 'hash') {
        const raw = String(value || '')
        const cleaned = cleanSingle(raw)
        const coerced = patternSafe(cleaned)
        if (!coerced) {
          warnings.push('drop rbp.hash: empty value')
          continue
        }
        value = coerced
        type = 'single_line_text_field'
      }
      if (type === 'single_line_text_field') {
        // Proactively coerce to a conservative pattern-safe form to satisfy store regex definitions
        const raw = String(value || '')
        const cleaned = cleanSingle(raw)
        // If the shop enforces a stricter regex on this metafield, pre-sanitize
        // to alnum/underscore/dash to minimize 422s before retry
        const patternCoerced = patternSafe(cleaned)
        value = patternCoerced
      } else if (type === 'number_integer') {
        const n = Number(String(value || '').trim())
        if (!Number.isInteger(n)) {
          warnings.push(`drop ${namespace}.${key}: invalid integer`)
          continue
        }
        value = String(n)
      } else if (type === 'number_decimal') {
        const n = Number(String(value || '').trim())
        if (!Number.isFinite(n)) {
          warnings.push(`drop ${namespace}.${key}: invalid decimal`)
          continue
        }
        value = String(n)
      } else if (isListType(type)) {
        let arr: any
        try {
          arr = JSON.parse(String(value || '[]'))
        } catch {
          warnings.push(`drop ${namespace}.${key}: invalid list json`)
          continue
        }
        if (!Array.isArray(arr)) {
          warnings.push(`drop ${namespace}.${key}: not an array`)
          continue
        }
        const trimmed = arr
          .map((x: any) => (typeof x === 'string' ? cleanSingle(x) : null))
          .filter((x: any) => typeof x === 'string' && x.length > 0)
          .slice(0, MAX_LIST)
        value = JSON.stringify(trimmed)
      } else if (type === 'json') {
        // Ensure valid JSON; budget size for rbp.specs specifically
        let obj: any
        try {
          obj = typeof value === 'string' ? JSON.parse(value) : value
        } catch {
          warnings.push(`drop ${namespace}.${key}: invalid json`)
          continue
        }
        let jsonStr = JSON.stringify(obj)
        if (namespace === 'rbp' && key === 'specs' && Buffer.byteLength(jsonStr, 'utf8') > MAX_JSON_BYTES) {
          const { summary, hash } = summarizeSpecs(obj)
          jsonStr = JSON.stringify(summary)
          warnings.push(`rbp.specs truncated to summary; full hash=${hash}`)
          // Also include specs_full_hash metafield
          out.push({ namespace: 'rbp', key: 'specs_full_hash', type: 'single_line_text_field', value: hash })
        }
        value = jsonStr
      }
      out.push({ namespace, key, type, value })
    } catch {
      warnings.push(`drop ${mf.namespace}.${mf.key}: sanitize error`)
    }
  }
  return { metafields: out, warnings }
}

export function summarizeSpecs(obj: Record<string, any>): { summary: Record<string, any>; hash: string } {
  const pick = (k: string) => (obj && Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined)
  const keys = [
    'series',
    'length_in',
    'pieces',
    'color',
    'action',
    'power',
    'material',
    'line_lb',
    'lure_oz',
    'weight_oz',
    'butt_dia_in',
    'tip_top_size',
    'applications',
    'ten_in_dia',
    'twenty_in_dia',
    'thirty_in_dia',
  ]
  const summary: Record<string, any> = {}
  for (const k of keys) summary[k] = pick(k)
  // Preserve presence of any additional keys from original object (value undefined for consistency)
  for (const extra of Object.keys(obj)) {
    if (!keys.includes(extra)) {
      // Ensure key exists (explicitly undefined) so downstream tests can assert presence
      if (!(extra in summary)) summary[extra] = undefined
    }
  }
  const hash = crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex')
  return { summary, hash }
}

function mkProductUrl(shop: string, handle: string): string | null {
  if (!shop || !handle) return null
  const domain = shop.replace(/^https?:\/\//, '')
  return `https://${domain}/products/${handle}`
}
