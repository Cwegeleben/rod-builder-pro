// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import * as cheerio from 'cheerio'

const normalize = (href: string, base: string) => {
  let h = href.trim().replace(/[#?].*$/, '')
  if (!/^https?:\/\//i.test(h)) h = `${base}${h.startsWith('/') ? '' : '/'}${h}`
  return h
}

/**
 * Batson "Blanks-by-series" crawler
 * Selectors: prefer canonical /blanks-by-series links via multiple patterns; normalize and dedupe.
 */
export function crawlBatsonBlanksbySeries(html: string, base: string): string[] {
  const $ = cheerio.load(html)
  const out = new Set<string>()

  // Primary selectors
  $('.ejs-product-image-container[data-product-url]').each((_, el) => {
    const v = $(el).attr('data-product-url')
    if (v?.startsWith('/blanks-by-series/')) out.add(normalize(v, base))
  })

  $('li.product-title a[href]').each((_, el) => {
    const v = $(el).attr('href')
    if (v?.includes('/blanks-by-series/')) out.add(normalize(v, base))
  })

  $('.box-price a.btn[href]').each((_, el) => {
    const v = $(el).attr('href')
    if (v?.includes('/blanks-by-series/')) out.add(normalize(v, base))
  })

  // Fallbacks
  $('.ejs-productitem a[href]').each((_, el) => {
    const v = $(el).attr('href')
    if (v?.includes('/blanks-by-series/')) out.add(normalize(v, base))
  })

  $('a[href*="/blanks-by-series/"]').each((_, el) => {
    const v = $(el).attr('href')
    if (v) out.add(normalize(v, base))
  })

  // Generic attribute-based extraction (in case class names shift)
  $('[data-product-url*="/blanks-by-series/"]').each((_, el) => {
    const v = $(el).attr('data-product-url')
    if (v) out.add(normalize(v, base))
  })

  // Last-resort regex scan of raw HTML to capture inline JS and attributes
  try {
    const re = /\b(?:href|data-product-url)\s*=\s*"(\/blanks-by-series\/[^"]+)"/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const v = m[1]
      if (v) out.add(normalize(v, base))
    }
    const reSingle = /\b(?:href|data-product-url)\s*=\s*'(\/blanks-by-series\/[^']+)'/gi
    while ((m = reSingle.exec(html)) !== null) {
      const v = m[1]
      if (v) out.add(normalize(v, base))
    }
    const re2 = /\b\/(blanks-by-series\/[A-Za-z0-9_-]+)\b/g
    while ((m = re2.exec(html)) !== null) {
      const v = `/${m[1]}`
      if (v) out.add(normalize(v, base))
    }
  } catch {
    // ignore regex issues
  }

  const list = Array.from(out).filter(u => new URL(u).pathname.startsWith('/blanks-by-series/'))
  list.sort((a, b) => a.localeCompare(b))
  return list
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
