// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import type { SiteConfig } from './batson.rod-blanks'
import { BatsonRodBlanksConfig } from './batson.rod-blanks'

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
