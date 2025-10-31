// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import * as cheerio from 'cheerio'

const toAbs = (href: string, base: string) =>
  /^https?:\/\//i.test(href) ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`

// Extract series/listing links from Batson category/listing pages like /rod-blanks
export function crawlBatsonRodBlanksListing(html: string, base: string): string[] {
  const $ = cheerio.load(html)
  const urls = new Set<string>()

  // Primary: data-product-url on ejs-productitem within the ListingProducts container
  $('#ListingProducts .ejs-productitem[data-product-url], .ejs-productitem[data-product-url]').each((_, el) => {
    const rel = ($(el).attr('data-product-url') || '').trim()
    if (!rel) return
    urls.add(toAbs(rel, base))
  })

  // Additional: anchors within listing cards or product tiles
  $('#ListingProducts a[href], .productgrid a[href], .ejs-productitem a[href]').each((_, a) => {
    const href = ($(a).attr('href') || '').trim()
    if (!href) return
    if (/^\//.test(href) || /^https?:/i.test(href)) {
      urls.add(toAbs(href, base))
    }
  })

  // Common Shopify collection/list blocks on listing pages
  $(
    '#MainContent a[href], .collection-list a[href], .collection-grid a[href], .grid__item a[href], a.full-unstyled-link, a.card__heading',
  ).each((_, a) => {
    const href = ($(a).attr('href') || '').trim()
    if (!href) return
    if (/^\//.test(href) || /^https?:/i.test(href)) urls.add(toAbs(href, base))
  })

  // Fallback: anchors that look like rod-blanks series links
  $('a[href*="/rod-blanks/"]').each((_, a) => {
    const href = ($(a).attr('href') || '').trim()
    if (!href) return
    // Heuristic: keep only one-level deep series pages, avoid product detail with long paths
    urls.add(toAbs(href, base))
  })

  // Regex fallback: scan raw HTML for data-product-url or href with /rod-blanks/
  try {
    const reDbl =
      /\b(?:href|data-product-url)\s*=\s*"((?:\/rod-blanks\/|\/blanks-by-series\/|\/collections\/[^"']*blanks[^"']*)[^"#?<>]*)"/gi
    let m: RegExpExecArray | null
    while ((m = reDbl.exec(html))) urls.add(toAbs(m[1], base))
    const reSgl =
      /\b(?:href|data-product-url)\s*=\s*'((?:\/rod-blanks\/|\/blanks-by-series\/|\/collections\/[^'']*blanks[^'']*)[^'#?<>]*)'/gi
    while ((m = reSgl.exec(html))) urls.add(toAbs(m[1], base))
  } catch {
    /* ignore */
  }

  // Normalize/dedupe
  // Normalize/dedupe + heuristics: prefer /rod-blanks/... deeper than root; same-host only
  const list = Array.from(urls)
    .map(u => {
      try {
        const x = new URL(u)
        x.hash = ''
        x.search = ''
        return x.toString()
      } catch {
        return u
      }
    })
    // Keep likely series pages only; allow collections with blanks or known series markers
    .filter(u => /\/(rod-blanks|blanks-by-series|collections\/.*(blank|rod|rx|immortal|revelation))/i.test(u))
    .filter(u => !/\/(rod-blanks|blanks-by-series)\/?$/i.test(u))

  // Keep unique and limit to a sensible size
  return Array.from(new Set(list)).slice(0, 500)
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
