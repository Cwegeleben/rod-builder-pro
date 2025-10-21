// <!-- BEGIN RBP GENERATED: importer-normalize-diff-v1 -->
export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const v = JSON.parse(m[1].trim())
      if (Array.isArray(v)) {
        out.push(...v)
      } else {
        out.push(v)
      }
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }
  return out
}

export function mapProductFromJsonLd(objs: unknown[]) {
  const isProductLike = (o: unknown): o is Record<string, unknown> => {
    if (!o || typeof o !== 'object') return false
    const t = (o as Record<string, unknown>)['@type']
    return t === 'Product' || (Array.isArray(t) && t.includes('Product'))
  }
  const p = objs.find(isProductLike) as Record<string, unknown> | undefined
  if (!p) return null
  const offers = p['offers'] as unknown
  const offer = Array.isArray(offers)
    ? (offers[0] as Record<string, unknown> | undefined)
    : (offers as Record<string, unknown> | undefined)
  return {
    title: p['name'] as string | undefined,
    externalId: (p['sku'] || p['mpn'] || p['productID'] || p['identifier']) as string | undefined,
    images: Array.isArray(p['image']) ? (p['image'] as unknown as string[]) : p['image'] ? [String(p['image'])] : [],
    priceMsrp: offer && typeof offer.price !== 'undefined' ? Number(offer.price) : undefined,
    rawSpecs: Array.isArray(p['additionalProperty'])
      ? Object.fromEntries(
          (p['additionalProperty'] as Array<unknown>)
            .map(x => (x && typeof x === 'object' ? (x as Record<string, unknown>) : null))
            .filter((x): x is Record<string, unknown> => !!x && typeof x.name === 'string')
            .map(x => [String(x.name), x.value as unknown]),
        )
      : {},
  }
}
// <!-- END RBP GENERATED: importer-normalize-diff-v1 -->
