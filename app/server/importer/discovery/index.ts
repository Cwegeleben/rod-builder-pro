// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->

export type DiscoveryModel = 'batson-listing' | 'sitemap' | 'grid' | 'regex'

function toAbs(href: string, base: string) {
  try {
    return new URL(href, base).toString()
  } catch {
    return href
  }
}

function normalizeSameHost(urls: Iterable<string>, sourceUrl: string) {
  const out = new Set<string>()
  const src = new URL(sourceUrl)
  for (const u of urls) {
    try {
      const x = new URL(u)
      if (x.hostname !== src.hostname) continue
      x.hash = ''
      x.search = ''
      out.add(x.toString())
    } catch {
      // ignore
    }
  }
  return Array.from(out)
}

async function discoverBatsonListing(html: string, base: string): Promise<string[]> {
  const { crawlBatsonRodBlanksListing } = await import('../crawlers/batsonListing')
  return crawlBatsonRodBlanksListing(html, base)
}

function discoverFromSitemapXml(xml: string): string[] {
  const out = new Set<string>()
  // very small xml loc extractor
  try {
    const re = /<loc>([^<]+)<\/loc>/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(xml))) {
      const loc = (m[1] || '').trim()
      if (loc) out.add(loc)
    }
  } catch {
    /* ignore */
  }
  return Array.from(out)
}

function anchorHeuristics(html: string, base: string): string[] {
  const out = new Set<string>()
  // collect anchor hrefs
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const href = (m[1] || '').trim()
    if (!href) continue
    const abs = toAbs(href, base)
    if (!abs) continue
    out.add(abs)
  }
  // prefer series-like paths
  const all = Array.from(out)
  const preferred = all.filter(u => /(rod-blanks|blanks-by-series|collections\/.+blank)/i.test(u))
  return (preferred.length ? preferred : all).slice(0, 500)
}

export async function runDiscovery(
  model: DiscoveryModel,
  html: string,
  base: string,
  sourceUrl: string,
): Promise<string[]> {
  switch (model) {
    case 'batson-listing': {
      return await discoverBatsonListing(html, base)
    }
    case 'sitemap': {
      const urls = discoverFromSitemapXml(html)
      return normalizeSameHost(urls, sourceUrl)
    }
    case 'grid': {
      const urls = anchorHeuristics(html, base)
      return normalizeSameHost(urls, sourceUrl)
    }
    case 'regex': {
      const urls = anchorHeuristics(html, base)
      return normalizeSameHost(urls, sourceUrl)
    }
    default:
      return []
  }
}

export const DISCOVERY_REGISTRY: Record<DiscoveryModel, string> = {
  'batson-listing': 'Batson rod-blanks listing (series links)',
  sitemap: 'Sitemap.xml (loc URLs)',
  grid: 'Generic listing grid (anchors)',
  regex: 'Regex/anchors (heuristics)',
}
// TODO(importer-v2-3): Add site-specific discovery scrapers here as needed.
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
