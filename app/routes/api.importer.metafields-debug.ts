import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { getAdminClient } from '../services/shopifyAdmin.server'

// Alternate debug route to avoid potential collision with /api/importer/:slug dynamic route
// Path: /api/importer/metafields-debug
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

    // REST broad definitions
    const restBroadResp = await fetch(`${base}/metafield_definitions.json?limit=250`, { headers })
    const restBroadTxt = await restBroadResp.text()
    type RestList = { metafield_definitions?: Array<{ namespace?: string; key?: string }> }
    let restBroad: RestList | null = null
    try {
      restBroad = JSON.parse(restBroadTxt)
    } catch {
      /* ignore */
    }
    const restBroadDefs = Array.isArray(restBroad?.metafield_definitions) ? restBroad.metafield_definitions : []

    // REST product filtered definitions
    const restProdResp = await fetch(`${base}/metafield_definitions.json?owner_type=product&limit=250`, { headers })
    const restProdTxt = await restProdResp.text()
    let restProd: RestList | null = null
    try {
      restProd = JSON.parse(restProdTxt)
    } catch {
      /* ignore */
    }
    const restProdDefs = Array.isArray(restProd?.metafield_definitions) ? restProd.metafield_definitions : []

    // GraphQL namespace-specific query
    const gqlUrl = `${base}/graphql.json`
    const nsQuery = `query($ns: String!){ metafieldDefinitions(first: 60, ownerType: PRODUCT, namespace: $ns){ edges { node { id namespace key name ownerType } } } }`
    const gqlNsResp = await fetch(gqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: nsQuery, variables: { ns: 'rbp_spec' } }),
    })
    const gqlNsTxt = await gqlNsResp.text()
    type GqlEdges = {
      data?: { metafieldDefinitions?: { edges?: Array<{ node?: { namespace?: string; key?: string } | null }> } }
    }
    let gqlNs: GqlEdges | null = null
    try {
      gqlNs = JSON.parse(gqlNsTxt)
    } catch {
      /* ignore */
    }
    const gqlNsEdges = Array.isArray(gqlNs?.data?.metafieldDefinitions?.edges)
      ? gqlNs.data.metafieldDefinitions.edges
      : []

    // GraphQL all product definitions
    const allQuery = `query{ metafieldDefinitions(first: 100, ownerType: PRODUCT){ edges { node { id namespace key name ownerType } } } }`
    const gqlAllResp = await fetch(gqlUrl, { method: 'POST', headers, body: JSON.stringify({ query: allQuery }) })
    const gqlAllTxt = await gqlAllResp.text()
    let gqlAll: GqlEdges | null = null
    try {
      gqlAll = JSON.parse(gqlAllTxt)
    } catch {
      /* ignore */
    }
    const gqlAllEdges = Array.isArray(gqlAll?.data?.metafieldDefinitions?.edges)
      ? gqlAll.data.metafieldDefinitions.edges
      : []

    const summarize = (arr: Array<{ namespace?: string; key?: string }>) => ({
      count: arr.length,
      sample: arr.slice(0, 12).map(d => `${d.namespace}:${d.key}`),
    })

    return json({
      host: shopName,
      rest: {
        broad: { ok: restBroadResp.ok, status: restBroadResp.status, ...summarize(restBroadDefs) },
        product: { ok: restProdResp.ok, status: restProdResp.status, ...summarize(restProdDefs) },
      },
      gql: {
        namespace: {
          ok: gqlNsResp.ok,
          status: gqlNsResp.status,
          edges: gqlNsEdges.length,
          keys: (gqlNsEdges as Array<{ node?: { namespace?: string; key?: string } | null }>)
            .slice(0, 25)
            .map(
              (e: { node?: { namespace?: string; key?: string } | null }) => `${e?.node?.namespace}:${e?.node?.key}`,
            ),
        },
        allProduct: {
          ok: gqlAllResp.ok,
          status: gqlAllResp.status,
          edges: gqlAllEdges.length,
          keys: (gqlAllEdges as Array<{ node?: { namespace?: string; key?: string } | null }>)
            .slice(0, 25)
            .map(
              (e: { node?: { namespace?: string; key?: string } | null }) => `${e?.node?.namespace}:${e?.node?.key}`,
            ),
        },
      },
    })
  } catch (err) {
    const message = (err as Error)?.message || 'Failed metafields debug'
    return json({ error: message }, { status: 500 })
  }
}

export default function MetafieldsDebug() {
  return null
}
