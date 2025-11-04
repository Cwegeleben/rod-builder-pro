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
    const staticHtml = await fetchHtml('static')
    if (staticHtml && staticHtml.trim()) {
      const res = runBatsonListing(staticHtml, baseUrl)
      if (res.seeds.length > 0) return { ...res, usedMode: 'static' }
    }
    const headlessHtml = await fetchHtml('headless')
    if (headlessHtml && headlessHtml.trim()) {
      const res = runBatsonListing(headlessHtml, baseUrl)
      if (res.seeds.length > 0) return { ...res, usedMode: 'headless' }
    }
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
        strategyTried: ['heading-proximity', 'grid', 'nav', 'list', 'jsonld', 'heuristic'],
        strategyUsed: 'heuristic',
        totalFound: 0,
        deduped: 0,
        sample: [],
        notes: ['No series links discovered in static or headless HTML.'],
        // <!-- END RBP GENERATED: importer-discover-hardening-v1 -->
      },
      usedMode: staticHtml ? 'static' : headlessHtml ? 'headless' : 'none',
    }
  },
}
// <!-- END RBP GENERATED: importer-discover-batson-series-v1 -->
