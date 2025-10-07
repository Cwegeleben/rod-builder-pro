// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
// HTML parsing + selection helpers. Uses JSDOM-like minimal DOM via DOMParser in Node 18 (experimental) or fallback to regex.
// Intentionally lightweight; can replace with a robust parser later.

export type HTMLElementLike = Element & { getAttribute(name: string): string | null }

export interface SelectionResult {
  elements: HTMLElementLike[]
  values: string[]
}

export function parseHtml(html: string): Document {
  // Unsafe but acceptable for controlled server-side usage.
  return new DOMParser().parseFromString(html, 'text/html')
}

export function selectAll(doc: Document | Element, selector: string): HTMLElementLike[] {
  try {
    return Array.from(doc.querySelectorAll(selector)) as HTMLElementLike[]
  } catch {
    return []
  }
}

export function selectXPath(doc: Document | Element, xpath: string): HTMLElementLike[] {
  try {
    const nodes: HTMLElementLike[] = []
    const evaluator = doc.ownerDocument || (doc as Document)
    const result = evaluator.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
    for (let i = 0; i < result.snapshotLength; i++) {
      const n = result.snapshotItem(i)
      if (n && n.nodeType === 1) nodes.push(n as HTMLElementLike)
    }
    return nodes
  } catch {
    return []
  }
}

export function extractValues(els: HTMLElementLike[], attr?: string): string[] {
  return els.map(el => {
    if (attr === 'text' || !attr) return (el.textContent || '').trim()
    if (attr === 'html') return (el as HTMLElement).innerHTML
    return el.getAttribute(attr) || ''
  })
}

export function deriveCssSelector(el: Element): string {
  const parts: string[] = []
  let cur: Element | null = el
  while (cur && parts.length < 5) {
    const id = cur.getAttribute('id')
    if (id) {
      parts.unshift(`#${cssEscape(id)}`)
      break
    }
    let sel = cur.tagName.toLowerCase()
    const classAttr = cur.getAttribute('class')
    if (classAttr) {
      const firstClass = classAttr.split(/\s+/).filter(Boolean)[0]
      if (firstClass) sel += `.${cssEscape(firstClass)}`
    }
    parts.unshift(sel)
    cur = cur.parentElement
  }
  return parts.join(' > ')
}

function cssEscape(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, s => `\\${s}`)
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
