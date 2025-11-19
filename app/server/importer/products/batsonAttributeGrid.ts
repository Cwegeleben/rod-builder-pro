// <!-- BEGIN RBP GENERATED: importer-crawlB-batson-attrgrid-v1 -->
import * as cheerio from 'cheerio'
import { formatLineLbRangeString, formatLureOzRangeString } from '../../../../packages/importer/src/lib/specRange'

export type BatsonGridRowRaw = {
  code: string
  model?: string
  availability?: string
  price?: number | null
  msrp?: number | null
  // Optional: detail page link discovered from the row (absolute URL)
  detailUrl?: string | null
  attributes: Record<string, string[]>
}

export type BlankSpec = {
  series?: string
  length_in?: number
  length_label?: string
  pieces?: number
  color?: string
  // Some categories (e.g., Reel Seats) expose a numeric or label size
  size_label?: string
  inside_dia_in?: number
  hood_od_in?: number
  body_od_in?: number
  action?: string
  power?: string
  material?: string
  // Human-friendly range strings (for display/specs)
  line_lb?: string
  line_lb_min?: number
  line_lb_max?: number
  lure_oz?: string
  lure_oz_min?: number
  lure_oz_max?: number
  weight_oz?: number
  butt_dia_in?: number
  tip_top_size?: string
  applications?: string[]
  // Series/page-level images propagated to each item
  images?: string[]
}

const fractionToFloat = (s: string) => {
  if (!s) return NaN
  if (s.includes('/')) {
    const [a, b] = s.split('/')
    const A = Number(a)
    const B = Number(b)
    if (A >= 0 && B > 0) return A / B
  }
  return Number(s)
}

const parseRange = (val: string) => {
  const clean = val.replace(/\s/g, '').replace(/lb\.?|oz\.?/gi, '')
  const [a, b] = clean.split('-')
  if (!b) return { min: fractionToFloat(a), max: fractionToFloat(a) }
  return { min: fractionToFloat(a), max: fractionToFloat(b) }
}

const parseLengthLabel = (label: string) => {
  // e.g., 8'3"
  const m = label.match(/(\d+)\s*'\s*(\d+)?/)
  if (!m) return { inches: undefined as number | undefined, label }
  const feet = Number(m[1] || 0)
  const inches = Number(m[2] || 0)
  return { inches: feet * 12 + inches, label }
}

function mapLabelKey(label: string): string {
  const L = label
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[:：]+$/, '')
    .trim()
  if (L.startsWith('series')) return 'series'
  if (L.startsWith('item length')) return 'length_in'
  if (L.startsWith('number of pieces')) return 'pieces'
  if (L.startsWith('rod blank color')) return 'color'
  if (L === 'color') return 'color'
  if (L === 'size') return 'size'
  if (L === 'action') return 'action'
  if (L === 'power') return 'power'
  if (L === 'material') return 'material'
  if (L.startsWith('line rating')) return 'line_rating'
  if (L.startsWith('lure weight rating')) return 'lure_rating'
  if (L.startsWith('weight')) return 'weight_oz'
  if (L.startsWith('butt diameter')) return 'butt_dia_in'
  if (L.startsWith('inside diameter')) return 'inside_dia_in'
  if (L.startsWith('hood outside diameter')) return 'hood_od_in'
  if (L.startsWith('body outside diameter')) return 'body_od_in'
  if (L.startsWith('tip top size')) return 'tip_top_size'
  if (L.startsWith('rod blank application')) return 'applications'
  return L
}

export function extractBatsonAttributeGrid(html: string, baseUrl?: string) {
  const $ = cheerio.load(html)
  // Resolve absolute URLs with a safe base
  const base = (() => {
    try {
      return baseUrl ? new URL(baseUrl).origin : 'https://batsonenterprises.com'
    } catch {
      return 'https://batsonenterprises.com'
    }
  })()
  const toAbs = (src: string | undefined | null): string | null => {
    if (!src) return null
    try {
      return new URL(src, base).toString()
    } catch {
      return src
    }
  }

  // Detect a single series-level image to attach to all rows on the page
  const pickSeriesImage = (): string | null => {
    const og = $('meta[property="og:image"]').attr('content')
    if (og) return toAbs(og)
    const main = $('#product-detail-gallery-main-img').attr('src')
    if (main) return toAbs(main)
    const firstGallery = $('.product-image img').attr('src') || $('.product-detail-gallery img').attr('src')
    if (firstGallery) return toAbs(firstGallery)
    const anyImg = $('img').first().attr('src')
    if (anyImg) return toAbs(anyImg)
    return null
  }
  const seriesImg = pickSeriesImage()
  const rows: BatsonGridRowRaw[] = []
  $('table.table.attribute-grid tbody tr').each((_i, tr) => {
    const $tr = $(tr)
    const tds = $tr.find('td')
    const code = tds.eq(0).text().trim()
    if (!code) return

    // On many Batson pages the second/third columns are Color and Size (or similar)
    const col2 = tds.eq(1).text().trim() || undefined
    const col3 = tds.eq(2).text().trim() || undefined
    const model = col2 // treat second column as model/variant label when present (often color)
    const infoTd = $tr.find('td.information-attributes').first()
    const attrs: Record<string, string[]> = {}
    infoTd.find('li.information-attribute').each((_j, li) => {
      const label = $(li).find('.information-attribute__label').text().trim()
      const value = $(li).find('.information-attribute__text').text().trim()
      const key = mapLabelKey(label)
      if (!attrs[key]) attrs[key] = []
      if (value) attrs[key].push(value)
    })

    // If the row has the information-attributes TD, take availability from the following TD
    let availability: string | undefined
    if (infoTd.length) {
      const infoIdx = infoTd.index()
      const availIdx = infoIdx >= 0 ? infoIdx + 1 : 3
      availability = tds.eq(availIdx).text().replace(/\s+/g, ' ').trim() || undefined
    } else {
      // Fallback to legacy position
      availability = tds.eq(3).text().replace(/\s+/g, ' ').trim() || undefined
    }

    // Promote color/size columns into attributes when not already present
    if (col2 && !(attrs['color'] && attrs['color'].length)) {
      attrs['color'] = [col2]
    }
    if (col3 && !(attrs['size'] && attrs['size'].length)) {
      attrs['size'] = [col3]
    }

    const priceText = $tr
      .find('.price, .your-price, .our-price, .price-value')
      .first()
      .text()
      .replace(/[^\d.]/g, '')
    const price = priceText ? Number(priceText) : null

    const msrpText = $tr
      .find('.muted, .msrp, .compare-at, .retail')
      .first()
      .text()
      .replace(/[^\d.]/g, '')
    const msrp = msrpText ? Number(msrpText) : null

    // Try to capture a detail URL from any anchor within the row
    let detailUrl: string | null = null
    const hrefs: string[] = []
    $tr.find('a[href]').each((_k, a) => {
      const h = ($(a).attr('href') || '').trim()
      if (h) hrefs.push(h)
    })
    for (const h of hrefs) {
      try {
        const abs = new URL(h, base).toString()
        if (/\/ecom\//i.test(abs) || /\/products?\//i.test(abs) || /\/rod-blanks\//i.test(abs)) {
          detailUrl = abs
          break
        }
      } catch {
        /* ignore bad href */
      }
    }

    rows.push({ code, model, availability, price, msrp, detailUrl, attributes: attrs })
  })

  // Normalize
  const normalized = rows.map(r => {
    const n: BlankSpec = { applications: [] }
    for (const [k, vals] of Object.entries(r.attributes)) {
      const v = vals[0] ?? ''
      switch (k) {
        case 'series':
          n.series = v
          break
        case 'length_in': {
          const { inches, label } = parseLengthLabel(v)
          if (inches) n.length_in = inches
          n.length_label = label ?? v
          break
        }
        case 'pieces':
          n.pieces = Number(v)
          break
        case 'color':
          n.color = v
          break
        case 'size':
          n.size_label = v
          break
        case 'action':
          n.action = v
          break
        case 'power':
          n.power = v
          break
        case 'material':
          n.material = v
          break
        case 'inside_dia_in': {
          const num = Number(v.replace(/[^\d.]/g, ''))
          if (!isNaN(num)) n.inside_dia_in = num
          break
        }
        case 'hood_od_in': {
          const num = Number(v.replace(/[^\d.]/g, ''))
          if (!isNaN(num)) n.hood_od_in = num
          break
        }
        case 'body_od_in': {
          const num = Number(v.replace(/[^\d.]/g, ''))
          if (!isNaN(num)) n.body_od_in = num
          break
        }
        case 'line_rating': {
          const { min, max } = parseRange(v)
          // Preserve human-readable string
          n.line_lb = formatLineLbRangeString(v)
          if (!isNaN(min)) n.line_lb_min = min
          if (!isNaN(max)) n.line_lb_max = max
          break
        }
        case 'lure_rating': {
          const { min, max } = parseRange(v)
          // Preserve human-readable string
          n.lure_oz = formatLureOzRangeString(v)
          if (!isNaN(min)) n.lure_oz_min = min
          if (!isNaN(max)) n.lure_oz_max = max
          break
        }
        case 'weight_oz': {
          const num = Number(v.replace(/[^\d.]/g, ''))
          if (!isNaN(num)) n.weight_oz = num
          break
        }
        case 'butt_dia_in': {
          const num = Number(v.replace(/[^\d.]/g, ''))
          if (!isNaN(num)) n.butt_dia_in = num
          break
        }
        case 'tip_top_size':
          n.tip_top_size = v
          break
        case 'applications':
          vals.forEach(x => n.applications!.push(x))
          break
        default:
          // ignore
          break
      }
    }
    if (seriesImg) n.images = [seriesImg]
    return { raw: r, spec: n }
  })

  return { rows: normalized }
}
// <!-- END RBP GENERATED: importer-crawlB-batson-attrgrid-v1 -->
