// <!-- BEGIN RBP GENERATED: batson-crawler-ecom-v1 -->
// <!-- BEGIN RBP GENERATED: scrape-template-wiring-v2 -->
import { PlaywrightCrawler, log } from 'crawlee'
import { extractProduct, extractBatsonSeriesRows } from '../extractors/batson.parse'

// Pure helper to decide if a product record should be staged (used for testing)
export function shouldStageBatsonProduct(
  rec: { externalId: string; isHeader?: boolean },
  url: string,
): { stage: boolean; reason?: string } {
  try {
    const u = new URL(url)
    const isSeriesPath = /\/rod-blanks\//i.test(u.pathname) && !/\/(products|product|ecom)\//i.test(u.pathname)
    const lastSeg = u.pathname.split('/').filter(Boolean).pop() || ''
    const slugLike = lastSeg.toUpperCase().replace(/[^A-Z0-9-]+/g, '')
    if (rec.isHeader) return { stage: false, reason: 'header-heuristic' }
    if (isSeriesPath && rec.externalId === slugLike) return { stage: false, reason: 'series-path-slug' }
    return { stage: true }
  } catch {
    if (rec.isHeader) return { stage: false, reason: 'header-heuristic' }
    return { stage: true }
  }
}
import { upsertStaging } from '../staging/upsert'
import { fetchActiveSources, upsertProductSource, linkExternalIdForSource } from '../seeds/sources'
import { normalizeUrl } from '../lib/url'

const ORIGIN = 'https://batsonenterprises.com'

function isOnDomain(href: string) {
  try {
    const u = new URL(href, ORIGIN)
    return u.hostname === 'batsonenterprises.com' || u.hostname === 'www.batsonenterprises.com'
  } catch {
    return false
  }
}

async function sitemapProducts(page: { evaluate: (fn: () => Promise<string>) => Promise<string> }): Promise<string[]> {
  try {
    const res = await page.evaluate(async () => {
      const resp = await fetch('/sitemap.xml', { credentials: 'omit' })
      if (!resp.ok) return ''
      return await resp.text()
    })
    if (!res) return []
    const urls = Array.from(String(res).matchAll(/<loc>(.*?)<\/loc>/g)).map(m => m[1])
    return urls.filter((u: string) => isOnDomain(u) && /\/products\//i.test(u)).slice(0, 200)
  } catch {
    return []
  }
}

type Politeness = {
  jitterMs?: [number, number]
  maxConcurrency?: number
  rpm?: number // requests per minute
  blockAssetsOnLists?: boolean
}
export async function crawlBatson(
  seedUrls: string[],
  options?: { templateKey?: string; politeness?: Politeness; supplierId?: string; ignoreSavedSources?: boolean },
) {
  const SUPPLIER = options?.supplierId || 'batson'
  const seen = new Set<string>()
  try {
    log.setLevel(log.LEVELS.DEBUG)
  } catch {
    /* keep default */
  }
  // Compose initial seeds: saved from DB + env forced + caller-provided
  const savedRows = options?.ignoreSavedSources ? [] : await fetchActiveSources(SUPPLIER)
  const saved = (savedRows as Array<{ url: string }>).map((s: { url: string }) => s.url)
  const forcedEnv = (process.env.BATSON_FORCE_URLS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const seeds = Array.from(new Set([...(forcedEnv || []), ...seedUrls]))
    .map(u => normalizeUrl(u, ORIGIN))
    .filter((u): u is string => Boolean(u))
  const initial = Array.from(new Set([...(saved || []), ...seeds]))
  if (forcedEnv.length) log.info(`batson: forcing ${forcedEnv.length} URLs from BATSON_FORCE_URLS`)
  // Record seeds in DB as 'forced' (env or manual); discovery writes will use 'discovered'
  for (const u of initial) await upsertProductSource(SUPPLIER, u, 'forced')
  const jitter: [number, number] = options?.politeness?.jitterMs || [300, 800]
  const maxConc = options?.politeness?.maxConcurrency || 1
  const rpm = options?.politeness?.rpm || 30
  const blockAssets = options?.politeness?.blockAssetsOnLists !== false

  let headerSkipCount = 0
  const headerSkips: Array<{ externalId: string; reason: string; url: string }> = []
  const crawler = new PlaywrightCrawler({
    maxRequestsPerMinute: rpm,
    maxConcurrency: maxConc,
    requestHandlerTimeoutSecs: 120,
    navigationTimeoutSecs: 60,
    launchContext: {
      launchOptions: { args: ['--disable-dev-shm-usage', '--no-sandbox'] },
    },
    async requestHandler({ request, page, enqueueLinks }) {
      const currentUrl = request.loadedUrl || request.url

      // 1) Abort obvious third-party requests; allow same-domain including /ecom/*
      await page.route('**/*', route => {
        const u = route.request().url()
        if (/google|doubleclick|linkedin|bing|clarity|hubspot|facebook|k-ecommerce\.com/i.test(u)) return route.abort()
        if (!isOnDomain(u)) return route.abort()
        // On list/collection pages, optionally block heavy assets to be polite
        if (blockAssets && (/\/collections\//i.test(currentUrl) || /\/ecom\/purchaselistsearch/i.test(currentUrl))) {
          const rt = route.request().resourceType()
          if (rt === 'image' || rt === 'font') return route.abort()
        }
        return route.continue()
      })

      // 2) Navigate and wait for network to settle
      await page.goto(currentUrl, { waitUntil: 'domcontentloaded' }).catch(() => {})
      // Be resilient: don't block entirely on networkidle (some pages keep polling). Use timeout guard.
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

      // 3) If we are on /ecom/purchaselistsearch, wait for client-rendered results and enqueue detail links
      const isEcomList = /\/ecom\/purchaselistsearch/i.test(currentUrl)
      if (isEcomList) {
        // Try a few selectors; if none match, proceed to generic anchor scan
        try {
          await page.waitForSelector('a[href*="detail"], a[href*="/ecom/"], a[href*="/products/"]', { timeout: 5000 })
        } catch {
          /* no visible results rendered */
        }
        const productHrefs: string[] =
          (await page
            .locator('a[href*="detail"], a[href*="/ecom/"]')
            .evaluateAll(ns => ns.map(n => (n as HTMLAnchorElement).href).filter(Boolean))
            .catch(() => [])) || []
        const sameDomain = productHrefs.map(h => new URL(h, ORIGIN).toString()).filter(isOnDomain)
        const unique = Array.from(new Set(sameDomain))
        if (unique.length) {
          await Promise.all(unique.map(u => upsertProductSource(SUPPLIER, u, 'discovered')))
          await enqueueLinks({ urls: unique })
        }
      }

      // 4) Intercept XHR responses to discover additional /ecom/ links
      page.on('response', async r => {
        try {
          const u = r.url()
          if (!/purchaselist/i.test(u) || !r.ok()) return
          const headers = r.headers() as Record<string, string>
          const ct = headers['content-type'] || headers['Content-Type'] || ''
          const body = await r.text()
          const found: string[] = []
          if (/json/i.test(ct)) {
            try {
              const j = JSON.parse(body)
              const allVals: string[] = []
              const walk = (v: unknown) => {
                if (typeof v === 'string') allVals.push(v)
                else if (Array.isArray(v)) v.forEach(walk)
                else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk)
              }
              walk(j)
              found.push(...allVals.filter(s => /\/ecom\//i.test(s)))
            } catch {
              /* ignore JSON parse errors */
            }
          } else {
            const hrefs = Array.from(body.matchAll(/href=["']([^"']*\/ecom\/[^"]+)["']/gi)).map(m => m[1])
            found.push(...hrefs)
          }
          const urls = Array.from(new Set(found))
            .map(h => new URL(h, ORIGIN).toString())
            .filter(isOnDomain)
          if (urls.length) {
            await Promise.all(urls.map(u => upsertProductSource(SUPPLIER, u, 'discovered')))
            await enqueueLinks({ urls })
          }
        } catch {
          /* ignore response parsing errors */
        }
      })

      // 5) Anchor discovery on page (products + pagination)
      const allAnchors: string[] =
        (await page
          .locator('a[href]')
          .evaluateAll(ns => ns.map(n => (n as HTMLAnchorElement).href).filter(Boolean))
          .catch(() => [])) || []
      const sameDomainAnchors = allAnchors.map(h => new URL(h, ORIGIN).toString()).filter(isOnDomain)

      const isCollection = /\/collections\//i.test(currentUrl)
      const productAnchors: string[] = sameDomainAnchors.filter(h => /\/(products|product|ecom|rod-blanks)\//i.test(h))
      // If Shopify products path exists but list heuristics are empty, include them
      const pageAnchors: string[] = [
        ...sameDomainAnchors.filter(
          h => (/\/collections\//i.test(h) && /page=/.test(h)) || /\/ecom\/purchaselistsearch/i.test(h),
        ),
      ]

      log.debug(`batson discovery @ ${currentUrl}`, { products: productAnchors.length, pages: pageAnchors.length })

      // 6) Sitemap fallback from collections if needed
      if (isCollection && productAnchors.length < 2) {
        const fromMap = await sitemapProducts(page)
        if (fromMap.length) {
          log.debug(`batson sitemap fallback yielded ${fromMap.length} products`)
          productAnchors.push(...fromMap)
        }
      }

      const uniqueProducts = Array.from(new Set(productAnchors))
      if (uniqueProducts.length) {
        await Promise.all(uniqueProducts.map(u => upsertProductSource(SUPPLIER, u, 'discovered')))
        await enqueueLinks({ urls: uniqueProducts })
      }
      const uniquePages = Array.from(new Set(pageAnchors))
      if (uniquePages.length) {
        await Promise.all(uniquePages.map(u => upsertProductSource(SUPPLIER, u, 'discovered')))
        await enqueueLinks({ urls: uniquePages })
      }

      // 7) Treat product-detail pages (including /ecom/ detail) as detail and stage
      // Before single-product extraction, attempt multi-row series parsing for Batson rod blanks series pages
      let stagedFromSeries = 0
      try {
        const u = new URL(currentUrl)
        const isSeriesPath = /\/rod-blanks\//i.test(u.pathname) && !/\/(products|product|ecom)\//i.test(u.pathname)
        if (isSeriesPath) {
          const rows = await extractBatsonSeriesRows(page)
          if (rows && rows.length) {
            for (const row of rows) {
              if (seen.has(row.externalId)) continue
              seen.add(row.externalId)
              const toStage = {
                externalId: row.externalId,
                title: row.title,
                partType: 'Rod Blank',
                description: row.description || '',
                images: row.images || [],
                rawSpecs: row.rawSpecs,
                normSpecs: row.normSpecs,
              }
              await upsertStaging(SUPPLIER, toStage)
              await linkExternalIdForSource(SUPPLIER, currentUrl, row.externalId)
              log.info(`staged (series-row) ${row.externalId}`)
              stagedFromSeries++
            }
          }
        }
      } catch {
        /* ignore series parse errors */
      }
      if (stagedFromSeries > 0) {
        // If we successfully staged series rows, skip single-product extraction for this URL
        const [lo, hi] = jitter
        const delay = Math.max(0, Math.floor(lo + Math.random() * (hi - lo)))
        if (delay > 0) await new Promise(res => setTimeout(res, delay))
        return
      }

      const rec = await extractProduct(page, { templateKey: options?.templateKey })
      if (rec?.externalId) {
        // Skip staging for obvious series/listing pages (e.g., /rod-blanks/<series>) to avoid a spurious aggregate row
        try {
          const u = new URL(currentUrl)
          const isSeriesPath = /\/rod-blanks\//i.test(u.pathname) && !/\/(products|product|ecom)\//i.test(u.pathname)
          const lastSeg = u.pathname.split('/').filter(Boolean).pop() || ''
          const slugLike = lastSeg.toUpperCase().replace(/[^A-Z0-9-]+/g, '')
          const earlyHeader = rec.isHeader
          if ((isSeriesPath && rec.externalId === slugLike) || earlyHeader) {
            headerSkipCount++
            const reason = rec.headerReason || (isSeriesPath ? 'series-path-slug' : 'header-heuristic')
            headerSkips.push({ externalId: rec.externalId, reason, url: currentUrl })
            log.info(`skip header ${rec.externalId} @ ${currentUrl} reason=${reason}`)
          } else if (!seen.has(rec.externalId)) {
            seen.add(rec.externalId)
            // Strip header flags before staging (schema does not include these fields)
            const toStage = {
              externalId: rec.externalId,
              title: rec.title,
              partType: rec.partType,
              description: rec.description,
              images: rec.images,
              rawSpecs: rec.rawSpecs,
            }
            await upsertStaging(SUPPLIER, toStage)
            await linkExternalIdForSource(SUPPLIER, currentUrl, rec.externalId)
            log.info(`staged ${rec.externalId}`)
          }
        } catch {
          if (!seen.has(rec.externalId)) {
            seen.add(rec.externalId)
            const isHeader = (rec as { isHeader?: boolean }).isHeader
            const headerReason = (rec as { headerReason?: string }).headerReason
            if (isHeader) {
              headerSkipCount++
              const reason = headerReason || 'heuristic'
              headerSkips.push({ externalId: rec.externalId, reason, url: currentUrl })
              log.info(`skip header ${rec.externalId} @ ${currentUrl} reason=${reason}`)
            } else {
              const toStage = {
                externalId: rec.externalId,
                title: rec.title,
                partType: rec.partType,
                description: rec.description,
                images: rec.images,
                rawSpecs: rec.rawSpecs,
              }
              await upsertStaging(SUPPLIER, toStage)
              await linkExternalIdForSource(SUPPLIER, currentUrl, rec.externalId)
              log.info(`staged ${rec.externalId}`)
            }
          }
        }
      }

      // Jitter delay between requests to reduce server load
      const [lo, hi] = jitter
      const delay = Math.max(0, Math.floor(lo + Math.random() * (hi - lo)))
      if (delay > 0) await new Promise(res => setTimeout(res, delay))
    },
    failedRequestHandler({ request }) {
      log.warning(`batson failed ${request.url}`)
    },
  })

  await crawler.run(initial)
  log.info(`batson crawl finished: staged=${seen.size} headerSkip=${headerSkipCount}`)
  // Return crawl metrics for wiring into run summaries/logs
  return { stagedCount: seen.size, headerSkipCount, headerSkips }
}
// <!-- END RBP GENERATED: scrape-template-wiring-v2 -->
// <!-- END RBP GENERATED: batson-crawler-ecom-v1 -->
