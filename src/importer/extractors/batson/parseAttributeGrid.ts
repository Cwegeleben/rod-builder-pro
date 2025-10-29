// <!-- BEGIN RBP GENERATED: label-driven-mapping-v1-0 -->
// Parse a Batson-style attribute grid (<table class="attribute-grid">) extracting rows into
// normalized variants with a raw KV of label->value pairs. This keeps raw unaltered labels for
// the label-driven matcher.

export type ParsedVariant = {
  raw: Record<string, unknown>
}

export function parseAttributeGrid(html: string): ParsedVariant[] {
  // Lightweight, DOM-less parse using regex heuristics to support Node runtime in scripts.
  // For production scraping, prefer Playwright DOM APIs; this helper ensures we retain raw KVs.
  const rows: ParsedVariant[] = []
  const tableMatch = html.match(/<table[^>]*class=["'][^"']*attribute-grid[^"']*["'][^>]*>[\s\S]*?<\/table>/i)
  if (!tableMatch) return rows
  const tableHtml = tableMatch[0]
  const trRegex = /<tr[\s\S]*?<\/tr>/gi
  const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
  const labelCleaner = (s: string) =>
    s
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  let m: RegExpExecArray | null
  while ((m = trRegex.exec(tableHtml))) {
    const tr = m[0]
    const cells = [...tr.matchAll(tdRegex)].map(c => labelCleaner(c[1]))
    if (cells.length >= 2) {
      const kv: Record<string, string> = {}
      for (let i = 0; i + 1 < cells.length; i += 2) {
        const k = cells[i]
        const v = cells[i + 1]
        if (k) kv[k] = v
      }
      if (Object.keys(kv).length) rows.push({ raw: kv })
    }
  }
  return rows
}
// <!-- END RBP GENERATED: label-driven-mapping-v1-0 -->
