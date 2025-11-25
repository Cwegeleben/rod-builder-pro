// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import * as cheerio from 'cheerio'

type CheerioRoot = ReturnType<typeof cheerio.load>

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
  color: 'color',
  finish: 'finish',
  'inside diameter': 'inside_dia_in',
  'outside diameter': 'outside_dia_in',
  'grip front outside diameter': 'front_od_in',
  'grip tenon outside diameter': 'tenon_od_in',
  'grip rear outside diameter': 'rear_od_in',
  'lure weight rating (oz.)': 'lure_weight_oz',
}

const normalizeLabel = (s: string) => s.replace(/:\s*$/, '').trim().toLowerCase()
const cleanText = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim()

const NUMERIC_KEYS = new Set([
  'weight_oz',
  'butt_dia_in',
  'tip_top_size',
  'inside_dia_in',
  'outside_dia_in',
  'front_od_in',
  'tenon_od_in',
  'rear_od_in',
])

type PriceTextHint = 'price' | 'msrp' | 'unknown'

interface PriceTextFragment {
  text?: string | null
  hint?: PriceTextHint
}

const normalizeLength = (value: string): { label: string; inches: number | null } => {
  const label = cleanText(value)
  if (!label) return { label: '', inches: null }
  const normalized = label.replace(/[”″]/g, '"').replace(/[’′]/g, "'").replace(/in\.?/gi, '"').trim()
  const match = normalized.match(/(?:(\d+)\s*'\s*)?(\d+(?:\.\d+)?)(?:\s*"|$)/)
  if (match) {
    const feet = match[1] ? Number(match[1]) : 0
    const inches = match[2] ? Number(match[2]) : 0
    const total = Number.isFinite(feet) && Number.isFinite(inches) ? feet * 12 + inches : null
    return { label, inches: total }
  }
  const fallback = toNumber(label)
  return { label, inches: fallback }
}

const assignSpecValue = (specs: Record<string, string | number | null>, key: string, value: string): void => {
  if (!key || !value) return
  if (key === 'length_in') {
    const { label, inches } = normalizeLength(value)
    if (label) specs.length_label = label
    if (inches != null) specs.length_in = inches
    return
  }
  if (key === 'pieces') {
    const num = Number.parseInt(value, 10)
    specs.pieces = Number.isFinite(num) ? num : cleanText(value)
    return
  }
  if (key === 'line_rating_lb') {
    specs.line_rating = cleanText(value)
    return
  }
  if (key === 'lure_weight_oz') {
    specs.lure_weight = cleanText(value)
    return
  }
  if (NUMERIC_KEYS.has(key)) {
    const num = toNumber(value)
    specs[key] = num != null ? num : cleanText(value)
    return
  }
  specs[key] = cleanText(value)
}

const toAbs = (href: string, base: string) => {
  try {
    return new URL(href, base).toString()
  } catch {
    return href
  }
}

const toNumber = (s?: string | null) => {
  if (!s) return null
  const m = cleanText(s).match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

const extractHeaderPricePair = ($: CheerioRoot) => {
  const h1 = $('h1').first()
  if (!h1.length) return null
  const startingBlock = h1.closest('div.row-fluid')
  const candidateGroups: Array<cheerio.Cheerio<cheerio.Element>> = []
  candidateGroups.push(h1.nextAll('div'))
  if (startingBlock.length) {
    candidateGroups.push(startingBlock.nextAll('div'))
  }
  const parentDiv = h1.parent('div')
  if (parentDiv.length && (!startingBlock.length || parentDiv.get(0) !== startingBlock.get(0))) {
    candidateGroups.push(parentDiv.nextAll('div'))
  }
  let targetBlockEl: cheerio.Element | null = null
  for (const group of candidateGroups) {
    group.each((_, el) => {
      const $el = $(el)
      if ($el.find('strong.price, small.muted').length) {
        targetBlockEl = el
        return false
      }
      return undefined
    })
    if (targetBlockEl) break
  }
  if (!targetBlockEl) return null
  const targetBlock = $(targetBlockEl)
  const fragments: PriceTextFragment[] = []
  targetBlock.find('strong.price').each((_, el) => {
    const txt = cleanText($(el).text())
    if (txt) fragments.push({ text: txt, hint: 'price' })
  })
  targetBlock.find('small.muted').each((_, el) => {
    const txt = cleanText($(el).text())
    if (txt) fragments.push({ text: txt, hint: /^msrp/i.test(txt) ? 'msrp' : 'unknown' })
  })
  if (!fragments.length) return null
  const pair = extractPricePairFromRow({ fallbackTexts: fragments })
  if (pair.priceMsrp == null && pair.priceWholesale == null) return null
  return pair
}

export function extractBatsonAttributeGrid(html: string, base: string) {
  const $ = cheerio.load(html)
  const headerPricePair = extractHeaderPricePair($)
  const out: Array<{
    url: string
    title?: string
    price?: number | null
    priceMsrp?: number | null
    priceWholesale?: number | null
    status?: string | null
    raw: Record<string, string>
    specs: Record<string, string | number | null>
  }> = []

  const $table = $('.attribute-grid').first()
  const $tbody = $table.find('tbody').first()
  if ($tbody.length === 0) return out
  const headerLabels: string[] = []
  $table.find('thead th').each((_, th) => headerLabels.push(cleanText($(th).text())))

  $tbody.find('> tr').each((_, tr) => {
    const $tr = $(tr)
    const tds = $tr.find('td')
    if (tds.length === 0) return

    let code = cleanText($(tds.get(0)).text())
    let model = tds.length > 1 ? cleanText($(tds.get(1)).text()) : ''
    let availability = ''
    let priceTxt = ''
    let msrpTxt = ''
    let rowHasPriceElement = false
    const raw: Record<string, string> = {}
    const specs: Record<string, string | number | null> = {}
    const priceNotes: PriceTextFragment[] = []

    tds.each((idx, td) => {
      const header = headerLabels[idx] || ''
      const headerKey = normalizeLabel(header)
      const hasInfoBlock = $(td).find('.information-attributes').length > 0
      if (headerKey === 'code') {
        const txt = cleanText($(td).text())
        if (txt) code = txt
        raw[header || 'Code'] = txt
        return
      }
      if (headerKey === 'model') {
        const txt = cleanText($(td).text())
        if (txt) model = txt
        raw[header || 'Model'] = txt
        return
      }
      if (headerKey === 'availability') {
        availability = cleanText($(td).text())
        raw[header || 'Availability'] = availability
        return
      }
      if (headerKey === 'price') {
        const inlinePriceEl = $(td).find('.price').first()
        if (inlinePriceEl.length && cleanText(inlinePriceEl.text())) {
          rowHasPriceElement = true
        }
        priceTxt = cleanText(inlinePriceEl.text() || $(td).text())
        if (priceTxt) priceNotes.push({ text: priceTxt, hint: 'price' })
        raw[header || 'Price'] = priceTxt
        const mutedValues = $(td)
          .find('.muted')
          .toArray()
          .map(el => cleanText($(el).text()))
          .filter(Boolean)
        for (const text of mutedValues) {
          priceNotes.push({ text, hint: /^msrp\b/i.test(text) ? 'msrp' : 'unknown' })
        }
        const msrpCandidate = mutedValues.find(text => /^msrp\b/i.test(text))
        if (msrpCandidate) {
          msrpTxt = msrpCandidate
          raw.MSRP = msrpCandidate
        }
        const columnText = cleanText($(td).text())
        if (columnText) {
          priceNotes.push({ text: columnText, hint: /msrp/i.test(columnText) ? 'msrp' : 'price' })
        }
        return
      }
      if (!hasInfoBlock) {
        const txt = cleanText($(td).text())
        if (txt && header) {
          raw[header] = txt
          const mappedKey = LABEL_MAP[headerKey] || headerKey.replace(/\s+/g, '_')
          assignSpecValue(specs, mappedKey, txt)
        }
      }
    })

    if (!priceTxt) {
      const inlinePriceEl = $(tds.get(tds.length - 1))
        .find('.price')
        .first()
      if (inlinePriceEl.length && cleanText(inlinePriceEl.text())) {
        rowHasPriceElement = true
      }
      priceTxt = cleanText(inlinePriceEl.text())
    }
    if (!msrpTxt) {
      msrpTxt =
        $tr
          .find('.muted')
          .toArray()
          .map(el => cleanText($(el).text()))
          .find(text => /^msrp\b/i.test(text)) || ''
    }
    if (msrpTxt) {
      priceNotes.push({ text: msrpTxt, hint: 'msrp' })
    }
    const rowHasInlinePrice = rowHasPriceElement
    let price = toNumber(priceTxt)
    if (!rowHasInlinePrice && /^msrp\b/i.test(priceTxt)) {
      price = null
    }
    const msrpVal = msrpTxt ? toNumber(msrpTxt) : undefined
    const { priceMsrp: resolvedPriceMsrp, priceWholesale: resolvedPriceWholesale } = extractPricePairFromRow({
      priceValue: price,
      priceText: priceTxt,
      msrpValue: msrpVal,
      msrpText: msrpTxt,
      fallbackTexts: priceNotes,
    })
    let effectivePriceMsrp = resolvedPriceMsrp
    let effectivePriceWholesale = resolvedPriceWholesale
    let effectivePrice = price
    const hasRowPrice =
      typeof price === 'number' || typeof resolvedPriceMsrp === 'number' || typeof resolvedPriceWholesale === 'number'
    if (headerPricePair) {
      if (effectivePriceMsrp == null && effectivePriceWholesale == null && headerPricePair.priceWholesale != null) {
        effectivePriceWholesale = headerPricePair.priceWholesale
        effectivePriceMsrp =
          headerPricePair.priceMsrp != null ? headerPricePair.priceMsrp : headerPricePair.priceWholesale
        effectivePrice = headerPricePair.priceWholesale
      }
      const headerHasDistinctPair =
        headerPricePair.priceMsrp != null &&
        headerPricePair.priceWholesale != null &&
        headerPricePair.priceMsrp !== headerPricePair.priceWholesale
      if (!hasRowPrice) {
        effectivePriceMsrp = headerPricePair.priceMsrp
        effectivePriceWholesale = headerPricePair.priceWholesale
        if (typeof effectivePriceWholesale === 'number') {
          effectivePrice = effectivePriceWholesale
        } else if (typeof effectivePriceMsrp === 'number') {
          effectivePrice = effectivePriceMsrp
        }
      }
      if (effectivePriceMsrp == null && headerPricePair.priceMsrp != null) {
        effectivePriceMsrp = headerPricePair.priceMsrp
      }
      const shouldAdoptHeaderWholesale =
        effectivePriceWholesale == null ||
        (!rowHasInlinePrice && effectivePriceWholesale === effectivePriceMsrp) ||
        (headerHasDistinctPair && effectivePriceWholesale === effectivePriceMsrp)
      if (shouldAdoptHeaderWholesale && headerPricePair.priceWholesale != null) {
        effectivePriceWholesale = headerPricePair.priceWholesale
      }
    }
    if (typeof effectivePrice !== 'number' && typeof effectivePriceWholesale === 'number') {
      effectivePrice = effectivePriceWholesale
    }
    price = typeof effectivePrice === 'number' ? effectivePrice : price

    const linkEl = $tr.find('a[href]').first()
    const href = linkEl.attr('href')?.trim()
    const url = href ? toAbs(href, base) : ''

    // specs from .information-attributes (li rows)
    $tr.find('.information-attributes .information-attribute').each((__, li) => {
      const labelText = cleanText($(li).find('.information-attribute__label').text())
      const valueText = cleanText($(li).find('.information-attribute__text').text())
      if (!labelText || !valueText) return
      raw[labelText] = valueText
      const normalized = normalizeLabel(labelText)
      const key = LABEL_MAP[normalized] || normalized.replace(/\s+/g, '_')
      assignSpecValue(specs, key, valueText)
    })
    raw.Code = code
    if (model) raw.Model = model
    if (availability) raw.Availability = availability
    if (priceTxt) raw.Price = priceTxt

    out.push({
      url,
      title: linkEl.text().trim() || model || code,
      price,
      priceMsrp: effectivePriceMsrp,
      priceWholesale: effectivePriceWholesale,
      status: availability || null,
      raw,
      specs,
    })
  })

  return out
}

export function extractBatsonInfoAttributes(html: string) {
  const $ = cheerio.load(html)
  const raw: Record<string, string> = {}
  const specs: Record<string, string | number | null> = {}

  $('.information-attribute').each((_, li) => {
    const labelText = cleanText($(li).find('.information-attribute__label').text())
    const valueText = cleanText($(li).find('.information-attribute__text').text())
    if (!labelText || !valueText) return
    raw[labelText] = valueText
    const normalized = normalizeLabel(labelText)
    const key = LABEL_MAP[normalized] || normalized.replace(/\s+/g, '_')
    assignSpecValue(specs, key, valueText)
  })

  return { raw, specs }
}

export function extractBatsonDetailMeta(html: string) {
  const $ = cheerio.load(html)
  const msrpText = $('small.muted')
    .toArray()
    .map(el => cleanText($(el).text()))
    .find(text => /^msrp\b/i.test(text))
  const msrpValue = msrpText ? toNumber(msrpText) : null

  const priceFragments: PriceTextFragment[] = []
  if (msrpText) priceFragments.push({ text: msrpText, hint: 'msrp' })

  const pickPriceText = () => {
    const selectors = ['.attribute-grid .price', '.box-price .price', '.price-container .price', 'strong.price']
    for (const sel of selectors) {
      const found = $(sel)
        .toArray()
        .map(el => cleanText($(el).text()))
        .find(Boolean)
      if (found) return found
    }
    return null
  }
  const priceText = pickPriceText()
  const priceValue = priceText ? toNumber(priceText) : null
  if (priceText) priceFragments.push({ text: priceText, hint: 'price' })
  $('.price, .muted').each((_, el) => {
    const txt = cleanText($(el).text())
    if (txt) priceFragments.push({ text: txt })
  })

  const { priceMsrp, priceWholesale } = extractPricePairFromRow({
    priceValue,
    priceText,
    msrpValue,
    msrpText,
    fallbackTexts: priceFragments,
  })
  const msrp = priceMsrp

  let availability: string | null = null
  const headerCells = $('.attribute-grid thead th')
  let availabilityIndex = -1
  headerCells.each((idx, el) => {
    const label = cleanText($(el).text())
    if (availabilityIndex === -1 && /availability/i.test(label)) {
      availabilityIndex = idx
    }
  })
  if (availabilityIndex >= 0) {
    const targetCell = $('.attribute-grid tbody tr').first().find('td').eq(availabilityIndex)
    if (targetCell.length) {
      const txt = cleanText(targetCell.text())
      availability = txt || null
    }
  }

  let availabilityNote: string | null = null
  const noteEl = $('.attribute-grid .help-icon[data-content]').first()
  if (noteEl.length) {
    const noteHtml = noteEl.attr('data-content') || ''
    if (noteHtml) {
      const noteText = cleanText(cheerio.load(`<div>${noteHtml}</div>`).text())
      availabilityNote = noteText || null
    }
  }

  return { msrp, priceWholesale, availability, availabilityNote }
}

export type BatsonDetailMeta = ReturnType<typeof extractBatsonDetailMeta>

export function resolveBatsonRowPrices(
  row:
    | {
        price?: number | null
        priceMsrp?: number | null
        priceWholesale?: number | null
      }
    | undefined,
  detailMeta?: BatsonDetailMeta | null,
) {
  const rowPrice = typeof row?.price === 'number' ? (row?.price ?? null) : null
  let priceWholesale = typeof row?.priceWholesale === 'number' ? (row?.priceWholesale as number) : null
  let priceMsrp: number | null
  if (typeof row?.priceMsrp === 'number') {
    priceMsrp = row.priceMsrp as number
  } else {
    priceMsrp = priceWholesale == null ? rowPrice : null
  }

  if (priceWholesale == null && priceMsrp == null && rowPrice == null && detailMeta) {
    if (detailMeta.priceWholesale != null) priceWholesale = detailMeta.priceWholesale
    if (detailMeta.msrp != null) priceMsrp = detailMeta.msrp
  }

  return normalizePricePair(priceMsrp, priceWholesale)
}

type PriceCandidateLabel = 'msrp' | 'wholesale' | 'price'

interface PriceCandidate {
  value: number
  label: PriceCandidateLabel | null
  hint: PriceTextHint
}

const PRICE_CONTEXT_WINDOW = 32
const PRICE_NEAR_WINDOW = 12

const MSRP_REGEX = /(^|\b)(msrp|retail|list|map)(\b|$)/
const WHOLESALE_REGEX = /(^|\b)(wholesale|dealer|cost|net)(\b|$)/
const PRICE_REGEX = /(^|\b)(price|each|sale)(\b|$)/

const classifyLabelFromContext = (text: string, start: number, end: number): PriceCandidateLabel | null => {
  const lowerBefore = text.slice(Math.max(0, start - PRICE_CONTEXT_WINDOW), start).toLowerCase()
  const lowerAfter = text.slice(end, Math.min(text.length, end + PRICE_CONTEXT_WINDOW)).toLowerCase()
  const nearBefore = lowerBefore.slice(-PRICE_NEAR_WINDOW)
  const nearAfter = lowerAfter.slice(0, PRICE_NEAR_WINDOW)

  if (MSRP_REGEX.test(nearBefore)) return 'msrp'
  if (WHOLESALE_REGEX.test(nearBefore)) return 'wholesale'
  if (MSRP_REGEX.test(nearAfter)) return 'msrp'
  if (WHOLESALE_REGEX.test(nearAfter)) return 'wholesale'
  if (PRICE_REGEX.test(lowerBefore) || PRICE_REGEX.test(lowerAfter)) return 'price'
  if (MSRP_REGEX.test(lowerBefore) || MSRP_REGEX.test(lowerAfter)) return 'msrp'
  if (WHOLESALE_REGEX.test(lowerBefore) || WHOLESALE_REGEX.test(lowerAfter)) return 'wholesale'
  return null
}

const priceNumberRegex = /\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/g

export function extractPricePairFromRow(options: {
  priceValue?: number | null
  priceText?: string | null
  msrpValue?: number | null
  msrpText?: string | null
  fallbackTexts?: PriceTextFragment[]
}) {
  let priceMsrp = typeof options.msrpValue === 'number' ? options.msrpValue : null
  let priceWholesale = typeof options.priceValue === 'number' ? options.priceValue : null
  const numericPool = new Set<number>()
  const addToPool = (value?: number | null) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      numericPool.add(Number(Math.round(value * 1000) / 1000))
    }
  }
  addToPool(priceMsrp)
  addToPool(priceWholesale)

  const fragments: PriceTextFragment[] = []
  if (options.priceText) fragments.push({ text: options.priceText, hint: 'price' })
  if (options.msrpText) fragments.push({ text: options.msrpText, hint: 'msrp' })
  if (Array.isArray(options.fallbackTexts)) fragments.push(...options.fallbackTexts)

  const candidates: PriceCandidate[] = []
  const processed = new Set<string>()
  for (const fragment of fragments) {
    const text = fragment?.text ? cleanText(fragment.text) : ''
    if (!text) continue
    const key = `${fragment?.hint || 'unknown'}::${text}`
    if (processed.has(key)) continue
    processed.add(key)
    priceNumberRegex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = priceNumberRegex.exec(text))) {
      const numeric = parseFloat((match[1] || '').replace(/,/g, ''))
      if (!Number.isFinite(numeric)) continue
      const label = classifyLabelFromContext(text, match.index, match.index + match[0].length)
      candidates.push({ value: numeric, label, hint: fragment?.hint || 'unknown' })
      addToPool(numeric)
    }
  }

  const pickCandidate = (predicate: (candidate: PriceCandidate) => boolean) => candidates.find(predicate)

  if (priceMsrp == null) {
    const msrpCandidate = pickCandidate(c => c.label === 'msrp') ?? pickCandidate(c => c.hint === 'msrp') ?? null
    if (msrpCandidate) priceMsrp = msrpCandidate.value
  }

  if (priceWholesale == null) {
    const wholesaleCandidate =
      pickCandidate(c => c.label === 'wholesale') ??
      pickCandidate(c => c.label === 'price' && c.hint !== 'msrp') ??
      pickCandidate(c => c.hint === 'price') ??
      null
    if (wholesaleCandidate) priceWholesale = wholesaleCandidate.value
  }

  const poolValues = Array.from(numericPool.values()).sort((a, b) => a - b)
  if (priceWholesale == null && poolValues.length) {
    priceWholesale = poolValues[0]
  }
  if (priceMsrp == null && poolValues.length >= 2) {
    priceMsrp = poolValues[poolValues.length - 1]
  } else if (priceMsrp == null && typeof priceWholesale === 'number') {
    const hasMsrpHint = candidates.some(candidate => candidate.label === 'msrp' || candidate.hint === 'msrp')
    if (hasMsrpHint) priceMsrp = priceWholesale
  }

  return normalizePricePair(priceMsrp, priceWholesale)
}

export function normalizePricePair(priceMsrp: number | null | undefined, priceWholesale: number | null | undefined) {
  if (typeof priceMsrp === 'number' && typeof priceWholesale === 'number' && priceWholesale > priceMsrp) {
    return { priceMsrp: priceWholesale, priceWholesale: priceMsrp }
  }
  return {
    priceMsrp: priceMsrp ?? null,
    priceWholesale: priceWholesale ?? null,
  }
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
