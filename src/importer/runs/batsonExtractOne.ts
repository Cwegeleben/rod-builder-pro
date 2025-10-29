// <!-- BEGIN RBP GENERATED: label-driven-mapping-v1-0 -->
// Runtime helper to extract a Batson product and run the label-driven matcher if available.
// Intended for quick local smoke: provide HTML and simulate a parsed variant.

import { parseAttributeGrid } from '../extractors/batson/parseAttributeGrid'
import { matchTemplateFieldsFromKV } from '../mapping/labelDrivenMatcher'
import { BatsonBlanksTemplateFields } from '../templates/batson/blanksTemplate'

export async function batsonExtractOne(html: string) {
  const variants = parseAttributeGrid(html)
  if (!variants.length) {
    console.log('[batsonExtractOne] no variants parsed from attribute grid')
    return null
  }
  const variant = variants[0]

  const useLabelDriven =
    typeof matchTemplateFieldsFromKV === 'function' &&
    Array.isArray(BatsonBlanksTemplateFields) &&
    BatsonBlanksTemplateFields.length > 0

  if (!useLabelDriven) {
    console.log('[batsonExtractOne] label-driven matcher not available; using legacy fallback')
    return { mapped: [], unmapped: [], sourceUnused: [], payload: {} }
  }

  const { mapped, unmapped, sourceUnused } = matchTemplateFieldsFromKV(BatsonBlanksTemplateFields, variant.raw)

  for (const m of mapped) {
    const tag = m.score >= 0.7 ? 'auto' : 'review'
    console.log(`✔ ${m.key} ← ${m.sourceLabel} [${tag} score=${m.score.toFixed(2)}]`)
  }
  if (unmapped.length) {
    console.log('Unmapped fields:', unmapped.map(u => u.label).join(', '))
  }
  if (sourceUnused.length) {
    console.log('Unused labels:', sourceUnused.map(s => s.label).join(', '))
  }

  return { mapped, unmapped, sourceUnused }
}
// <!-- END RBP GENERATED: label-driven-mapping-v1-0 -->
