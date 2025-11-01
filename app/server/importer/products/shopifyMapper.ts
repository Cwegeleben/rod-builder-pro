// <!-- BEGIN RBP GENERATED: importer-crawlB-batson-attrgrid-v1 -->
import type { BlankSpec, BatsonGridRowRaw } from './batsonAttributeGrid'

const OZ_TO_GRAMS = 28.3495

function makeMetafields(spec: BlankSpec) {
  const mf: Array<{
    namespace: 'rbp.spec'
    key: string
    type: 'single_line_text_field' | 'number_integer' | 'number_decimal' | 'list.single_line_text_field'
    value: string
  }> = []
  type MFType = 'single_line_text_field' | 'number_integer' | 'number_decimal' | 'list.single_line_text_field'
  const push = (key: string, type: MFType, val: unknown) => {
    const present = val !== undefined && val !== null && !(Array.isArray(val) && !val.length)
    if (!present) return
    const value = Array.isArray(val) ? JSON.stringify(val) : String(val)
    mf.push({ namespace: 'rbp.spec', key, type, value })
  }
  push('series', 'single_line_text_field', spec.series)
  push('length_in', 'number_integer', spec.length_in)
  push('pieces', 'number_integer', spec.pieces)
  push('color', 'single_line_text_field', spec.color)
  push('action', 'single_line_text_field', spec.action)
  push('power', 'single_line_text_field', spec.power)
  push('material', 'single_line_text_field', spec.material)
  push('line_lb_min', 'number_integer', spec.line_lb_min)
  push('line_lb_max', 'number_integer', spec.line_lb_max)
  push('lure_oz_min', 'number_decimal', spec.lure_oz_min)
  push('lure_oz_max', 'number_decimal', spec.lure_oz_max)
  push('weight_oz', 'number_decimal', spec.weight_oz)
  push('butt_dia_in', 'number_decimal', spec.butt_dia_in)
  push('tip_top_size', 'single_line_text_field', spec.tip_top_size)
  push('applications', 'list.single_line_text_field', spec.applications ?? [])
  return mf
}

export function toShopifyPreview(seriesTitle: string, rows: Array<{ raw: BatsonGridRowRaw; spec: BlankSpec }>) {
  const tags = new Set<string>(['Supplier: Batson', 'Type: Rod Blank'])
  const variants = rows.map(({ raw, spec }) => {
    if (spec.material) tags.add(`Material: ${spec.material}`)
    if (spec.color) tags.add(`Color: ${spec.color}`)
    if (spec.action) tags.add(`Action: ${spec.action}`)
    if (spec.power) tags.add(`Power: ${spec.power}`)
    if (spec.series) tags.add(`Series: ${spec.series}`)

    const grams = spec.weight_oz ? Math.round(spec.weight_oz * OZ_TO_GRAMS) : undefined
    return {
      sku: raw.code,
      option1: spec.length_label ?? (spec.length_in ? `${spec.length_in} in` : undefined),
      option2: spec.power,
      option3: spec.action,
      price: raw.price != null ? raw.price.toFixed(2) : undefined,
      compare_at_price: raw.msrp != null ? raw.msrp.toFixed(2) : undefined,
      grams,
      taxable: true,
      inventory_policy: 'deny' as const,
      inventory_management: null,
    }
  })

  const productMetafields = makeMetafields(rows[0]?.spec ?? {})
  const product = {
    title: seriesTitle,
    vendor: 'Batson',
    product_type: 'Rod Blank',
    tags: Array.from(tags),
    options: [{ name: 'Length' }, { name: 'Power' }, { name: 'Action' }],
    variants,
    metafields: productMetafields,
  }
  return { product }
}
// <!-- END RBP GENERATED: importer-crawlB-batson-attrgrid-v1 -->
