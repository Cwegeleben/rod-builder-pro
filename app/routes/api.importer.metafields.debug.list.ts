import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { getAdminClient } from '../services/shopifyAdmin.server'

type RawDef = {
  id?: unknown
  name?: unknown
  key?: unknown
  namespace?: unknown
  ownerType?: unknown
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  try {
    const shop = process.env.SHOP || process.env.SHOP_CUSTOM_DOMAIN || ''
    if (!shop) throw new Error('SHOP not configured')
    const { accessToken, shopName } = await getAdminClient(shop)
    const base = `https://${shopName}/admin/api/2025-01`

    const headers = {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    // REST broad
    const restBroadResp = await fetch(`${base}/metafield_definitions.json?limit=250`, { headers })
    const restBroadText = await restBroadResp.text()
    type RestDefs = { metafield_definitions?: RawDef[] }
    let restBroadJson: RestDefs | null = null
    try {
      restBroadJson = JSON.parse(restBroadText) as RestDefs
    } catch {
      /* ignore */
    }
    const restBroadDefs: RawDef[] = (restBroadJson?.metafield_definitions as RawDef[]) || []

    // REST product
    const restProdResp = await fetch(`${base}/metafield_definitions.json?owner_type=product&limit=250`, { headers })
    const restProdText = await restProdResp.text()
    let restProdJson: RestDefs | null = null
    try {
      restProdJson = JSON.parse(restProdText) as RestDefs
    } catch {
      /* ignore */
    }
    const restProdDefs: RawDef[] = (restProdJson?.metafield_definitions as RawDef[]) || []

    // REST by key (series) for namespace rbp_spec
    const restKeyResp = await fetch(
      `${base}/metafield_definitions.json?owner_type=product&namespace=rbp_spec&key=series`,
      { headers },
    )
    const restKeyText = await restKeyResp.text()

    // GraphQL namespace
    const gqlUrl = `${base}/graphql.json`
    const gqlNsQuery = `query defs($ns: String!) { metafieldDefinitions(first: 100, ownerType: PRODUCT, namespace: $ns) { edges { node { id name key namespace ownerType } } } }`
    const gqlNsResp = await fetch(gqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: gqlNsQuery, variables: { ns: 'rbp_spec' } }),
    })
    const gqlNsText = await gqlNsResp.text()
    type GqlDefs = { data?: { metafieldDefinitions?: { edges?: Array<{ node?: RawDef | null }> } } }
    let gqlNsJson: GqlDefs | null = null
    try {
      gqlNsJson = JSON.parse(gqlNsText) as GqlDefs
    } catch {
      /* ignore */
    }
    const gqlNsEdges: Array<{ node?: RawDef | null }> = gqlNsJson?.data?.metafieldDefinitions?.edges || []

    // GraphQL all product
    const gqlAllQuery = `query allProductDefs { metafieldDefinitions(first: 100, ownerType: PRODUCT) { edges { node { id name key namespace ownerType } } } }`
    const gqlAllResp = await fetch(gqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: gqlAllQuery }),
    })
    const gqlAllText = await gqlAllResp.text()
    let gqlAllJson: GqlDefs | null = null
    try {
      gqlAllJson = JSON.parse(gqlAllText) as GqlDefs
    } catch {
      /* ignore */
    }
    const gqlAllEdges: Array<{ node?: RawDef | null }> = gqlAllJson?.data?.metafieldDefinitions?.edges || []

    const summarize = (defs: RawDef[]) => ({
      count: Array.isArray(defs) ? defs.length : 0,
      sample: (defs || [])
        .slice(0, 12)
        .map(d => `${String(d.namespace || '')}:${String(d.key || '')}:${String(d.ownerType || '')}`),
    })

    return json({
      host: shopName,
      rest: {
        broad: { ok: restBroadResp.ok, status: restBroadResp.status, ...summarize(restBroadDefs) },
        product: { ok: restProdResp.ok, status: restProdResp.status, ...summarize(restProdDefs) },
        byKey: { ok: restKeyResp.ok, status: restKeyResp.status, body: restKeyText.slice(0, 500) },
      },
      gql: {
        namespace: {
          ok: gqlNsResp.ok,
          status: gqlNsResp.status,
          edges: gqlNsEdges.length,
          keys: gqlNsEdges
            .map(e => e?.node)
            .filter(Boolean)
            .slice(0, 20)
            .map(n => `${String(n!.namespace || '')}:${String(n!.key || '')}:${String(n!.ownerType || '')}`),
          body: gqlNsText.slice(0, 500),
        },
        allProduct: {
          ok: gqlAllResp.ok,
          status: gqlAllResp.status,
          edges: gqlAllEdges.length,
          keys: gqlAllEdges
            .map(e => e?.node)
            .filter(Boolean)
            .slice(0, 20)
            .map(n => `${String(n!.namespace || '')}:${String(n!.key || '')}:${String(n!.ownerType || '')}`),
          body: gqlAllText.slice(0, 500),
        },
      },
    })
  } catch (err) {
    const message = (err as Error)?.message || 'Failed to load metafield debug'
    return json({ error: message }, { status: 500 })
  }
}
