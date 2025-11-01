// <!-- BEGIN RBP GENERATED: importer-crawlB-batson-attrgrid-v1 -->
import * as cheerio from 'cheerio'

export type BatsonGridRowRaw = {
  code: string
  model?: string
  availability?: string
  price?: number | null
  msrp?: number | null
  attributes: Record<string, string[]>
}

export type BlankSpec = {
  series?: string
  length_in?: number
  length_label?: string
  pieces?: number
  color?: string
  action?: string
  power?: string
  material?: string
  line_lb_min?: number
  line_lb_max?: number
  lure_oz_min?: number
  lure_oz_max?: number
  weight_oz?: number
  butt_dia_in?: number
  tip_top_size?: string
  applications?: string[]
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
  if (L === 'action') return 'action'
  if (L === 'power') return 'power'
  if (L === 'material') return 'material'
  if (L.startsWith('line rating')) return 'line_rating'
  if (L.startsWith('lure weight rating')) return 'lure_rating'
  if (L.startsWith('weight')) return 'weight_oz'
  if (L.startsWith('butt diameter')) return 'butt_dia_in'
  if (L.startsWith('tip top size')) return 'tip_top_size'
  if (L.startsWith('rod blank application')) return 'applications'
  return L
}

export function extractBatsonAttributeGrid(html: string, _baseUrl?: string) {
  const $ = cheerio.load(html)
  const rows: BatsonGridRowRaw[] = []
  $('table.table.attribute-grid tbody tr').each((_i, tr) => {
    const $tr = $(tr)
    const tds = $tr.find('td')
    const code = tds.eq(0).text().trim()
    if (!code) return

    const model = tds.eq(1).text().trim() || undefined
    const infoTd = $tr.find('td.information-attributes').first()
    const attrs: Record<string, string[]> = {}
    infoTd.find('li.information-attribute').each((_j, li) => {
      const label = $(li).find('.information-attribute__label').text().trim()
      const value = $(li).find('.information-attribute__text').text().trim()
      const key = mapLabelKey(label)
      if (!attrs[key]) attrs[key] = []
      if (value) attrs[key].push(value)
    })

    const availability = tds.eq(3).text().replace(/\s+/g, ' ').trim() || undefined

    const priceText = $tr
      .find('.price')
      .first()
      .text()
      .replace(/[^\d.]/g, '')
    const price = priceText ? Number(priceText) : null

    const msrpText = $tr
      .find('.muted')
      .first()
      .text()
      .replace(/[^\d.]/g, '')
    const msrp = msrpText ? Number(msrpText) : null

    rows.push({ code, model, availability, price, msrp, attributes: attrs })
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
        case 'action':
          n.action = v
          break
        case 'power':
          n.power = v
          break
        case 'material':
          n.material = v
          break
        case 'line_rating': {
          const { min, max } = parseRange(v)
          if (!isNaN(min)) n.line_lb_min = min
          if (!isNaN(max)) n.line_lb_max = max
          break
        }
        case 'lure_rating': {
          const { min, max } = parseRange(v)
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
    return { raw: r, spec: n }
  })

  return { rows: normalized }
}
// <!-- END RBP GENERATED: importer-crawlB-batson-attrgrid-v1 -->
