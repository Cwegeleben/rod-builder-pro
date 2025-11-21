import { prisma } from '../../app/db.server'
import type { Prisma } from '@prisma/client'

async function main() {
  const supplierSlug = process.env.SUPPLIER_ID || 'batson-reel-seats'
  const limit = Math.max(1, Math.min(500, Number(process.env.LIMIT || '50')))
  const detailOnly = String(process.env.DETAIL_ONLY || '1') === '1'
  const sourceFilter = (process.env.SOURCE || 'discovered').toLowerCase() // all|forced|discovered
  const urlsEnv = (process.env.URLS || '')
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(Boolean)
  const restrictToGuides = /guides?-tip-?tops?/i.test(supplierSlug)
  const normalizeCode = (val: string | null | undefined) =>
    String(val || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]+/g, '')

  // Resolve supplier.id from slug; default to slug-as-id when absent
  let supplierId = supplierSlug
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT id FROM Supplier WHERE slug = ? LIMIT 1',
      supplierSlug,
    )
    if (rows && rows.length) supplierId = rows[0].id
  } catch {
    /* ignore */
  }

  // 1) If URLs are provided via env, prefer those (bypass ProductSource)
  let urls: string[] = []
  if (urlsEnv.length) {
    urls = urlsEnv
  } else {
    // 2) Fetch candidate URLs from ProductSource; support both resolved supplierId and legacy slug-as-id
    const supplierIds = Array.from(new Set([supplierId, supplierSlug])).filter(Boolean)
    const where: string[] = []
    const params: unknown[] = []
    if (supplierIds.length === 1) {
      where.push('supplierId = ?')
      params.push(supplierIds[0])
    } else if (supplierIds.length > 1) {
      where.push(`supplierId IN (${supplierIds.map(() => '?').join(',')})`)
      params.push(...supplierIds)
    }
    if (sourceFilter === 'forced') {
      where.push("IFNULL(source,'') = 'forced'")
    } else if (sourceFilter === 'discovered') {
      where.push("IFNULL(source,'') = 'discovered'")
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    let rows: Array<{ url: string }> = []
    try {
      const sql = `SELECT url FROM ProductSource ${whereSql} ORDER BY lastSeenAt DESC LIMIT ?`
      rows = await prisma.$queryRawUnsafe<Array<{ url: string }>>(sql, ...params, limit)
    } catch {
      rows = []
    }
    if (!rows || rows.length === 0) {
      console.log('[ingestSeeds] no ProductSource rows found, falling back to domain heuristic')
      try {
        // Broaden heuristic: include root-level Batson detail pages (exclude obvious lists)
        const sql2 = `SELECT url FROM ProductSource WHERE url LIKE '%batsonenterprises.com%' AND url NOT LIKE '%/collections/%' AND url NOT LIKE '%/reel-seats$' ORDER BY lastSeenAt DESC LIMIT ?`
        rows = await prisma.$queryRawUnsafe<Array<{ url: string }>>(sql2, limit)
      } catch {
        rows = []
      }
    }
    urls = rows.map(r => String(r.url || '').trim()).filter(Boolean)
  }
  const unique = Array.from(new Set(urls))

  const isBatsonGuidesDetailUrl = (href: string): boolean => {
    try {
      const u = new URL(href)
      const path = u.pathname.replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase()
      if (!u.hostname.endsWith('batsonenterprises.com')) return false
      if (!path.startsWith('/guides-tip-tops')) return false
      if (path === '/guides-tip-tops') return false
      if (u.searchParams.has('page')) return false
      return true
    } catch {
      return false
    }
  }

  const isDetailUrl = (href: string): boolean => {
    if (restrictToGuides) return isBatsonGuidesDetailUrl(href)
    try {
      const u = new URL(href)
      const p = u.pathname.toLowerCase()
      if (/\/(products|product|ecom)\//.test(p)) return true
      if (/\/rod-blanks\//.test(p) && p !== '/rod-blanks') return true
      if (/\/reel-seats\//.test(p) && p !== '/reel-seats') return true
      // Treat guides-tip-tops nested paths (excluding root and listing pages) as detail pages
      if (/\/guides-tip-tops\//.test(p) && p !== '/guides-tip-tops' && !/\/products$/.test(p)) return true
      if (
        supplierSlug === 'batson-reel-seats' &&
        u.hostname.toLowerCase().endsWith('batsonenterprises.com') &&
        /^\/[a-z0-9-]+(?:-[a-z0-9-]+)+$/.test(p)
      ) {
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const scopeFiltered: string[] = []
  const baseList = detailOnly ? unique.filter(isDetailUrl) : unique.slice()
  const picked = baseList.filter(url => {
    if (!restrictToGuides) return true
    const ok = isBatsonGuidesDetailUrl(url)
    if (!ok) scopeFiltered.push(url)
    return ok
  })
  if (restrictToGuides && scopeFiltered.length) {
    console.log(`[ingestSeeds] scope filtered ${scopeFiltered.length} URL(s) outside guides-tip-tops detail paths`)
  }
  if (!picked.length) {
    console.log(JSON.stringify({ ok: true, supplierId, attempted: 0, staged: 0, errors: 0, items: [] }, null, 2))
    return
  }

  const { upsertNormalizedProduct } = await import('../../app/services/productDbWriter.server')
  const { linkExternalIdForSource } = await import('../../packages/importer/src/seeds/sources')
  const { extractJsonLd, mapProductFromJsonLd } = await import('../../packages/importer/src/extractors/jsonld')
  const { slugFromPath, hash: hashUrl } = await import('../../src/importer/extract/fallbacks')
  // title builder imported inline where used to avoid ESM circularities in some environments

  const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'

  let staged = 0
  let errors = 0
  const items: Array<{ url: string; sku?: string; ok: boolean; reason?: string }> = []
  const allowedGuideClasses = new Set(['guide', 'tip-top', 'guide-kit'])

  for (const url of picked) {
    let targetVariant = ''
    try {
      const parsedSeed = new URL(url)
      targetVariant = normalizeCode(parsedSeed.searchParams.get('variant'))
    } catch {
      targetVariant = ''
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    let html = ''
    let fetchErr: string | undefined
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        signal: ctrl.signal,
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      html = await r.text()
    } catch (e) {
      fetchErr = (e as Error)?.message || 'error'
    } finally {
      clearTimeout(timer)
    }

    // Headless fallback when blocked or non-OK
    if (!html) {
      try {
        const { chromium } = await import('playwright')
        const browser = await chromium.launch()
        const context = await browser.newContext({ userAgent })
        const page = await context.newPage()
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
        html = await page.content()
        await context.close()
        await browser.close()
      } catch (e) {
        errors++
        items.push({
          url,
          ok: false,
          reason: `fetch-failed: ${fetchErr || 'error'}; headless-fallback: ${(e as Error)?.message || 'error'}`,
        })
        // brief backoff between attempts
        await new Promise(res => setTimeout(res, 500))
        continue
      }
    }

    // If this is a Batson series page (attribute-grid), expand into per-model rows
    try {
      const isReelSeat = /\/reel-seats\//i.test(url)
      const hasGrid = /class=["'][^"']*attribute-grid[^"']*["']/i.test(html)
      const isGuidesOrTips = /\/(guides|tip-top|tip-tops)\//i.test(url)

      // Guides & Tip Tops series page expansion
      if (isGuidesOrTips && hasGrid) {
        const { extractBatsonAttributeGrid } = await import(
          '../../app/server/importer/preview/parsers/batsonAttributeGrid'
        )
        type BatsonRow = {
          url: string
          title?: string
          price?: number | null
          status?: string | null
          raw: Record<string, string>
          specs: Record<string, string | number | null>
        }
        const base = (() => {
          try {
            const u = new URL(url)
            return `${u.protocol}//${u.hostname}`
          } catch {
            return 'https://batsonenterprises.com'
          }
        })()
        const rows = extractBatsonAttributeGrid(html, base) as BatsonRow[]
        if (Array.isArray(rows) && rows.length) {
          let scopedRows = rows
          if (targetVariant) {
            const filtered = rows.filter(r => normalizeCode(r?.raw?.Code) === targetVariant)
            if (filtered.length) scopedRows = filtered
          }
          for (const r of scopedRows) {
            try {
              let externalId = String(r.raw?.Code || '').trim()
              if (!externalId) externalId = slugFromPath(r.url || url) || ''
              if (!externalId) externalId = hashUrl(r.url || url)
              externalId = externalId.toUpperCase().replace(/[^A-Z0-9-]+/g, '')
              if (!externalId) continue

              const tLower = String(r.title || '').toLowerCase()
              const slug = (r.url || url || '').toLowerCase()
              const isTipTop = /tip\s*-?tops?/.test(slug) || /(^|\W)tip\s*-?top(s)?(\W|$)/.test(tLower)
              const isKit = /\bkit\b|\bset\b|\bassort/i.test(String(r.title || ''))

              const parseNum = (val?: unknown) => {
                const s = String(val ?? '').trim()
                const m = s.match(/\d{1,2}(?:\.\d)?/)
                return m ? parseFloat(m[0]) : undefined
              }
              const rawRing = r.specs['ring_size'] ?? r.specs['ring size'] ?? r.specs['ring']
              const rawTube = r.specs['tube_size'] ?? r.specs['tube size'] ?? r.specs['tube']
              const rawFrame = r.specs['frame_material'] ?? r.specs['frame material'] ?? r.specs['frame']
              const rawFinish = r.specs['finish'] ?? r.specs['color']
              const ringSize = parseNum(rawRing)
              const tubeSize = parseNum(rawTube)
              const frameMaterial = String(rawFrame ?? '').toString() || undefined
              const finish = String(rawFinish ?? '').toString() || undefined

              const title = (await import('../../app/server/importer/products/titleNormalize')).buildBatsonTitle({
                code: externalId,
                series: String(r.raw?.Model || r.title || '').trim() || undefined,
                size_label: isTipTop
                  ? tubeSize
                    ? String(tubeSize)
                    : undefined
                  : ringSize
                    ? String(ringSize)
                    : undefined,
                color: (finish || '').toString().trim() || undefined,
                partType: isTipTop ? 'Tip Top' : isKit ? 'Guide Kit' : 'Guide',
              })

              const type = isTipTop ? 'Tip Top' : isKit ? 'Guide Kit' : 'Guide'
              const classification = isTipTop ? 'tip-top' : isKit ? 'guide-kit' : 'guide'
              if (restrictToGuides && !allowedGuideClasses.has(classification)) {
                items.push({ url: srcUrl, ok: false, reason: 'skip-non-guide-row' })
                continue
              }

              const srcUrl =
                r.url && /^https?:/i.test(r.url) && !/^https?:\/\/[^/]+\/javascript:/i.test(r.url) ? r.url : url

              await upsertNormalizedProduct({
                supplier: { id: supplierId },
                sku: externalId,
                title,
                type,
                description: String(r.title || ''),
                images: null,
                rawSpecs: r.raw as unknown as Prisma.InputJsonValue,
                normSpecs: {
                  ...(r.specs as Record<string, string | number | null>),
                  ring_size: ringSize ?? undefined,
                  tube_size: tubeSize ?? undefined,
                  frame_material: frameMaterial ? String(frameMaterial).toLowerCase() : undefined,
                  finish: finish ? String(finish).toLowerCase() : undefined,
                  classification,
                } as unknown as Prisma.InputJsonValue,
                priceMsrp: r.price ?? null,
                priceWholesale: null,
                availability: (r.status as string) || null,
                sources: [{ url: srcUrl, externalId, source: 'discovered' }],
                fetchedAt: new Date(),
              })
              await linkExternalIdForSource(supplierId, srcUrl, externalId, undefined)
              items.push({ url: srcUrl, sku: externalId, ok: true })
              staged++
              await new Promise(res => setTimeout(res, 100))
            } catch (e) {
              errors++
              items.push({ url, ok: false, reason: (e as Error)?.message || 'series-row-failed' })
            }
          }
          // Polite delay after series page before continuing to next seed
          await new Promise(res => setTimeout(res, 300))
          continue
        }
      }

      if (isReelSeat && hasGrid) {
        const { extractBatsonAttributeGrid } = await import(
          '../../app/server/importer/preview/parsers/batsonAttributeGrid'
        )
        type BatsonRow = {
          url: string
          title?: string
          price?: number | null
          status?: string | null
          raw: Record<string, string>
          specs: Record<string, string | number | null>
        }
        const base = (() => {
          try {
            const u = new URL(url)
            return `${u.protocol}//${u.hostname}`
          } catch {
            return 'https://batsonenterprises.com'
          }
        })()
        const rows = extractBatsonAttributeGrid(html, base) as BatsonRow[]
        if (Array.isArray(rows) && rows.length) {
          for (const r of rows) {
            try {
              let externalId = String(r.raw?.Code || '').trim()
              if (!externalId) externalId = slugFromPath(r.url || url) || ''
              if (!externalId) externalId = hashUrl(r.url || url)
              externalId = externalId.toUpperCase().replace(/[^A-Z0-9-]+/g, '')
              if (!externalId) continue

              let seriesGuess: string | undefined = (String(r.specs?.series ?? '').trim() || undefined) as
                | string
                | undefined
              if (!seriesGuess) {
                const h1 = html.match(/<h1[^>]*>([\s\S]{1,200}?)<\/h1>/i)
                seriesGuess = (h1 && h1[1] ? h1[1].replace(/<[^>]+>/g, '').trim() : '') || undefined
              }
              const sizeGuess = externalId.match(/^[A-Z]+(\d{1,2})/)?.[1]
              const colorGuess = (() => {
                const c = String((r as BatsonRow).specs?.color || '').trim()
                if (c) return c
                const t = String(r.title || '')
                if (/\bblack\b/i.test(t)) return 'Black'
                if (/gunsmoke/i.test(t)) return 'Shiny Gunsmoke'
                if (/silver/i.test(t)) return 'Silver'
                if (/gold/i.test(t)) return 'Gold'
                return undefined
              })()

              // Heuristics from slug/series for brand, style, material, hardware, etc.
              const slug = (r.url || url || '').toLowerCase()
              const brandRaw = /\/alps[-/]/.test(slug) ? 'Alps' : /\/forecast[-/]/.test(slug) ? 'Forecast' : undefined
              const seatStyle =
                /dual\s*trigger/i.test(String(seriesGuess)) || /dual-trigger/.test(slug)
                  ? 'Dual Trigger'
                  : /\btrigger\b/.test(slug)
                    ? 'Trigger'
                    : /skeleton|skel/i.test(slug)
                      ? 'Skeleton'
                      : /contour/i.test(slug)
                        ? 'Contour'
                        : undefined
              const material = /alum|aluminum/i.test(String(seriesGuess) + ' ' + slug)
                ? 'Aluminum'
                : /graphite|nylon/i.test(String(seriesGuess) + ' ' + slug)
                  ? 'Graphite'
                  : undefined
              const hardwareKind = /\bshim\b/.test(slug)
                ? ('Reel Seat Shim' as const)
                : /locking[- ]?nut|lock-?nut/.test(slug)
                  ? ('Reel Seat Locking Nut' as const)
                  : /\bhood\b/.test(slug)
                    ? ('Reel Seat Hood' as const)
                    : /trim|bottom-?hood/.test(slug)
                      ? ('Reel Seat Trim Ring and Bottom Hood' as const)
                      : /extension/.test(slug)
                        ? ('Reel Seat Extension Ring' as const)
                        : undefined
              const isInsertOnly = /insert/.test(slug) && !/reel-?seat/.test(slug)

              const { buildBatsonReelSeatTitle, inferReelSeatFamily, parseBrandShort } = await import(
                '../../app/server/importer/products/batsonTitle'
              )
              const { parseBatsonReelSeatCategoryContext } = await import(
                '../../app/server/importer/products/batsonTitle'
              )
              const catCtx = (() => {
                // Prefer explicit trolling-butt category when present
                if (/trolling-butt/.test(slug))
                  return { brandFallback: brandRaw, categoryType: 'Trolling Butt' as const }
                const base = parseBatsonReelSeatCategoryContext(html)
                return { ...base, brandFallback: base.brandFallback || brandRaw }
              })()
              // Resolve brand value like builder would
              const brand = (() => {
                const series = seriesGuess || r.title || ''
                if (/\bforecast\b/i.test(series)) return 'Forecast'
                if (
                  /\balps\b/i.test(series) ||
                  /^[A-Z]*AIP/.test(externalId) ||
                  /^DALT/.test(externalId) ||
                  /\balps\b/i.test(slug)
                )
                  return 'Alps'
                return parseBrandShort(brandRaw) || catCtx.brandFallback || 'Batson'
              })()
              // Family for interfaceKey
              const famRes = inferReelSeatFamily({
                brand,
                code: externalId,
                slug: r.url || url,
                series: seriesGuess,
                pageTitle: r.title || '',
              })
              const family = famRes.family || undefined
              const title = buildBatsonReelSeatTitle(catCtx, {
                rawName: r.title || seriesGuess || '',
                brandRaw,
                codeRaw: externalId,
                familyName: undefined,
                seatStyle,
                size: sizeGuess,
                material,
                finishColor: colorGuess,
                insertMaterial: undefined,
                isInsertOnly,
                specsRaw: undefined,
                slug: r.url || url,
                series: seriesGuess,
                hardwareKind,
              })

              // Classification and compatibility
              const isHood = hardwareKind === 'Reel Seat Hood' || /(^|[^a-z])(hood|cap)([^a-z]|$)/i.test(slug)
              const isKit = /\bkit\b|\bassembly\b/i.test(slug)
              const withHood =
                /(with|w[/_\s]?)[-\s]?hood/i.test(String(r.title || '') + ' ' + seriesGuess) ||
                /with-hood|w-hood|w\/hood/.test(slug)
              let classification:
                | 'reel-seat-complete'
                | 'reel-seat-body'
                | 'reel-seat-hood'
                | 'reel-seat-kit'
                | 'reel-seat-hardware'
              if (isHood) classification = 'reel-seat-hood'
              else if (hardwareKind && !isHood) classification = 'reel-seat-hardware'
              else if (isInsertOnly) classification = 'reel-seat-hardware'
              else if (isKit || withHood) classification = 'reel-seat-complete'
              else classification = 'reel-seat-body'
              const requiresCompanion = classification === 'reel-seat-body'
              const requiredCompanionKind = requiresCompanion ? 'reel-seat-hood' : undefined
              const sizeForKey = (sizeGuess || '').replace(/[^0-9]/g, '') || undefined
              const familyForKey = (family || '').trim() || undefined
              const interfaceKey =
                brand && familyForKey && sizeForKey ? `${brand}|${familyForKey}|${sizeForKey}`.toLowerCase() : undefined

              const srcUrl =
                r.url && /^https?:/i.test(r.url) && !/^https?:\/\/[^/]+\/javascript:/i.test(r.url) ? r.url : url

              await upsertNormalizedProduct({
                supplier: { id: supplierId },
                sku: externalId,
                title,
                type: 'Reel Seat',
                description: String(r.title || ''),
                images: null,
                rawSpecs: r.raw as unknown as Prisma.InputJsonValue,
                normSpecs: {
                  ...(r.specs as Record<string, string | number | null>),
                  brand,
                  familyName: familyForKey || family || undefined,
                  seatStyle,
                  material,
                  color: colorGuess,
                  size_label: sizeGuess,
                  hardwareKind,
                  classification,
                  requiresCompanion,
                  requiredCompanionKind,
                  interfaceKey,
                } as unknown as Prisma.InputJsonValue,
                priceMsrp: r.price ?? null,
                priceWholesale: null,
                availability: null,
                sources: [{ url: srcUrl, externalId, source: 'discovered' }],
                fetchedAt: new Date(),
              })
              await linkExternalIdForSource(supplierId, srcUrl, externalId, undefined)
              items.push({ url: srcUrl, sku: externalId, ok: true })
              staged++
              await new Promise(res => setTimeout(res, 100))
            } catch (e) {
              errors++
              items.push({ url, ok: false, reason: (e as Error)?.message || 'series-row-failed' })
            }
          }
          // Polite delay after series page before continuing to next seed
          await new Promise(res => setTimeout(res, 300))
          continue
        }
      }
    } catch {
      // fall through to single-product path
    }

    try {
      const jldAll = extractJsonLd(html)
      const jld = mapProductFromJsonLd(jldAll) as Record<string, unknown> | null
      let externalId = (jld?.externalId as string | undefined)?.toString()?.trim() || ''
      if (!externalId) externalId = slugFromPath(url) || ''
      if (!externalId) externalId = hashUrl(url)
      externalId = externalId.toUpperCase().replace(/[^A-Z0-9-]+/g, '')
      if (!externalId) throw new Error('no-external-id')
      // Skip generic listing pages which resolve to PRODUCTS (no discrete item)
      if (externalId === 'PRODUCTS') {
        items.push({ url, ok: false, reason: 'skip-listing-page' })
        continue
      }
      const rawSpecs = (jld?.rawSpecs as Record<string, unknown>) || {}
      const rawTitle = ((jld?.title as string) || '').trim()

      let seriesGuess = ((): string | undefined => {
        const fromSpec = String((rawSpecs as Record<string, unknown>)['series'] || '').trim()
        if (fromSpec) return fromSpec
        const orig = String((rawSpecs as Record<string, unknown>)['original_title'] || rawTitle || '')
        const s = orig
          .replace(/\b(Gloss\s+Black|Matte\s+Black|Black)\b\s*$/i, '')
          .replace(/[-–—]\s*$/g, '')
          .trim()
        return s || undefined
      })()

      if (!seriesGuess) {
        try {
          const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
          const metaOg = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
          const head = (m?.[1] || metaOg?.[1] || '').replace(/<[^>]+>/g, '').trim()
          if (head) {
            const cleaned = head
              .replace(/\b(Gloss\s+Black|Matte\s+Black|Black)\b\s*$/i, '')
              .replace(/[-–—]\s*$/g, '')
              .replace(/\s{2,}/g, ' ')
              .trim()
            if (cleaned) seriesGuess = cleaned
          }
        } catch {
          /* ignore */
        }
      }

      const modelGuess = ((): string | undefined => {
        const m = externalId.match(/^[A-Z]+/)
        return m ? m[0] : undefined
      })()
      const sizeGuess = ((): string | undefined => {
        const m = externalId.match(/^[A-Z]+(\d{1,2})/)
        return m ? m[1] : undefined
      })()
      const colorGuess = ((): string | undefined => {
        const c = String((rawSpecs as Record<string, unknown>)['color'] || '').trim()
        if (c) return c
        if (/\bblack\b/i.test(rawTitle)) return 'Black'
        const ot = String((rawSpecs as Record<string, unknown>)['original_title'] || '')
        if (/\bblack\b/i.test(ot)) return 'Black'
        return undefined
      })()

      // Determine part type (reel seat already handled elsewhere) and classification for guides / tip tops
      const isReelSeatSingle = /reel-seats/i.test(url)
      const isGuidePage = /\/guides\//i.test(url) || /\bguide\b/i.test(rawTitle)
      const isTipTopPage = /tip-top|tip-tops/i.test(url) || /tip\s*-?top(s)?/i.test(rawTitle)
      const partTypeDerived = isReelSeatSingle
        ? 'Reel Seat'
        : isTipTopPage
          ? 'Tip Top'
          : isGuidePage
            ? 'Guide'
            : undefined

      // Extract potential ring / tube sizes, frame material and finish from rawSpecs or title
      const pickNum = (txt: string): number | undefined => {
        const m = txt.match(/\b\d{1,2}(?:\.\d)?\b/)
        return m ? parseFloat(m[0]) : undefined
      }
      const ringSize = (() => {
        for (const k of ['ring_size', 'ring size', 'ring']) {
          const v = (rawSpecs as Record<string, unknown>)[k]
          if (typeof v === 'number') return v
          if (typeof v === 'string') {
            const n = pickNum(v)
            if (n !== undefined) return n
          }
        }
        if (isGuidePage) return pickNum(rawTitle)
        return undefined
      })()
      const tubeSize = (() => {
        for (const k of ['tube_size', 'tube size', 'tube']) {
          const v = (rawSpecs as Record<string, unknown>)[k]
          if (typeof v === 'number') return v
          if (typeof v === 'string') {
            const n = pickNum(v)
            if (n !== undefined) return n
          }
        }
        if (isTipTopPage) return pickNum(rawTitle)
        return undefined
      })()
      const frameMaterialRaw = (() => {
        for (const k of ['frame_material', 'frame material', 'frame']) {
          const v = (rawSpecs as Record<string, unknown>)[k]
          if (typeof v === 'string' && v.trim()) return v.trim()
        }
        return ''
      })()
      const finishRaw = (() => {
        for (const k of ['finish', 'color']) {
          const v = (rawSpecs as Record<string, unknown>)[k]
          if (typeof v === 'string' && v.trim()) return v.trim()
        }
        return ''
      })()
      const normalizeToken = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
      const frameMaterial = frameMaterialRaw ? normalizeToken(frameMaterialRaw) : undefined
      const finish = finishRaw ? normalizeToken(finishRaw) : undefined
      const classification =
        partTypeDerived === 'Tip Top' ? 'tip-top' : partTypeDerived === 'Guide' ? 'guide' : undefined
      if (restrictToGuides) {
        if (!classification || !allowedGuideClasses.has(classification)) {
          items.push({ url, ok: false, reason: 'skip-non-guide-detail' })
          continue
        }
      }

      const title = (await import('../../app/server/importer/products/titleNormalize')).buildBatsonTitle({
        code: externalId,
        model: modelGuess,
        series: seriesGuess,
        size_label:
          partTypeDerived === 'Tip Top'
            ? tubeSize
              ? String(tubeSize)
              : undefined
            : ringSize
              ? String(ringSize)
              : sizeGuess,
        color: colorGuess || finishRaw || undefined,
        partType: partTypeDerived,
      })

      const normSpecsMerged = partTypeDerived
        ? {
            ring_size: ringSize ?? undefined,
            tube_size: tubeSize ?? undefined,
            frame_material: frameMaterial,
            finish: finish,
            classification,
          }
        : null

      await upsertNormalizedProduct({
        supplier: { id: supplierId },
        sku: externalId,
        title,
        type: partTypeDerived,
        description: (jld?.description as string) || '',
        images: jld?.images as unknown as Prisma.InputJsonValue,
        rawSpecs: rawSpecs as unknown as Prisma.InputJsonValue,
        normSpecs: normSpecsMerged as unknown as Prisma.InputJsonValue,
        priceMsrp: (jld?.priceMsrp as number) || null,
        priceWholesale: null,
        availability: null,
        sources: [{ url, externalId, source: 'discovered' }],
        fetchedAt: new Date(),
      })
      await linkExternalIdForSource(supplierId, url, externalId, undefined)
      items.push({ url, sku: externalId, ok: true })
      staged++
    } catch (e) {
      items.push({ url, ok: false, reason: (e as Error)?.message || 'failed' })
      errors++
    }
    // polite delay between items
    await new Promise(res => setTimeout(res, 300))
  }

  console.log(
    JSON.stringify(
      { ok: true, supplierId, attempted: picked.length, staged, errors, items: items.slice(0, 25) },
      null,
      2,
    ),
  )
}

main()
  .catch(err => {
    console.error('[ingestSeeds] fatal', err)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await prisma.$disconnect()
    } catch (e) {
      console.warn('[ingestSeeds] disconnect error (non-fatal)', e)
    }
  })
