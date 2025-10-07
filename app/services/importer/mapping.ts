// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import type { AppliedItemRaw } from './selectorApply'

export interface NormalizedItem {
  title: string
  description?: string
  sku?: string
  vendor?: string
  price?: number
  images?: string[]
  productType: string
  sourceUrl?: string
  metafields: Record<string, unknown>
  raw: AppliedItemRaw
  warnings: string[]
  dedupeKey: string
}

export interface NormalizeOptions {
  productType: string
  pricingField?: string
  imageField?: string
  skuField?: string
  vendorField?: string
  titleField?: string
  descriptionField?: string
}

export function normalizeItems(rawItems: AppliedItemRaw[], opts: NormalizeOptions): NormalizedItem[] {
  return rawItems.map(r => {
    const g = (k?: string) => (k ? r.fields[k]?.value : '')
    const title = g(opts.titleField) || g('title')
    const description = g(opts.descriptionField) || g('description') || undefined
    const sku = g(opts.skuField) || g('sku') || undefined
    const vendor = g(opts.vendorField) || g('vendor') || undefined
    const priceStr = g(opts.pricingField) || g('price')
    const price = parsePrice(priceStr)
    const images = (g(opts.imageField) || g('images'))
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(Boolean)
    const warnings: string[] = []
    if (!title) warnings.push('missing-title')
    if (!price && price !== 0) warnings.push('missing-price')
    const metafields: Record<string, unknown> = {
      'rbp.meta.isImported': true,
      'rbp.meta.productType': opts.productType,
    }
    const dedupeKey = buildDedupeKey({ vendor, sku, title })
    return {
      title,
      description,
      sku,
      vendor,
      price,
      images,
      productType: opts.productType,
      sourceUrl: r.detailUrl,
      metafields,
      raw: r,
      warnings: warnings.concat(Object.values(r.fields).flatMap(f => f.warnings)),
      dedupeKey,
    }
  })
}

function parsePrice(v: string): number | undefined {
  if (!v) return undefined
  const num = parseFloat(v.replace(/[^0-9.+-]/g, ''))
  return isFinite(num) ? num : undefined
}

function buildDedupeKey(parts: { vendor?: string; sku?: string | undefined; title?: string }): string {
  if (parts.vendor && parts.sku) return `${parts.vendor}::${parts.sku}`.toLowerCase()
  return hash(parts.title || '')
}

function hash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return `h${h >>> 0}`
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
