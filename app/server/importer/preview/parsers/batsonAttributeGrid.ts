// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import * as cheerio from 'cheerio'

export const PARSER_ID = 'batson-attribute-grid-v1'
export const SITE_TAG = 'batson'

const LABEL_MAP: Record<string, string> = {
  series: 'series',
  'item length (in)': 'length_in',
  'number of pieces': 'pieces',
  'rod blank color': 'color',
  action: 'action',
  power: 'power',
  material: 'material',
  'line rating (lbs.)': 'line_rating_lb',
  'weight (oz.)': 'weight_oz',
  'butt diameter': 'butt_dia_in',
  'tip top size': 'tip_top_size',
  'rod blank application': 'application',
}

const normalizeLabel = (s: string) => s.replace(/:\s*$/, '').trim().toLowerCase()
const cleanText = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim()

const toAbs = (href: string, base: string) =>
  /^https?:\/\//i.test(href) ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`

const toNumber = (s?: string | null) => {
  if (!s) return null
  const m = cleanText(s).match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

export function extractBatsonAttributeGrid(html: string, base: string) {
  const $ = cheerio.load(html)
  const out: Array<{
    url: string
    title?: string
    price?: number | null
    status?: string | null
    raw: Record<string, string>
    specs: Record<string, string | number | null>
  }> = []

  const $table = $('.attribute-grid tbody').first()
  if ($table.length === 0) return out

  $table.find('> tr').each((_, tr) => {
    const $tr = $(tr)
    const tds = $tr.find('td')
    if (tds.length === 0) return

    const code = cleanText($(tds.get(0)).text())
    const model = cleanText($(tds.get(1)).text())
    const availability = cleanText($(tds.get(3)).text() || '')
    const priceTxt = cleanText(
      $(tds.get(tds.length - 1))
        .find('.price')
        .first()
        .text(),
    )
    const price = toNumber(priceTxt)

    const linkEl = $tr.find('a[href]').first()
    const href = linkEl.attr('href')?.trim()
    const url = href ? toAbs(href, base) : ''

    // specs from .information-attributes (li rows)
    const specs: Record<string, string | number | null> = {}
    $tr.find('.information-attributes .information-attribute').each((__, li) => {
      const label = normalizeLabel($(li).find('.information-attribute__label').text())
      const value = cleanText($(li).find('.information-attribute__text').text())
      const key = LABEL_MAP[label] || label.replace(/\s+/g, '_')
      // numeric-ish keys
      if (key === 'length_in' || key === 'weight_oz' || key === 'butt_dia_in' || key === 'tip_top_size') {
        specs[key] = toNumber(value)
      } else {
        specs[key] = value
      }
    })

    const raw: Record<string, string> = {
      Code: code,
      Model: model,
      Availability: availability,
      Price: priceTxt,
    }

    out.push({
      url,
      title: linkEl.text().trim() || model || code,
      price,
      status: availability || null,
      raw,
      specs,
    })
  })

  return out
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
