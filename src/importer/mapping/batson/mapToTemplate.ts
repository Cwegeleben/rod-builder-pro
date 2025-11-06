// <!-- BEGIN RBP GENERATED: label-driven-mapping-v1-0 -->
// Map a Batson variant to a template payload using the label-driven matcher.

import type { TemplateField } from '../labelDrivenMatcher'
import { matchTemplateFieldsFromKV } from '../labelDrivenMatcher'
import { formatLineLbRangeString, formatLureOzRangeString } from '../../../../packages/importer/src/lib/specRange'

export async function mapBatsonVariantToTemplate(
  variant: { raw: Record<string, unknown> },
  fields: TemplateField[],
): Promise<{
  mapped: ReturnType<typeof matchTemplateFieldsFromKV>['mapped']
  unmapped: ReturnType<typeof matchTemplateFieldsFromKV>['unmapped']
  sourceUnused: ReturnType<typeof matchTemplateFieldsFromKV>['sourceUnused']
  payload: { sku?: string; model?: string; metafields: Record<string, unknown> }
}> {
  const { mapped, unmapped, sourceUnused } = matchTemplateFieldsFromKV(fields, variant.raw || {})

  const metafields: Record<string, unknown> = {}
  let sku: string | undefined
  let model: string | undefined

  // Upstream normalization: ensure every attribute destined for a Shopify metafield
  // is coerced to a safe single-line <=255 chars string (or omitted if empty).
  const clean = (val: unknown): string | undefined => {
    if (val === null || val === undefined) return undefined
    if (Array.isArray(val)) {
      const parts = val
        .map(v => (v === null || v === undefined ? '' : String(v)))
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 25)
      if (!parts.length) return undefined
      val = parts.join(', ')
    }
    const s = String(val)
      .replace(/[\r\n]+/g, ' ')
      .trim()
    if (!s) return undefined
    return s.length > 255 ? s.slice(0, 255) : s
  }

  for (const m of mapped) {
    if (m.key === 'model') model = String(m.value ?? m.rawValue)
    else if (m.key === 'series') metafields['series'] = clean(m.value)
    else if (m.key === 'length_in') metafields['length_in'] = clean(m.value)
    else if (m.key === 'pieces') metafields['pieces'] = clean(m.value)
    else if (m.key === 'color') metafields['color'] = clean(m.value)
    else if (m.key === 'action') metafields['action'] = clean(m.value)
    else if (m.key === 'power') metafields['power'] = clean(m.value)
    else if (m.key === 'material') metafields['material'] = clean(m.value)
    else if (m.key === 'line_lb') {
      // Prefer preserving the human-readable range string derived from the source
      const raw = String(m.rawValue || '')
      metafields['line_lb'] = clean(formatLineLbRangeString(raw))
    } else if (m.key === 'lure_oz') {
      const raw = String(m.rawValue || '')
      metafields['lure_oz'] = clean(formatLureOzRangeString(raw))
    } else if (m.key === 'butt_od') metafields['butt_od'] = clean(m.value)
    else if (m.key === 'tip_size') metafields['tip_size'] = clean(m.value)
    else if (m.key === 'application') metafields['application'] = clean(m.value)
    else if (m.key === 'price_msrp') metafields['price_msrp'] = clean(m.value)
  }

  return { mapped, unmapped, sourceUnused, payload: { sku, model, metafields } }
}
// <!-- END RBP GENERATED: label-driven-mapping-v1-0 -->
