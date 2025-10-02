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

// Prefer Metaobject storage when available; fallback to AppInstallation metafield.
// AppInstallation path requires no extra scopes; Metaobjects require read_metaobjects/write_metaobjects.

// -- Metaobject helpers -------------------------------------------------------
async function ensureTemplateMetaobjectDefinition(admin: AdminApi): Promise<string> {
  // Create or fetch a metaobject definition with type "rbp_product_spec_templates"
  const TYPE = 'rbp_product_spec_templates'
  // Try to look up by type
  const GET_DEF = `#graphql
    query GetDef($type: String!) {
      metaobjectDefinitionByType(type: $type) { id type name fieldDefinitions { key name type } }
    }
  `
  const getResp = await admin.graphql(GET_DEF, { variables: { type: TYPE } })
  if (!getResp.ok) throw new Error(`Get metaobject def HTTP ${getResp.status}`)
  const got = (await getResp.json()) as {
    data?: { metaobjectDefinitionByType?: { id: string } | null }
    errors?: Array<{ message: string }>
  }
  if (got?.errors?.length) throw new Error(got.errors.map(e => e.message).join('; '))
  const existingId = got?.data?.metaobjectDefinitionByType?.id
  if (existingId) return existingId

  // Create definition with a single text field 'payload' to hold JSON string
  const CREATE_DEF = `#graphql
    mutation CreateDef($type: String!, $name: String!) {
      metaobjectDefinitionCreate(
        definition: {
          type: $type
          name: $name
          fieldDefinitions: [
            { key: "payload", name: "Payload", type: single_line_text_field, required: true }
          ]
        }
      ) {
        metaobjectDefinition { id type }
        userErrors { field message }
      }
    }
  `
  const createResp = await admin.graphql(CREATE_DEF, { variables: { type: TYPE, name: 'RBP Product Spec Templates' } })
  if (!createResp.ok) throw new Error(`Create metaobject def HTTP ${createResp.status}`)
  const cjson = (await createResp.json()) as {
    data?: {
      metaobjectDefinitionCreate?: {
        metaobjectDefinition?: { id: string } | null
        userErrors?: Array<{ field?: string[]; message: string }>
      }
    }
    errors?: Array<{ message: string }>
  }
  if (cjson?.errors?.length) throw new Error(cjson.errors.map(e => e.message).join('; '))
  const errs = cjson?.data?.metaobjectDefinitionCreate?.userErrors ?? []
  if (errs.length) throw new Error(`metaobjectDefinitionCreate failed: ${errs.map(e => e.message).join('; ')}`)
  const id = cjson?.data?.metaobjectDefinitionCreate?.metaobjectDefinition?.id
  if (!id) throw new Error('No metaobject definition id returned')
  return id
}

async function upsertTemplatesMetaobject(admin: AdminApi, payloadJson: string): Promise<void> {
  const TYPE = 'rbp_product_spec_templates'
  await ensureTemplateMetaobjectDefinition(admin)
  const UPSERT = `#graphql
    mutation Upsert($type: String!, $handle: String!, $payload: String!) {
      metaobjectUpsert(
        handle: { type: $type, handle: $handle }
        metaobject: { type: $type, fields: [{ key: "payload", value: $payload }] }
      ) {
        metaobject { id handle type }
        userErrors { field message }
      }
    }
  `
  const resp = await admin.graphql(UPSERT, { variables: { type: TYPE, handle: 'templates', payload: payloadJson } })
  if (!resp.ok) throw new Error(`metaobjectUpsert HTTP ${resp.status}`)
  const data = (await resp.json()) as {
    data?: { metaobjectUpsert?: { userErrors?: Array<{ field?: string[]; message: string }> } }
    errors?: Array<{ message: string }>
  }
  if (data?.errors?.length) throw new Error(data.errors.map(e => e.message).join('; '))
  const errs = data?.data?.metaobjectUpsert?.userErrors ?? []
  if (errs.length) throw new Error(`metaobjectUpsert failed: ${errs.map(e => e.message).join('; ')}`)
}

async function getTemplatesFromMetaobject(admin: AdminApi): Promise<string | null> {
  const TYPE = 'rbp_product_spec_templates'
  const GET = `#graphql
    query ByHandle($type: String!, $handle: String!) {
      metaobjectByHandle(handle: { type: $type, handle: $handle }) {
        id
        fields { key value }
      }
    }
  `
  const resp = await admin.graphql(GET, { variables: { type: TYPE, handle: 'templates' } })
  if (!resp.ok) return null
  const data = (await resp.json()) as {
    data?: { metaobjectByHandle?: { fields?: Array<{ key: string; value: string | null }> | null } }
  }
  const fields = data?.data?.metaobjectByHandle?.fields || []
  const payload = fields.find(f => f.key === 'payload')?.value
  return payload ?? null
}

// -- AppInstallation metafield helpers ---------------------------------------
// Prefer AppInstallation metafield storage to avoid additional scopes.
async function getAppInstallationId(admin: AdminApi): Promise<string> {
  const GQL = `#graphql
    query AppInst { currentAppInstallation { id } }
  `
  const resp = await admin.graphql(GQL)
  if (!resp.ok) throw new Error(`currentAppInstallation HTTP ${resp.status}`)
  const data = (await resp.json()) as { data?: { currentAppInstallation?: { id: string } } }
  const id = data?.data?.currentAppInstallation?.id
  if (!id) throw new Error('Unable to resolve AppInstallation ID')
  return id
}

// Public: sync the shop-level metafield containing all templates as JSON
export async function syncTemplatesToShop(admin: AdminApi): Promise<void> {
  const payload = await buildTemplatesPayload()
  const value = JSON.stringify(payload)

  // Optional safety: warn if we risk exceeding common metafield JSON size limits
  // Shopify JSON metafields are limited; if you outgrow this, consider chunking per-template keys.
  if (value.length > 60000) {
    console.warn(`Templates JSON is large (${value.length} chars). Consider chunking across multiple metafields.`)
  }
  // Try metaobject first
  try {
    await upsertTemplatesMetaobject(admin, value)
    return
  } catch (e) {
    console.warn('Metaobject upsert failed, falling back to AppInstallation metafield:', e)
  }

  // Fallback: store under the AppInstallation metafield. No special metafield scopes required.
  const ownerId = await getAppInstallationId(admin)
  const GQL = `#graphql
    mutation SetTemplates($ownerId: ID!, $namespace: String!, $key: String!, $type: String!, $value: String!) {
      metafieldsSet(metafields: [{ ownerId: $ownerId, namespace: $namespace, key: $key, type: $type, value: $value }]) {
        metafields { id key namespace type }
        userErrors { field message }
      }
    }
  `
  const resp = await admin.graphql(GQL, {
    variables: { ownerId, namespace: NS, key: SHOP_TEMPLATES_KEY, type: 'json', value },
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`metafieldsSet HTTP ${resp.status}: ${text}`)
  }
  const data = (await resp.json()) as {
    data?: { metafieldsSet?: { userErrors?: Array<{ field?: string[]; message: string }> } }
    errors?: Array<{ message: string }>
  }
  if (data?.errors?.length) throw new Error(`metafieldsSet GQL error: ${data.errors.map(e => e.message).join('; ')}`)
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
  // Try metaobject first
  const metaobjectStr = await getTemplatesFromMetaobject(admin)
  const str =
    metaobjectStr ??
    (await (async () => {
      const GQL = `#graphql
      query GetTemplates($namespace: String!, $key: String!) {
        currentAppInstallation {
          metafield(namespace: $namespace, key: $key) { value }
        }
      }
    `
      const resp = await admin.graphql(GQL, { variables: { namespace: NS, key: SHOP_TEMPLATES_KEY } })
      const data = (await resp.json()) as {
        data?: { currentAppInstallation?: { metafield?: { value?: string | null } } }
      }
      return data?.data?.currentAppInstallation?.metafield?.value ?? null
    })())
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}
