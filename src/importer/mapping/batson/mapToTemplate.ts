// <!-- BEGIN RBP GENERATED: label-driven-mapping-v1-0 -->
// Map a Batson variant to a template payload using the label-driven matcher.

import type { TemplateField } from '../labelDrivenMatcher'
import { matchTemplateFieldsFromKV } from '../labelDrivenMatcher'

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

  for (const m of mapped) {
    if (m.key === 'model') model = String(m.value ?? m.rawValue)
    else if (m.key === 'series') metafields['series'] = m.value
    else if (m.key === 'length_in') metafields['length_in'] = m.value
    else if (m.key === 'pieces') metafields['pieces'] = m.value
    else if (m.key === 'color') metafields['color'] = m.value
    else if (m.key === 'action') metafields['action'] = m.value
    else if (m.key === 'power') metafields['power'] = m.value
    else if (m.key === 'material') metafields['material'] = m.value
    else if (m.key === 'line_lb') metafields['line_lb'] = m.value
    else if (m.key === 'lure_oz') metafields['lure_oz'] = m.value
    else if (m.key === 'butt_od') metafields['butt_od'] = m.value
    else if (m.key === 'tip_size') metafields['tip_size'] = m.value
    else if (m.key === 'application') metafields['application'] = m.value
    else if (m.key === 'price_msrp') metafields['price_msrp'] = m.value
  }

  return { mapped, unmapped, sourceUnused, payload: { sku, model, metafields } }
}
// <!-- END RBP GENERATED: label-driven-mapping-v1-0 -->
