// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import { parseHtml, selectAll, selectXPath, extractValues } from '../../lib/html'

export interface FieldMapping {
  key: string
  selector: string
  attr?: string // text | html | attribute name
  xpath?: string // optional fallback
  transforms?: string[] // e.g. ['trim','number','currency']
  required?: boolean
}

export interface MappingConfig {
  item: { container: string }
  fields: FieldMapping[]
  detailLinkSelector?: string
}

export interface AppliedItemRaw {
  index: number
  elementHtml: string
  fields: Record<string, { value: string; warnings: string[] }>
  detailUrl?: string
}

export function applySelectors(html: string, mapping: MappingConfig): AppliedItemRaw[] {
  const doc = parseHtml(html)
  const itemEls = selectAll(doc, mapping.item.container)
  return itemEls.map((el, idx) => {
    const fields: AppliedItemRaw['fields'] = {}
    for (const fm of mapping.fields) {
      let primary = selectAll(el, fm.selector)
      if (primary.length === 0 && fm.xpath) {
        primary = selectXPath(el, fm.xpath)
      }
      const values = extractValues(primary, fm.attr || 'text')
      const raw = values[0] || ''
      const warnings: string[] = []
      if (!raw && fm.required) warnings.push('missing')
      fields[fm.key] = { value: transformValue(raw, fm.transforms || []), warnings }
    }
    let detailUrl: string | undefined
    if (mapping.detailLinkSelector) {
      const linkEl = selectAll(el, mapping.detailLinkSelector)[0]
      if (linkEl) detailUrl = linkEl.getAttribute('href') || undefined
    }
    return {
      index: idx,
      elementHtml: (el as HTMLElement).outerHTML.slice(0, 5000),
      fields,
      detailUrl,
    }
  })
}

function transformValue(v: string, transforms: string[]): string {
  let out = v
  for (const t of transforms) {
    switch (t) {
      case 'trim':
        out = out.trim()
        break
      case 'number':
        out = out.replace(/[^0-9.+-]/g, '')
        break
      case 'lower':
        out = out.toLowerCase()
        break
      case 'upper':
        out = out.toUpperCase()
        break
      default:
        if (t.startsWith('regex:')) {
          const [, pattern, repl = ''] = t.split(':', 3)
          try {
            const re = new RegExp(pattern, 'g')
            out = out.replace(re, repl)
          } catch {
            // ignore
          }
        }
    }
  }
  return out
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
