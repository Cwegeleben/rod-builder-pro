// Core field definitions shared by server and client (no database access here)
// Base core field definitions (keys here are base keys, final keys may be prefixed per-template)
export const CORE_SPEC_FIELD_DEFS: Array<{
  key: string // base key (unprefixed)
  label: string
  type: 'text' | 'number' | 'boolean' | 'select'
  coreFieldPath: string
  required: boolean
}> = [
  { key: 'title', label: 'Title', type: 'text', coreFieldPath: 'title', required: true },
  { key: 'vendor', label: 'Vendor', type: 'text', coreFieldPath: 'vendor', required: true },
  { key: 'product_type', label: 'Product Type', type: 'text', coreFieldPath: 'productType', required: true },
  { key: 'tags', label: 'Tags', type: 'text', coreFieldPath: 'tags', required: true },
  // Rename Primary Variant SKU -> Model per user request
  { key: 'primary_variant_sku', label: 'Model', type: 'text', coreFieldPath: 'variants[0].sku', required: true },
  {
    key: 'primary_variant_price',
    label: 'Primary Variant Price',
    type: 'number',
    coreFieldPath: 'variants[0].price',
    required: true,
  },
]

export const CORE_FIELD_PATH_SET = new Set(CORE_SPEC_FIELD_DEFS.map(f => f.coreFieldPath))

// Slugify helper (shared by server & client) – conservative (a-z0-9 and underscores)
export function slugifyTemplateName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
}

// Build per-template core field defs with a prefix so keys are unique across templates.
// We keep the base definition array untouched for logic relying on coreFieldPath.
export function buildCoreFieldDefsForTemplate(templateName: string) {
  const prefix = slugifyTemplateName(templateName || 'template')
  return CORE_SPEC_FIELD_DEFS.map(def => ({
    ...def,
    key: `${prefix}_${def.key}`,
  }))
}
