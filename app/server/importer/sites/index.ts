// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import type { SiteConfig } from './batson.rod-blanks'
import { BatsonRodBlanksConfig } from './batson.rod-blanks'
// <!-- BEGIN RBP GENERATED: importer-discover-batson-series-v1 -->
import { BatsonRodBlanksSite } from './batson.rod-blanks'
// <!-- END RBP GENERATED: importer-discover-batson-series-v1 -->
// <!-- BEGIN RBP GENERATED: importer-known-targets-v1 -->
export function getDiscoverSiteById(id: string) {
  try {
    if (id === 'batson-rod-blanks') return BatsonRodBlanksSite
  } catch {
    /* ignore */
  }
  return null
}

export function getSiteConfigById(id: string): SiteConfig | null {
  switch (id) {
    case 'batson-rod-blanks':
      return BatsonRodBlanksConfig
    default:
      return null
  }
}
// <!-- END RBP GENERATED: importer-known-targets-v1 -->

const ALL: SiteConfig[] = [BatsonRodBlanksConfig]

const DEFAULTS: SiteConfig = {
  id: 'default',
  match: () => true,
  discovery: { model: 'grid', headless: false },
  products: { scrapeType: 'auto' },
}

export function getSiteConfigForUrl(url: string): SiteConfig {
  for (const cfg of ALL) {
    try {
      if (cfg.match(url)) return cfg
    } catch {
      /* ignore bad match */
    }
  }
  return DEFAULTS
}

export const SITE_CONFIGS = ALL
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->

// <!-- BEGIN RBP GENERATED: importer-discover-batson-series-v1 -->
export { BatsonRodBlanksSite } from './batson.rod-blanks'

// Narrow helper used by the v1 discover flow to get a site object that may implement `discover`
export function getSiteConfigForUrlDiscoverV1(url: string) {
  try {
    if (BatsonRodBlanksSite.match(url)) return BatsonRodBlanksSite
  } catch {
    /* ignore */
  }
  return null
}
// <!-- END RBP GENERATED: importer-discover-batson-series-v1 -->
