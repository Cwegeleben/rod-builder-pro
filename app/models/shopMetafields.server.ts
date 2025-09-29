import { prisma } from '../db.server'

// Minimal Admin API type for our needs
type AdminApi = {
  graphql: (query: string, init?: { variables?: Record<string, unknown> }) => Promise<Response>
}

// Namespace/keys used for metafields
const NS = 'rbp'
const SHOP_TEMPLATES_KEY = 'product_spec_templates'
const PRODUCT_TEMPLATE_ID_KEY = 'product_spec_template_id'

// Shared types for payload
export type FieldOut = {
  id: string
  key: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'select'
  required: boolean
  position: number
  storage: 'CORE' | 'METAFIELD'
  mapping:
    | { coreFieldPath: string | null }
    | { metafield: { namespace: string | null; key: string | null; type: string | null } }
}
export type TemplateOut = { id: string; name: string; fields: FieldOut[] }

// Serialize all templates + fields as a compact JSON payload for storing on the Shop metafield
async function buildTemplatesPayload() {
  const templates = await prisma.specTemplate.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { fields: { orderBy: { position: 'asc' } } },
  })

  const payload: { version: '1'; updatedAt: string; templates: TemplateOut[] } = {
    version: '1',
    updatedAt: new Date().toISOString(),
    templates: templates.map(
      (t: {
        id: string
        name: string
        fields: Array<{
          id: string
          key: string
          label: string
          type: 'text' | 'number' | 'boolean' | 'select'
          required: boolean
          position: number
          storage: 'CORE' | 'METAFIELD'
          coreFieldPath?: string | null
          metafieldNamespace?: string | null
          metafieldKey?: string | null
          metafieldType?: string | null
        }>
      }) => ({
        id: t.id,
        name: t.name,
        fields: t.fields.map(f => ({
          id: f.id,
          key: f.key,
          label: f.label,
          type: f.type,
          required: Boolean(f.required),
          position: Number(f.position),
          storage: f.storage,
          mapping:
            f.storage === 'CORE'
              ? { coreFieldPath: f.coreFieldPath ?? null }
              : {
                  metafield: {
                    namespace: f.metafieldNamespace ?? null,
                    key: f.metafieldKey ?? null,
                    type: f.metafieldType ?? null,
                  },
                },
        })),
      }),
    ),
  }

  return payload
}

async function getShopId(admin: AdminApi): Promise<string> {
  const GQL = `#graphql
    query ShopId { shop { id } }
  `
  const resp = await admin.graphql(GQL)
  const data = (await resp.json()) as { data?: { shop?: { id: string } } }
  const id = data?.data?.shop?.id
  if (!id) throw new Error('Unable to resolve Shop ID from Admin API')
  return id
}

// Public: sync the shop-level metafield containing all templates as JSON
export async function syncTemplatesToShop(admin: AdminApi): Promise<void> {
  const ownerId = await getShopId(admin)
  const payload = await buildTemplatesPayload()
  const value = JSON.stringify(payload)

  // Optional safety: warn if we risk exceeding common metafield JSON size limits
  // Shopify JSON metafields are limited; if you outgrow this, consider chunking per-template keys.
  if (value.length > 60000) {
    console.warn(`Templates JSON is large (${value.length} chars). Consider chunking across multiple metafields.`)
  }

  const GQL = `#graphql
    mutation SetTemplates($ownerId: ID!, $namespace: String!, $key: String!, $type: String!, $value: String!) {
      metafieldsSet(metafields: [{ ownerId: $ownerId, namespace: $namespace, key: $key, type: $type, value: $value }]) {
        metafields { id key namespace type }
        userErrors { field message }
      }
    }
  `
  const resp = await admin.graphql(GQL, {
    variables: {
      ownerId,
      namespace: NS,
      key: SHOP_TEMPLATES_KEY,
      type: 'json',
      value,
    },
  })
  const data = (await resp.json()) as {
    data?: { metafieldsSet?: { userErrors?: Array<{ field?: string[]; message: string }> } }
  }
  const errs = data?.data?.metafieldsSet?.userErrors ?? []
  if (errs.length) throw new Error(`metafieldsSet failed: ${errs.map(e => e.message).join('; ')}`)
}

// Public: assign a template to a specific product via product metafield
export async function assignTemplateToProduct(admin: AdminApi, productId: string, templateId: string): Promise<void> {
  const GQL = `#graphql
    mutation SetProductTemplate($ownerId: ID!, $namespace: String!, $key: String!, $type: String!, $value: String!) {
      metafieldsSet(metafields: [{ ownerId: $ownerId, namespace: $namespace, key: $key, type: $type, value: $value }]) {
        metafields { id key namespace type }
        userErrors { field message }
      }
    }
  `
  const resp = await admin.graphql(GQL, {
    variables: {
      ownerId: productId, // product ID must be a GID (e.g., gid://shopify/Product/123456789)
      namespace: NS,
      key: PRODUCT_TEMPLATE_ID_KEY,
      type: 'single_line_text_field',
      value: templateId,
    },
  })
  const data = (await resp.json()) as {
    data?: { metafieldsSet?: { userErrors?: Array<{ field?: string[]; message: string }> } }
  }
  const errs = data?.data?.metafieldsSet?.userErrors ?? []
  if (errs.length) throw new Error(`metafieldsSet (product) failed: ${errs.map(e => e.message).join('; ')}`)
}

// Convenience: fetch the stored templates JSON metafield from the shop
export async function getTemplatesFromShop(
  admin: AdminApi,
): Promise<{ version: string; updatedAt: string; templates: TemplateOut[] } | null> {
  const GQL = `#graphql
    query GetTemplates($namespace: String!, $key: String!) {
      shop {
        metafield(namespace: $namespace, key: $key) {
          id
          type
          namespace
          key
          value
        }
      }
    }
  `
  const resp = await admin.graphql(GQL, {
    variables: { namespace: NS, key: SHOP_TEMPLATES_KEY },
  })
  const data = (await resp.json()) as { data?: { shop?: { metafield?: { value?: string | null } } } }
  const str = data?.data?.shop?.metafield?.value
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}
