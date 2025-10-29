// hq-importer-new-import-v2
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { listTemplatesSummary } from '../models/specTemplate.server'
import { listScrapers } from '../services/importer/scrapers.server'
import { authenticate } from '../shopify.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const url = new URL(request.url)
  const kind = (url.searchParams.get('kind') || '').toLowerCase()
  if (kind === 'variant') {
    const tpls = await listTemplatesSummary()
    return json(
      tpls.map(t => ({ id: t.id, name: t.name, kind: 'variant', fields: t.fieldsCount, variantsSummary: 'TBD' })),
    )
  }
  if (kind === 'scraper') {
    const scrapers = await listScrapers()
    return json(scrapers)
  }
  // <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 -->
  if (kind === 'variant-remote') {
    const { admin } = await authenticate.admin(request)
    const TYPE = 'rbp_template'
    const first = 100
    let after: string | null = null
    const out: Array<{
      id: string
      hasPrice: boolean
      hasPrimaryVariantCost: boolean
      hasProductImageUrl: boolean
      hasSupplierAvailability: boolean
    }> = []
    const GQL = `#graphql
      query List($type: String!, $first: Int!, $after: String) {
        metaobjects(type: $type, first: $first, after: $after) {
          edges { cursor node {
            handle
            fieldsJson: field(key:"fields_json"){ value }
            img: field(key:"product_image_url"){ value }
            sav: field(key:"supplier_availability"){ value }
          } }
          pageInfo { hasNextPage endCursor }
        }
      }
    `
    while (true) {
      const resp = await admin.graphql(GQL, { variables: { type: TYPE, first, after } })
      if (!resp.ok) break
      const jr = (await resp.json()) as {
        data?: {
          metaobjects?: {
            edges: Array<{
              cursor: string
              node: {
                handle?: string
                fieldsJson?: { value?: string | null } | null
                img?: { value?: string | null } | null
                sav?: { value?: string | null } | null
              }
            }>
            pageInfo: { hasNextPage: boolean; endCursor?: string | null }
          }
        }
      }
      const edges = jr?.data?.metaobjects?.edges || []
      for (const e of edges) {
        const handle = e?.node?.handle
        if (!handle) continue
        let hasPrice = false
        let hasPVC = false
        let hasImg = false
        let hasSav = false
        try {
          const raw = e?.node?.fieldsJson?.value
          const arr = raw ? JSON.parse(raw) : []
          if (Array.isArray(arr)) {
            hasPrice = arr.some((f: unknown) => {
              if (!f || typeof f !== 'object') return false
              const rec = f as { storage?: string; coreFieldPath?: string }
              return rec.storage === 'CORE' && rec.coreFieldPath === 'variants[0].price'
            })
            hasPVC = arr.some((f: unknown) => {
              if (!f || typeof f !== 'object') return false
              const rec = f as { storage?: string; coreFieldPath?: string }
              return rec.storage === 'CORE' && rec.coreFieldPath === 'variants[0].inventoryItem.cost'
            })
          }
        } catch {
          /* ignore */
        }
        hasImg = typeof e?.node?.img?.value === 'string' && e.node.img.value !== ''
        hasSav = typeof e?.node?.sav?.value === 'string' && e.node.sav.value !== ''
        out.push({
          id: handle,
          hasPrice,
          hasPrimaryVariantCost: hasPVC,
          hasProductImageUrl: hasImg,
          hasSupplierAvailability: hasSav,
        })
      }
      const pi = jr?.data?.metaobjects?.pageInfo
      if (pi?.hasNextPage && pi?.endCursor) after = pi.endCursor
      else break
    }
    return json(out)
  }
  // <!-- END RBP GENERATED: importer-templates-orphans-v1 -->
  return json({ error: 'Missing or invalid kind' }, { status: 400 })
}

export default function TemplatesApi() {
  return null
}
