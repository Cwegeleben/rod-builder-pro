// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
export type SiteConfig = {
  id: string
  match: (url: string) => boolean
  discovery: { model: 'batson-listing' | 'sitemap' | 'grid' | 'regex'; headless: boolean }
  products: { scrapeType: 'auto' | 'batson-attribute-grid' }
}

export const BatsonRodBlanksConfig: SiteConfig = {
  id: 'batson-rod-blanks',
  match: (url: string) => {
    try {
      const u = new URL(url)
      if (!/batsonenterprises\.com$/i.test(u.hostname)) return false
      // <!-- BEGIN RBP GENERATED: importer-discover-headless-harden-v1 -->
      // Accept both the legacy /rod-blanks and Shopify collections path /collections/blanks
      return (
        /^\/rod-blanks\/?$/i.test(u.pathname) ||
        /^\/rod-blanks\//i.test(u.pathname) ||
        /^\/collections\/blanks(\/|$)/i.test(u.pathname)
      )
      // <!-- END RBP GENERATED: importer-discover-headless-harden-v1 -->
    } catch {
      return false
    }
  },
  discovery: { model: 'batson-listing', headless: true },
  products: { scrapeType: 'batson-attribute-grid' },
}
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->

// <!-- BEGIN RBP GENERATED: importer-discover-batson-series-v1 -->
import type { DiscoverResult } from '../discovery/batsonListing'
import { crawlBatsonRodBlanksListing as runBatsonListing } from '../discovery/batsonListing'

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
} as const

const MAX_PAGINATION_PAGES = 40

const parseLastPageNumber = (html: string | null | undefined): number => {
  if (!html) return 1
  const match = html.match(/ListingProduct\.data\.lastPageNumber\s*=\s*(\d+)/i)
  if (!match) return 1
  const n = Number(match[1])
  return Number.isFinite(n) && n > 1 ? Math.min(n, MAX_PAGINATION_PAGES) : 1
}

const appendPageParam = (baseUrl: string, page: number): string => {
  try {
    const u = new URL(baseUrl)
    u.searchParams.set('page', String(page))
    return u.toString()
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${sep}page=${page}`
  }
}

const fetchPageHtml = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url, { headers: REQUEST_HEADERS })
    if (!res.ok) return null
    const text = await res.text()
    return text && text.trim().length ? text : null
  } catch {
    return null
  }
}

// File-driven site object with an inline discover runner that tries static first then headless
export const BatsonRodBlanksSite = {
  id: 'batson-rod-blanks',
  match(url: string) {
    try {
      const u = new URL(url)
      // <!-- BEGIN RBP GENERATED: importer-discover-headless-harden-v1 -->
      // Accept both /rod-blanks (root and subpaths) and /collections/blanks as the canonical listing page
      const path = u.pathname.replace(/\/+$/, '')
      return (
        u.hostname.endsWith('batsonenterprises.com') &&
        (/^\/rod-blanks(\/|$)/i.test(path) ||
          path === '/collections/blanks' ||
          /^\/collections\/blanks\//i.test(u.pathname))
      )
      // <!-- END RBP GENERATED: importer-discover-headless-harden-v1 -->
    } catch {
      return false
    }
  },
  // <!-- BEGIN RBP GENERATED: importer-crawlB-polaris-v1 -->
  // Declare Crawl B products model and UI defaults used by Preview/Apply
  productsModel: 'batson-attribute-grid' as const,
  defaults: {
    vendor: 'Batson',
    productType: 'Rod Blank',
    options: ['Length', 'Power', 'Action'] as const,
  },
  // <!-- END RBP GENERATED: importer-crawlB-polaris-v1 -->
  async discover(
    fetchHtml: (mode: 'static' | 'headless') => Promise<string | null>,
    baseUrl: string,
  ): Promise<DiscoverResult & { usedMode: 'static' | 'headless' | 'none' }> {
    const notes: string[] = []
    const seeds = new Set<string>()
    let htmlToUse: string | null = null
    let usedMode: 'static' | 'headless' | 'none' = 'none'

    const staticHtml = await fetchHtml('static')
    if (staticHtml && staticHtml.trim()) {
      htmlToUse = staticHtml
      usedMode = 'static'
    }
    if (!htmlToUse) {
      const headlessHtml = await fetchHtml('headless')
      if (headlessHtml && headlessHtml.trim()) {
        htmlToUse = headlessHtml
        usedMode = 'headless'
      }
    }
    if (!htmlToUse) {
      return {
        seeds: [],
        debug: {
          strategyTried: ['static', 'headless'],
          strategyUsed: 'static',
          totalFound: 0,
          deduped: 0,
          sample: [],
          notes: ['No HTML returned for listing page.'],
        },
        usedMode: 'none' as const,
      }
    }

    const baseResult = runBatsonListing(htmlToUse, baseUrl)
    baseResult?.seeds?.forEach(seed => seeds.add(seed.url))

    const lastPage = parseLastPageNumber(htmlToUse)
    if (lastPage > 1) {
      for (let page = 2; page <= lastPage; page++) {
        const pageUrl = appendPageParam(baseUrl, page)
        const html = await fetchPageHtml(pageUrl)
        if (!html) {
          notes.push(`pagination page ${page} returned empty`)
          continue
        }
        const res = runBatsonListing(html, baseUrl)
        if (!res.seeds.length) notes.push(`pagination page ${page} had 0 tiles`)
        res.seeds.forEach(seed => seeds.add(seed.url))
      }
    }

    if (seeds.size === 0) {
      // <!-- BEGIN RBP GENERATED: importer-discover-headless-harden-v1 -->
      // Temporary manual-seeds safety net: ensures flow never stalls while selectors stabilize
      const manualSeeds: Array<{ url: string; title?: string }> = [
        // Add one or two stable top-level series URLs once confirmed
        // Example placeholder:
        // { url: 'https://batsonenterprises.com/rx6', title: 'RX6' },
      ]
      if (manualSeeds.length) {
        return {
          seeds: manualSeeds.map(s => ({ url: s.url })),
          debug: {
            strategyTried: ['manual-fallback'],
            strategyUsed: 'manual-fallback',
            totalFound: manualSeeds.length,
            deduped: manualSeeds.length,
            sample: manualSeeds.map(s => s.url).slice(0, 5),
            notes: ['Static and headless returned empty; using manual seeds to unblock.'],
          },
          usedMode: 'none' as const,
        }
      }
      // <!-- END RBP GENERATED: importer-discover-headless-harden-v1 -->
      return {
        seeds: [],
        debug: {
          // <!-- BEGIN RBP GENERATED: importer-discover-hardening-v1 -->
          strategyTried: ['batson-listing', 'pagination', 'heuristic'],
          strategyUsed: 'batson-listing',
          totalFound: 0,
          deduped: 0,
          sample: [],
          notes: notes.length ? notes : ['Listing returned no seeds.'],
          // <!-- END RBP GENERATED: importer-discover-hardening-v1 -->
        },
        usedMode,
      }
    }

    const finalSeeds = Array.from(seeds)
    return {
      seeds: finalSeeds.map(url => ({ url })),
      debug: {
        strategyTried: ['batson-listing', 'pagination'],
        strategyUsed: 'pagination+batson-listing',
        totalFound: finalSeeds.length,
        deduped: finalSeeds.length,
        sample: finalSeeds.slice(0, 5),
        notes: notes.length ? notes : undefined,
      },
      usedMode,
    }
  },
}
// <!-- END RBP GENERATED: importer-discover-batson-series-v1 -->
