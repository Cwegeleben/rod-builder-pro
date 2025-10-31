// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import * as cheerio from 'cheerio'

export type SeriesProduct = {
  url: string
  title?: string
  price?: number | null
  status?: string | null
  raw?: Record<string, string>
}

const toAbs = (href: string, base: string) =>
  /^https?:\/\//i.test(href) ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`

// Extract all product rows/items from one series page
export function extractSeriesProducts(html: string, base: string): SeriesProduct[] {
  const $ = cheerio.load(html)
  const out: SeriesProduct[] = []

  // Batson listing page pattern: #ListingProducts with .ejs-productitem elements
  // Prefer explicit data-product-url when present; this often lacks anchor tags
  $('#ListingProducts .ejs-productitem[data-product-url], .ejs-productitem[data-product-url]').each((_, el) => {
    const $el = $(el)
    const rel = ($el.attr('data-product-url') || '').trim()
    if (!rel) return
    const url = toAbs(rel, base)
    // Try to pick a reasonable title if available (fallback to undefined)
    const title =
      ($el.attr('data-product-title') || $el.find('.product-title, .title, a').first().text() || '').trim() || undefined
    out.push({ url, title, price: null, status: null, raw: {} })
  })

  // Primary: table/grid of product rows with headers
  let table = $('.table.attribute-grid').first()
  if (!table.length) table = $('table, .table, .product-list, .attribute-grid').first()
  if (table.length) {
    const rows = table.find('tr')
    let headers: string[] = []
    rows.each((i, tr) => {
      const $tr = $(tr)
      if (i === 0) {
        headers = $tr
          .find('th')
          .map((_, th) => $(th).text().trim().replace(/\s+/g, ' '))
          .get()
        return
      }
      const cells = $tr.find('td')
      if (!cells.length) return

      const raw: Record<string, string> = {}
      const linkEl = $tr.find('a[href]').first()
      const href = linkEl.attr('href')?.trim()
      let title = linkEl.text().trim() || undefined

      cells.each((ci, td) => {
        const key = headers[ci]?.trim() || `col${ci}`
        const $td = $(td)
        const text = $td.text().trim().replace(/\s+/g, ' ')
        raw[key] = text
        // If "Information" column exists, also flatten nested attribute label/value pairs
        if (/^Information$/i.test(key) || /Information/i.test(key)) {
          $td.find('.information-attributes .information-attribute').each((_, li) => {
            const k = $(li)
              .find('.attribute-title, .information-attribute__label')
              .text()
              .trim()
              .replace(/\s*:\s*$/, '')
            const v = $(li).find('.attribute-value, .information-attribute__text').text().trim().replace(/\s+/g, ' ')
            if (k) raw[k] = v
          })
        }
        // Title heuristic: prefer Model, else Code, if no anchor text
        if (!title) {
          if (/^Model$/i.test(key) && text) title = text
          else if (/^Code$/i.test(key) && text) title = text
        }
      })

      const url = href ? toAbs(href, base) : ''

      // Price: prefer Price column content, else scan
      let price: number | null = null
      try {
        const priceIdx = headers.findIndex(h => /Price/i.test(h))
        if (priceIdx >= 0) {
          const td = cells.get(priceIdx)
          const text = $(td).text()
          const m = text.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/)
          if (m) price = Number(m[1].replace(/,/g, ''))
        }
        if (price == null) {
          const m = Object.values(raw)
            .join(' ')
            .match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/)
          price = m ? Number(m[1].replace(/,/g, '')) : null
        }
      } catch {
        price = null
      }

      // Availability
      let status: string | null = null
      try {
        const avIdx = headers.findIndex(h => /Availability/i.test(h))
        if (avIdx >= 0) status = $(cells.get(avIdx)).text().trim().replace(/\s+/g, ' ') || null
      } catch {
        status = null
      }

      out.push({ url, title, price, status, raw })
    })
  }

  // Fallback: card/grid style product items with anchors
  if (out.length === 0) {
    $('.ejs-productitem a[href], .product-item a[href], a.product-title[href]').each((_, a) => {
      const $a = $(a)
      const href = $a.attr('href')?.trim()
      if (!href) return
      const url = toAbs(href, base)
      const title = $a.text().trim() || undefined
      out.push({ url, title, price: null, status: null, raw: {} })
    })
  }

  const seen = new Set<string>()
  return out.filter(p => {
    const key =
      p.url ||
      `${p.title || ''}|${Object.values(p.raw || {})
        .slice(0, 3)
        .join('|')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
