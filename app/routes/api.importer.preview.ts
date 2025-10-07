// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { fetchPage } from '../services/importer/fetchPage'
import { applySelectors } from '../services/importer/selectorApply'
import { normalizeItems } from '../services/importer/mapping'
import { dedupeItems } from '../services/importer/dedupe'
import { assertRateLimit } from '../lib/rateLimit.server'

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireHqShopOr404(request)
  // Rate limit: 10 previews per 60s
  assertRateLimit({ key: 'importer:preview:rbp-hq-dev', limit: 10, windowMs: 60_000 })
  const body = await request.json()
  const { url, productType, mapping } = body
  if (!url || !productType || !mapping) return json({ error: 'Missing params' }, { status: 400 })
  const page = await fetchPage({ url })
  if (page.disallowed) return json({ items: [], pages: 0, errors: ['ROBOTS_DISALLOWED'] })
  const applied = applySelectors(page.html, mapping)
  const normalized = normalizeItems(applied, { productType })
  const dedupe = dedupeItems(normalized)
  const items = normalized.map(n => ({
    raw: n.raw,
    mapped: {
      title: n.title,
      price: n.price,
      vendor: n.vendor,
      sku: n.sku,
    },
    warnings: n.warnings,
    dedupeKey: n.dedupeKey,
    action: dedupe.find(d => d.key === n.dedupeKey)?.action || 'create',
  }))
  return json({ items, pages: 1 })
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
