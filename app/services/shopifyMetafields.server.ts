// Batson Rod Blanks metafield definition helpers
import Shopify from 'shopify-api-node'

const SPEC_NS = 'rbp_spec'

export const BATSON_ROD_BLANK_KEYS: string[] = [
  'series',
  'length_in',
  'pieces',
  'color',
  'action',
  'power',
  'material',
  'line_lb',
  'lure_oz',
  'weight_oz',
  'butt_dia_in',
  'ten_in_dia',
  'twenty_in_dia',
  'thirty_in_dia',
  'tip_top_size',
  'applications',
]

export type MetafieldDefStatus = {
  namespace: string
  key: string
  present: boolean
  id?: number
}

export type BatsonDefsReport = {
  total: number
  missing: string[]
  present: string[]
  statuses: MetafieldDefStatus[]
}

function mkClient(shopName: string, accessToken: string, apiVersion?: string) {
  // Prefer a recent stable API version for metafield definitions
  return new Shopify({ shopName, accessToken, apiVersion: apiVersion || '2025-01' })
}

// NOTE: shopify-api-node does not expose metafield definition helpers directly.
// We fall back to raw REST calls using the private client internals.
// Types kept narrow to what we consume.
export type RawMetafieldDefinition = {
  id: number
  name: string
  key: string
  namespace: string
  type: string
  ownerType: string
}

type ShopifyRawClient = ReturnType<typeof mkClient> & { options?: { apiVersion?: string } }

function apiBase(shopName: string, apiVersion?: string) {
  // Align REST base version with the client default to avoid capability mismatches
  const v = apiVersion || '2025-01'
  return `https://${shopName}/admin/api/${v}`
}

export async function listProductMetafieldDefinitions(
  shopName: string,
  accessToken: string,
): Promise<RawMetafieldDefinition[]> {
  const client = mkClient(shopName, accessToken) as ShopifyRawClient
  // Try broad fetch first (no owner_type filter) to avoid API version quirks; then fallback
  const base = `${apiBase(shopName, client.options?.apiVersion)}/metafield_definitions.json`
  try {
    const res = await fetch(`${base}?limit=250`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { metafield_definitions?: RawMetafieldDefinition[] }
    let list = Array.isArray(data?.metafield_definitions) ? data.metafield_definitions : []
    // If empty, retry with owner_type=product explicitly
    if (!list.length) {
      const res2 = await fetch(`${base}?owner_type=product&limit=250`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })
      if (res2.ok) {
        const data2 = (await res2.json()) as { metafield_definitions?: RawMetafieldDefinition[] }
        list = Array.isArray(data2?.metafield_definitions) ? data2.metafield_definitions : []
      }
    }
    // GraphQL fallback for API versions that under-report definitions via REST
    if (!list.length) {
      try {
        const gqlUrl = `${apiBase(shopName, client.options?.apiVersion)}/graphql.json`
        const query = `query defs($ns: String!) { metafieldDefinitions(first: 100, ownerType: PRODUCT, namespace: $ns) { edges { node { id name key namespace ownerType } } } }`
        const gqlResp = await fetch(gqlUrl, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query, variables: { ns: 'rbp_spec' } }),
        })
        if (gqlResp.ok) {
          const body = (await gqlResp.json()) as {
            data?: {
              metafieldDefinitions?: { edges?: Array<{ node?: Partial<RawMetafieldDefinition> | null | undefined }> }
            }
          }
          const edges = body?.data?.metafieldDefinitions?.edges || []
          const toStr = (v: unknown): string => (v == null ? '' : String(v))
          const toNum = (v: unknown): number => {
            if (typeof v === 'number' && Number.isFinite(v)) return v
            const n = Number(v as string)
            return Number.isFinite(n) ? n : 0
          }
          const nodes = edges
            .map(e => e.node)
            .filter((n): n is Partial<RawMetafieldDefinition> => !!n)
            .map(n => {
              const node = n as {
                id?: number | string
                name?: unknown
                key?: unknown
                namespace?: unknown
                type?: unknown
                ownerType?: unknown
              }
              return {
                id: toNum(node.id),
                name: toStr(node.name),
                key: toStr(node.key),
                namespace: toStr(node.namespace),
                type: toStr(node.type),
                ownerType: toStr(node.ownerType),
              } as RawMetafieldDefinition
            })
          if (nodes.length) list = nodes
        }
      } catch {
        /* ignore gql fallback errors */
      }
    }
    // Filter to product-only just in case
    return list.filter(d => String(d?.ownerType || '').toLowerCase() === 'product')
  } catch {
    return []
  }
}

export async function getBatsonDefinitionReport(shopName: string, accessToken: string): Promise<BatsonDefsReport> {
  const defs = await listProductMetafieldDefinitions(shopName, accessToken)
  const statuses: MetafieldDefStatus[] = []
  for (const key of BATSON_ROD_BLANK_KEYS) {
    const found = defs.find(d => d?.namespace === SPEC_NS && d?.key === key)
    statuses.push({ namespace: SPEC_NS, key, present: !!found, id: found?.id ? Number(found.id) : undefined })
  }
  const missing = statuses.filter(s => !s.present).map(s => s.key)
  const present = statuses.filter(s => s.present).map(s => s.key)
  return { total: BATSON_ROD_BLANK_KEYS.length, missing, present, statuses }
}

function humanizeKey(key: string): string {
  return key
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export async function createBatsonDefinitions(shopName: string, accessToken: string, onlyMissing = true) {
  const client = mkClient(shopName, accessToken) as ShopifyRawClient
  const report = await getBatsonDefinitionReport(shopName, accessToken)
  const toCreate = onlyMissing ? report.missing : BATSON_ROD_BLANK_KEYS
  const created: string[] = []
  const errors: Record<string, string> = {}
  const url = `${apiBase(shopName, client.options?.apiVersion)}/metafield_definitions.json`
  // Normalize: definitions as single_line_text_field for consistent write pipeline
  const typeForKey = (): string => 'single_line_text_field'
  for (const key of toCreate) {
    try {
      const payload = {
        metafield_definition: {
          name: humanizeKey(key),
          namespace: SPEC_NS,
          key,
          type: typeForKey(),
          description: 'Imported Batson Rod Blank specification',
          // Owner scoping; use owner_type only (owner_resource is no longer accepted on newer API versions)
          owner_type: 'product',
        },
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        // Read body ONCE (text), attempt JSON parse for message
        const bodyText = await res.text().catch(() => '')
        let msg = bodyText
        // GraphQL fallback for creation when REST returns 406 or other validation errors
        const shouldGraphQL = res.status === 406 || /Not Acceptable/i.test(res.statusText)
        if (shouldGraphQL) {
          try {
            const gqlUrl = `${apiBase(shopName, client.options?.apiVersion)}/graphql.json`
            // GraphQL mutation: metafieldDefinitionCreate with proper selection set for type
            const mutation = `mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {\n  metafieldDefinitionCreate(definition: $definition) {\n    createdDefinition { id key namespace name ownerType type { name valueType } }\n    userErrors { field message code }\n  }\n}`
            const gqlResp = await fetch(gqlUrl, {
              method: 'POST',
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                query: mutation,
                variables: {
                  definition: {
                    name: humanizeKey(key),
                    namespace: SPEC_NS,
                    key,
                    type: typeForKey(),
                    ownerType: 'PRODUCT',
                    description: 'Imported Batson Rod Blank specification',
                  },
                },
              }),
            })
            const gqlText = await gqlResp.text()
            type GqlCreateResp = {
              data?: {
                metafieldDefinitionCreate?: {
                  createdDefinition?: {
                    id?: string
                    key?: string
                    namespace?: string
                    name?: string
                    ownerType?: string
                    type?: { name?: string; valueType?: string } | null
                  } | null
                  userErrors?: Array<{ field?: string[]; message?: string; code?: string }>
                }
              }
            }
            type GqlStd = GqlCreateResp & { errors?: Array<{ message?: string }> }
            let gqlJson: GqlStd | null = null
            try {
              gqlJson = JSON.parse(gqlText) as GqlStd
            } catch {
              /* ignore */
            }
            const userErrors: Array<{ message?: string; code?: string }> =
              gqlJson?.data?.metafieldDefinitionCreate?.userErrors || []
            const createdDef = gqlJson?.data?.metafieldDefinitionCreate?.createdDefinition
            if (createdDef && !userErrors.length) {
              created.push(key)
              console.warn('[metafields/create] GraphQL fallback success', { key })
              continue
            }
            if (userErrors.length) {
              const errMsg = userErrors.map(e => e.message || e.code || 'error').join(', ')
              console.warn('[metafields/create] GraphQL userErrors', { key, errMsg })
              errors[key] = `REST 406 + GraphQL errors: ${errMsg}`
              continue
            }
            const topErr = (gqlJson?.errors || []).map(e => e.message || 'error').join(', ')
            console.warn('[metafields/create] GraphQL fallback failed', {
              key,
              status: gqlResp.status,
              body: gqlText.slice(0, 240),
              topErr,
            })
            errors[key] = `REST 406 + GraphQL fallback failed (${gqlResp.status})${topErr ? `: ${topErr}` : ''}`
            continue
          } catch (gqlErr) {
            errors[key] = `REST 406 + GraphQL exception: ${(gqlErr as Error).message}`
            continue
          }
        }
        try {
          const asJson = JSON.parse(bodyText) as unknown
          if (asJson && typeof asJson === 'object' && 'errors' in (asJson as Record<string, unknown>)) {
            msg = JSON.stringify((asJson as { errors?: unknown }).errors)
          }
        } catch {
          /* not json */
        }
        const combined = `${res.status} ${res.statusText}${msg ? `: ${msg}` : ''}`
        // Temporary verbose logging to help diagnose 406/validation errors
        try {
          console.warn('[metafields/create] failed', { key, status: res.status, statusText: res.statusText, msg })
        } catch {
          /* ignore */
        }
        // Treat duplicate/exists as success-idempotent
        if (/already\s+been\s+taken|exists|taken/i.test(combined)) {
          created.push(key)
          continue
        }
        throw new Error(combined)
      }
      created.push(key)
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message) : String(e)
      errors[key] = msg
    }
  }
  return { created, errors }
}
