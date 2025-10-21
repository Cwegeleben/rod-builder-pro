// <!-- BEGIN RBP GENERATED: batson-extractor-v1 -->
import type { Page } from 'playwright'
import { extractJsonLd, mapProductFromJsonLd } from './jsonld'

type Extracted = {
  externalId: string
  title: string
  partType: string
  description?: string
  images: string[]
  rawSpecs: Record<string, unknown>
}

export async function extractProduct(page: Page): Promise<Extracted | null> {
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
  const jld = mapProductFromJsonLd(extractJsonLd(html))
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
  async function findCodeOnPage(): Promise<string | null> {
    try {
      const val = await page.evaluate(() => {
        const RE_LABEL = /code\s*[:-]?\s*([A-Za-z0-9-]{2,})/i
        const els = Array.from(document.querySelectorAll('body *'))
        for (const el of els) {
          const t = (el.textContent || '').trim()
          if (!/code/i.test(t)) continue
          const cont = (el.closest('tr,li,p,div,section') as HTMLElement | null) || (el as HTMLElement)
          const txt = (cont.textContent || '').trim()
          const m = txt.match(RE_LABEL)
          if (m) return m[1]
          const sib = el.nextElementSibling as HTMLElement | null
          if (sib) {
            const s = (sib.textContent || '').trim()
            const ms = s.match(/([A-Za-z0-9-]{2,})/)
            if (ms) return ms[1]
          }
        }
        return null
      })
      return val
    } catch {
      return null
    }
  }

  function normalizeExternalId(raw: string): string {
    return raw
      .replace(/\bcode:\s*/i, '')
      .replace(/[^A-Za-z0-9-]+/g, '')
      .toUpperCase()
  }

  function lastSlugSegment(u: string): string {
    try {
      const url = new URL(u)
      const parts = url.pathname.split('/').filter(Boolean)
      return parts[parts.length - 1] || ''
    } catch {
      return ''
    }
  }

  const codeVal = await findCodeOnPage()
  const fallbackSlug = lastSlugSegment(currentUrl) || title
  const externalId = normalizeExternalId(codeVal || fallbackSlug)
  // <!-- END RBP GENERATED: batson-extractor-id-v1 (code-extraction-and-normalization) -->

  const description = await page
    .locator('.product-description, .entry-content, .woocommerce-Tabs-panel--description')
    .first()
    .innerHTML()
    .catch(() => '')
  const images = (
    jld?.images && jld.images.length
      ? jld.images
      : await page.locator('img').evaluateAll(ns => ns.map(n => n.getAttribute('src') || '').filter(Boolean))
  ) as string[]

  const partType = guessPartType(`${title} ${description}`)
  const rawSpecs: Record<string, unknown> = {}

  return {
    externalId,
    title,
    partType,
    description: description || '',
    images: dedupe(images),
    rawSpecs: jld?.rawSpecs || rawSpecs,
  }
}

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
