// <!-- BEGIN RBP GENERATED: batson-extractor-v1 -->
// <!-- BEGIN RBP GENERATED: scrape-template-wiring-v2 -->
import type { Page } from 'playwright'
import * as cheerio from 'cheerio'
import { detectSeriesHeader } from '../lib/headerDetect'
import { extractJsonLd, mapProductFromJsonLd } from './jsonld'
import { buildBatsonTitle } from '../lib/titleBuild/batson'
import { applyTemplate } from '../../../../src/importer/extract/applyTemplate'
import { slugFromPath, hash as hashUrl } from '../../../../src/importer/extract/fallbacks'

type Extracted = {
  externalId: string
  title: string
  partType: string
  description?: string
  images: string[]
  rawSpecs: Record<string, unknown>
  isHeader?: boolean
  headerReason?: string
}

// Extended row type for multi-product series pages (Batson rod blanks target only)
export type ExtractedSeriesRow = Extracted & {
  normSpecs: Record<string, string>
  rowIndex: number
  parseWarnings?: string[]
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
  // Skip obvious utility pages based on URL path only (avoid false positives on titles/body text)
  const currentUrl = page.url()
  try {
    const { pathname } = new URL(currentUrl)
    if (/\b(user-login|ordertrackingguest|account|checkout)\b/i.test(pathname)) {
      return null
    }
  } catch {
    /* ignore URL parse errors */
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
  // currentUrl already computed above
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
  let rawImages: string[] = []
  const jldImages = Array.isArray(jld?.images) ? (jld?.images as string[]) : null
  if (jldImages && jldImages.length) {
    rawImages = jldImages.map(String)
  } else {
    rawImages = (await page
      .locator('img')
      .evaluateAll(ns =>
        ns
          .map(n => {
            const el = n as { getAttribute: (name: string) => string | null }
            const direct = el.getAttribute('src') || ''
            const dataSrc = el.getAttribute('data-src') || el.getAttribute('data-original') || ''
            const dataLarge = el.getAttribute('data-large_image') || ''
            const srcset = el.getAttribute('srcset') || el.getAttribute('data-srcset') || ''
            const entries = [direct, dataSrc, dataLarge]
            if (srcset) {
              entries.push(
                ...srcset
                  .split(',')
                  .map(part => part.trim().split(' ')[0])
                  .filter(Boolean),
              )
            }
            return entries
          })
          .flat()
          .filter(Boolean),
      )
      .catch(() => [])) as string[]
    if (!rawImages.length) {
      rawImages = (await page
        .evaluate(() => {
          const selectors = [
            'meta[property="og:image"]',
            'meta[property="og:image:secure_url"]',
            'meta[name="twitter:image"]',
            'meta[name="twitter:image:src"]',
          ]
          const urls: string[] = []
          for (const sel of selectors) {
            const el = document.querySelector(sel)
            const content = el?.getAttribute('content')
            if (content) urls.push(content)
          }
          return urls
        })
        .catch(() => [])) as string[]
    }
  }
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
        .filter(u => /^https?:\/\//i.test(u)),
    ),
  )

  const partType = guessPartType(`${title} ${description}`)
  const rawSpecs: Record<string, unknown> = {}

  // Guide & Tip Top attribute-grid / information-attributes parsing (Batson Guides & Tip Tops)
  try {
    const $ = cheerio.load(html)
    const grid = $('.attribute-grid tbody')
    if (grid.length) {
      // If attribute-grid present, extract first row's nested information attributes
      const firstRow = grid.find('> tr').first()
      const infoAttrs = firstRow.find('.information-attributes .information-attribute')
      infoAttrs.each((_, li) => {
        const label = ($(li).find('.information-attribute__label').text() || '').trim().toLowerCase()
        const value = ($(li).find('.information-attribute__text').text() || '').trim()
        if (!label) return
        const key = label
          .replace(/[:\s]+/g, '_')
          .replace(/__+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
        if (!rawSpecs[key]) rawSpecs[key] = value
        // Map common guide fields
        if (/ring/.test(label) && !rawSpecs.ring_size) {
          const m = value.match(/\d{1,2}(?:\.\d)?/)
          if (m) rawSpecs.ring_size = parseFloat(m[0])
        }
        if (/tube/.test(label) && !rawSpecs.tube_size) {
          const m = value.match(/\d{1,2}(?:\.\d)?/)
          if (m) rawSpecs.tube_size = parseFloat(m[0])
        }
        if (/frame/.test(label) && !rawSpecs.frame_material) rawSpecs.frame_material = value.toLowerCase()
        if (/finish|color/.test(label) && !rawSpecs.finish) rawSpecs.finish = value.toLowerCase()
      })
    } else {
      // Fallback: scan generic information-attributes elsewhere on page
      $('.information-attributes .information-attribute').each((_, li) => {
        const label = ($(li).find('.information-attribute__label').text() || '').trim().toLowerCase()
        const value = ($(li).find('.information-attribute__text').text() || '').trim()
        if (!label) return
        const key = label
          .replace(/[:\s]+/g, '_')
          .replace(/__+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
        if (!rawSpecs[key]) rawSpecs[key] = value
        if (/ring/.test(label) && !rawSpecs.ring_size) {
          const m = value.match(/\d{1,2}(?:\.\d)?/)
          if (m) rawSpecs.ring_size = parseFloat(m[0])
        }
        if (/tube/.test(label) && !rawSpecs.tube_size) {
          const m = value.match(/\d{1,2}(?:\.\d)?/)
          if (m) rawSpecs.tube_size = parseFloat(m[0])
        }
        if (/frame/.test(label) && !rawSpecs.frame_material) rawSpecs.frame_material = value.toLowerCase()
        if (/finish|color/.test(label) && !rawSpecs.finish) rawSpecs.finish = value.toLowerCase()
      })
    }
    // Additional kit detection if not set: look for multiple numeric sizes and 'kit'
    if (!rawSpecs.is_kit && /\bkit\b/i.test(title + ' ' + description)) {
      const sizeHits = (title.match(/\b\d{1,2}(?:\.\d)?\b/g) || []).length
      if (sizeHits >= 4) rawSpecs.is_kit = true
    }
  } catch {
    /* ignore attribute parse errors */
  }

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

  const rawSpecsMerged: Record<string, unknown> = { ...(jld?.rawSpecs || {}), ...rawSpecs }
  // Preserve original title for audit
  if (title) rawSpecsMerged.original_title = title
  const constructedTitle = buildBatsonTitle({ title, rawSpecs: rawSpecsMerged })

  // Early header detection (series aggregate page) BEFORE staging
  const header = detectSeriesHeader({
    url: currentUrl,
    externalId,
    title: constructedTitle,
    rawSpecs: rawSpecsMerged,
  })

  return {
    externalId,
    title: constructedTitle,
    partType,
    description: description || '',
    images: dedupe(images),
    rawSpecs: rawSpecsMerged,
    usedTemplateKey,
    isHeader: header.isHeader || undefined,
    headerReason: header.reason || undefined,
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

// ------------------------------------------------------------------------------------------
// Batson Rod Blanks – Multi-row series grid extraction (string-only specs)
// NOTE: This does not alter the existing single-product extractor; callers can opt-in.
// ------------------------------------------------------------------------------------------

// Canonical label mapping (lowercased normalized label -> canonical key)
const BATSON_LABEL_MAP: Record<string, string> = {
  series: 'series',
  'item length (in)': 'length_in',
  'number of pieces': 'pieces',
  'rod blank color': 'color',
  action: 'action',
  power: 'power',
  material: 'material',
  'line rating (lbs.)': 'line_lb',
  'lure weight rating (oz.)': 'lure_oz',
  'weight (oz.)': 'weight_oz',
  'butt diameter': 'butt_dia_in',
  '10" diameter': 'ten_in_dia',
  '20" diameter': 'twenty_in_dia',
  '30" diameter': 'thirty_in_dia',
  'tip top size': 'tip_top_size',
  'rod blank application': 'applications',
}

// Utility: collapse whitespace and trim
function cleanText(v: string | null | undefined): string {
  return (v || '').replace(/\s+/g, ' ').trim()
}

// Heuristic SKU/externalId pattern for Batson rod blanks (e.g., SU1264F-M)
const SKU_PATTERN = /\b[A-Z]{2,}\d{2,}[A-Z0-9-]*\b/

// Extract a series spec table into multiple product rows.
// Returns empty array if no suitable multi-row structure detected.
export async function extractBatsonSeriesRows(page: Page): Promise<ExtractedSeriesRow[]> {
  await page.waitForLoadState('domcontentloaded')
  const url = page.url()
  const htmlLower = (await page.content()).toLowerCase()

  // Quick guard: only attempt if indicative labels are present.
  const indicative = ['item length', 'line rating', 'lure weight']
  if (!indicative.every(t => htmlLower.includes(t))) return []

  // Evaluate in page context to gather table/header/cell data.
  const tables: Array<{ headers: string[]; rows: string[][] }> = await page.evaluate(() => {
    function collectTables(): Array<{ headers: string[]; rows: string[][] }> {
      const out: Array<{ headers: string[]; rows: string[][] }> = []
      const domTables = Array.from(document.querySelectorAll('table'))
      for (const tbl of domTables) {
        const headers = Array.from(tbl.querySelectorAll('thead th, tr th')).map(th => (th.textContent || '').trim())
        const bodyRows = Array.from(tbl.querySelectorAll('tbody tr')).map(tr =>
          Array.from(tr.querySelectorAll('td')).map(td => (td.textContent || '').trim()),
        )
        if (headers.length && bodyRows.length) out.push({ headers, rows: bodyRows })
      }
      return out
    }
    return collectTables()
  })

  // Attempt list-based structure fallback (ul/li with label spans) when tables missing.
  const listRows: Array<{ raw: Record<string, string> }> = await page.evaluate(() => {
    const out: Array<{ raw: Record<string, string> }> = []
    // Each product card might have a group of .information-attribute entries
    const cards = Array.from(document.querySelectorAll('[class*="product"], .information-attributes, .specs'))
    for (const card of cards) {
      const pairs = Array.from(card.querySelectorAll('.information-attribute')).map(li => {
        const labelEl = li.querySelector('.information-attribute__label') as HTMLElement | null
        const valEl = li.querySelector('.information-attribute__text') as HTMLElement | null
        const label = (labelEl?.textContent || '').trim()
        const value = (valEl?.textContent || '').trim()
        return { label, value }
      })
      if (pairs.filter(p => p.label).length) {
        const raw: Record<string, string> = {}
        for (const p of pairs) if (p.label) raw[p.label] = p.value
        out.push({ raw })
      }
    }
    return out
  })

  const rows: ExtractedSeriesRow[] = []
  let rowIndex = 0

  // Table-driven rows
  for (const tbl of tables) {
    // Normalize header labels once
    const normalizedHeaders = tbl.headers.map(h => h.replace(/\s+/g, ' ').trim().toLowerCase())
    for (const r of tbl.rows) {
      // Skip obvious header-like rows (no cells or fewer cells than headers)
      if (!r.length || r.every(c => !c.trim())) continue
      const joined = r.join(' ')
      if (!SKU_PATTERN.test(joined)) continue // require a SKU somewhere in the row
      const rawSpecs: Record<string, string> = {}
      const normSpecs: Record<string, string> = {}
      const warnings: string[] = []
      let externalId: string | undefined
      r.forEach((cell, i) => {
        const headerLabel = normalizedHeaders[i] || ''
        const valueClean = cleanText(cell)
        if (SKU_PATTERN.test(valueClean) && !externalId) externalId = valueClean.match(SKU_PATTERN)?.[0]
        if (headerLabel) {
          rawSpecs[headerLabel] = valueClean
          const mapped = BATSON_LABEL_MAP[headerLabel]
          if (mapped) normSpecs[mapped] = valueClean
        }
      })
      if (!externalId) {
        warnings.push('row-no-sku')
        continue
      }
      const title = buildBatsonTitle({ title: externalId, rawSpecs })
      rows.push({
        externalId: externalId.toUpperCase(),
        title,
        partType: 'blank',
        description: '',
        images: [],
        rawSpecs,
        normSpecs,
        rowIndex: rowIndex++,
        parseWarnings: warnings.length ? warnings : undefined,
      })
    }
  }

  // Fallback list-based rows (only if no table rows found)
  if (!rows.length) {
    for (const { raw } of listRows) {
      const lowerRaw: Record<string, string> = {}
      Object.entries(raw).forEach(([k, v]) => (lowerRaw[k.toLowerCase()] = cleanText(v)))
      const joined = Object.values(lowerRaw).join(' ')
      const externalId = joined.match(SKU_PATTERN)?.[0]
      if (!externalId) continue
      const rawSpecs: Record<string, string> = lowerRaw
      const normSpecs: Record<string, string> = {}
      Object.entries(lowerRaw).forEach(([lk, lv]) => {
        const mapped = BATSON_LABEL_MAP[lk]
        if (mapped) normSpecs[mapped] = lv
      })
      const title = buildBatsonTitle({ title: externalId, rawSpecs })
      rows.push({
        externalId: externalId.toUpperCase(),
        title,
        partType: 'blank',
        description: '',
        images: [],
        rawSpecs,
        normSpecs,
        rowIndex: rowIndex++,
      })
    }
  }

  // Deduplicate by externalId (first wins)
  const seen = new Set<string>()
  const deduped = rows.filter(r => {
    if (seen.has(r.externalId)) return false
    seen.add(r.externalId)
    return true
  })

  // Attach page-level images to each row (lightweight – reuse existing image discovery)
  if (deduped.length) {
    try {
      const rawImages = await page
        .locator('img')
        .evaluateAll(ns => ns.map(n => n.getAttribute('src') || '').filter(Boolean))
      const absSet = Array.from(
        new Set(
          rawImages.map(src => {
            try {
              return new URL(src, url).toString()
            } catch {
              return src
            }
          }),
        ),
      )
      for (const row of deduped) row.images = absSet
    } catch {
      /* ignore image failures */
    }
  }

  return deduped
}
