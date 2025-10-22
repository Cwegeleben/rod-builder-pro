// <!-- BEGIN RBP GENERATED: batson-extractor-v1 -->
// <!-- BEGIN RBP GENERATED: scrape-template-wiring-v2 -->
import type { Page } from 'playwright'
import { extractJsonLd, mapProductFromJsonLd } from './jsonld'
import { applyTemplate } from '../../../../src/importer/extract/applyTemplate'
import { slugFromPath, hash as hashUrl } from '../../../../src/importer/extract/fallbacks'

type Extracted = {
  externalId: string
  title: string
  partType: string
  description?: string
  images: string[]
  rawSpecs: Record<string, unknown>
}

export async function extractProduct(
  page: Page,
  opts?: { templateKey?: string },
): Promise<(Extracted & { usedTemplateKey?: string }) | null> {
  await page.waitForLoadState('domcontentloaded')
  // <!-- BEGIN RBP GENERATED: importer-normalize-diff-v1 -->
  const html = await page.content()
  // Quick 404/non-product guard
  const titleText = (await page.title().catch(() => ''))?.toLowerCase() || ''
  const bodyText = html.toLowerCase()
  if (titleText.includes('404') || bodyText.includes('code 404') || bodyText.includes('page not found')) {
    return null
  }
  // <!-- BEGIN RBP GENERATED: batson-extractor-id-v1 (utility-page-guard) -->
  // Skip utility pages like login and track your order
  if (titleText.includes('login') || bodyText.includes('track your order')) {
    return null
  }
  // <!-- END RBP GENERATED: batson-extractor-id-v1 (utility-page-guard) -->
  const jldAll = extractJsonLd(html)
  const jld = mapProductFromJsonLd(jldAll)
  // <!-- END RBP GENERATED: importer-normalize-diff-v1 -->
  const title =
    (
      await page
        .locator('h1, .product_title')
        .first()
        .textContent()
        .catch(() => null)
    )?.trim() ||
    jld?.title ||
    'Product'
  const currentUrl = page.url()
  // <!-- BEGIN RBP GENERATED: batson-extractor-id-v1 (code-extraction-and-normalization) -->
  // Prefer on-page Code: value; fallback to normalized last slug segment
  // removed legacy on-page code finder; relying on standardized fallbacks instead

  function normalizeExternalId(raw: string): string {
    return raw
      .replace(/\bcode:\s*/i, '')
      .replace(/[^A-Za-z0-9-]+/g, '')
      .toUpperCase()
  }

  // prefer robust fallbacks from shared helpers

  // External ID cascade:
  // 1) JSON-LD sku/mpn/productID/identifier (already in jld.externalId)
  // 2) JSON-LD @id
  // 3) DOM selectors (.sku | [itemprop=sku] | [data-sku]@content)
  // 4) slugFromPath(url)
  // 5) hash(url)
  let ext: string | null = (jld?.externalId as string | undefined)?.toString()?.trim() || null
  if (!ext) {
    const idFromAt = (() => {
      try {
        const prod = jldAll.find(o => !!(o as Record<string, unknown>)['@id']) as Record<string, unknown> | undefined
        return (prod?.['@id'] as string) || null
      } catch {
        return null
      }
    })()
    ext = idFromAt || null
  }
  if (!ext) {
    try {
      const domSku = await page.evaluate(() => {
        const el = document.querySelector('.sku, [itemprop="sku"]') as HTMLElement | null
        if (el) return (el.textContent || '').trim() || (el.getAttribute('content') || '').trim()
        const data = document.querySelector('[data-sku]') as HTMLElement | null
        if (data) return (data.getAttribute('data-sku') || '').trim()
        const meta = document.querySelector('[content][itemprop="sku"][content]') as HTMLElement | null
        if (meta) return (meta.getAttribute('content') || '').trim()
        return ''
      })
      ext = domSku || null
    } catch {
      /* ignore */
    }
  }
  if (!ext) ext = slugFromPath(currentUrl) || null
  if (!ext) ext = hashUrl(currentUrl)
  const externalId = normalizeExternalId((ext || '').toString())
  // <!-- END RBP GENERATED: batson-extractor-id-v1 (code-extraction-and-normalization) -->

  const description = await page
    .locator('.product-description, .entry-content, .woocommerce-Tabs-panel--description')
    .first()
    .innerHTML()
    .catch(() => '')
  const rawImages = (
    jld?.images && jld.images.length
      ? jld.images
      : await page.locator('img').evaluateAll(ns => ns.map(n => n.getAttribute('src') || '').filter(Boolean))
  ) as string[]
  // Normalize to absolute URLs and dedupe
  const images = Array.from(
    new Set(
      rawImages
        .map(src => {
          try {
            return new URL(src, currentUrl).toString()
          } catch {
            return src
          }
        })
        .filter(Boolean),
    ),
  )

  const partType = guessPartType(`${title} ${description}`)
  const rawSpecs: Record<string, unknown> = {}

  // If a template is provided, compute usedTemplateKey via applier (extraction is still primarily fallback-based)
  let usedTemplateKey: string | undefined
  try {
    if (opts?.templateKey) {
      const res = applyTemplate({ url: currentUrl, html }, { templateKey: opts.templateKey })
      usedTemplateKey = res.usedTemplateKey
    }
  } catch {
    /* ignore template errors */
  }

  return {
    externalId,
    title,
    partType,
    description: description || '',
    images: dedupe(images),
    rawSpecs: jld?.rawSpecs || rawSpecs,
    usedTemplateKey,
  }
}
// <!-- END RBP GENERATED: scrape-template-wiring-v2 -->

// <!-- BEGIN RBP GENERATED: batson-extractor-id-v1 (normalizer) -->
// normalizeExternalId integrated above to restrict to A–Z, 0–9 and hyphen only, and strip literal 'Code:'
// <!-- END RBP GENERATED: batson-extractor-id-v1 (normalizer) -->

function guessPartType(t: string) {
  const s = t.toLowerCase()
  if (s.includes('blank')) return 'blank'
  if (s.includes('guide')) return 'guide'
  if (s.includes('reel seat')) return 'seat'
  if (s.includes('grip')) return 'grip'
  if (s.includes('tip top') || s.includes('tip-top')) return 'tip_top'
  return 'other'
}

function dedupe(arr: string[]) {
  return Array.from(new Set(arr))
}
// <!-- END RBP GENERATED: batson-extractor-v1 -->
