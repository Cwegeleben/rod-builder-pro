// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import type { NormalizedItem } from './mapping'

export interface DedupeOutcome {
  key: string
  action: 'create' | 'update' | 'skip'
  reason?: string
}

// Placeholder: In v1 we don't look up existing products; just mark all create.
// Future: query Shopify by SKU or title hash metafield.
export function dedupeItems(items: NormalizedItem[]): DedupeOutcome[] {
  const seen = new Set<string>()
  return items.map(i => {
    if (seen.has(i.dedupeKey)) return { key: i.dedupeKey, action: 'skip', reason: 'duplicate-in-batch' }
    seen.add(i.dedupeKey)
    return { key: i.dedupeKey, action: 'create' }
  })
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
