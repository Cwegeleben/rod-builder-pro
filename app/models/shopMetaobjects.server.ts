import { prisma } from '../db.server'

// Minimal Admin API type for our needs
type AdminApi = {
  graphql: (query: string, init?: { variables?: Record<string, unknown> }) => Promise<Response>
}

const TEMPLATE_TYPE = 'rbp_template'

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

async function buildTemplates(): Promise<TemplateOut[]> {
  const templates = await prisma.specTemplate.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { fields: { orderBy: { position: 'asc' } } },
  })

  return templates.map(
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
  )
}

// Helpers
async function getMetaobjectByHandle(admin: AdminApi, handle: string): Promise<{ id: string } | null> {
  const GQL = `#graphql
    query GetByHandle($type: String!, $handle: String!) {
      metaobjectByHandle(handle: { type: $type, handle: $handle }) {
        id
        handle
      }
    }
  `
  const resp = await admin.graphql(GQL, { variables: { type: TEMPLATE_TYPE, handle } })
  if (!resp.ok) throw new Error(`metaobjectByHandle HTTP ${resp.status}`)
  const data = (await resp.json()) as {
    data?: { metaobjectByHandle?: { id: string } | null }
    errors?: Array<{ message: string }>
  }
  if (data?.errors?.length) throw new Error(data.errors.map(e => e.message).join('; '))
  return data?.data?.metaobjectByHandle ?? null
}

async function createMetaobject(admin: AdminApi, handle: string, fields: Array<{ key: string; value: string }>) {
  const GQL = `#graphql
    mutation Create($type: String!, $handle: String!, $fields: [MetaobjectFieldInput!]!) {
      metaobjectCreate(metaobject: { type: $type, handle: $handle, fields: $fields }) {
        metaobject { id handle }
        userErrors { field message }
      }
    }
  `
  const resp = await admin.graphql(GQL, {
    variables: { type: TEMPLATE_TYPE, handle, fields },
  })
  if (!resp.ok) throw new Error(`metaobjectCreate HTTP ${resp.status}`)
  const data = (await resp.json()) as {
    data?: { metaobjectCreate?: { metaobject?: { id: string } | null; userErrors?: Array<{ message: string }> } }
  }
  const errs = data?.data?.metaobjectCreate?.userErrors ?? []
  if (errs.length) throw new Error(`metaobjectCreate failed: ${errs.map(e => e.message).join('; ')}`)
  return data?.data?.metaobjectCreate?.metaobject?.id as string
}

async function updateMetaobject(admin: AdminApi, id: string, fields: Array<{ key: string; value: string }>) {
  const GQL = `#graphql
    mutation Update($id: ID!, $fields: [MetaobjectFieldInput!]!) {
      metaobjectUpdate(id: $id, metaobject: { fields: $fields }) {
        metaobject { id }
        userErrors { field message }
      }
    }
  `
  const resp = await admin.graphql(GQL, { variables: { id, fields } })
  if (!resp.ok) throw new Error(`metaobjectUpdate HTTP ${resp.status}`)
  const data = (await resp.json()) as {
    data?: { metaobjectUpdate?: { metaobject?: { id: string } | null; userErrors?: Array<{ message: string }> } }
  }
  const errs = data?.data?.metaobjectUpdate?.userErrors ?? []
  if (errs.length) throw new Error(`metaobjectUpdate failed: ${errs.map(e => e.message).join('; ')}`)
  return data?.data?.metaobjectUpdate?.metaobject?.id as string
}

export async function upsertTemplatesToMetaobjects(admin: AdminApi): Promise<void> {
  const templates = await buildTemplates()
  const nowIso = new Date().toISOString()
  for (const t of templates) {
    const fields = [
      { key: 'template_id', value: t.id },
      { key: 'name', value: t.name },
      { key: 'fields_json', value: JSON.stringify(t.fields) },
      { key: 'version', value: '1' },
      { key: 'updated_at', value: nowIso },
    ]

    const existing = await getMetaobjectByHandle(admin, t.id)
    if (existing?.id) await updateMetaobject(admin, existing.id, fields)
    else await createMetaobject(admin, t.id, fields)
  }
}

export async function assignTemplateRefToProduct(
  admin: AdminApi,
  productId: string,
  templateId: string,
): Promise<void> {
  const existing = await getMetaobjectByHandle(admin, templateId)
  if (!existing?.id) throw new Error(`Template metaobject not found for handle ${templateId}`)

  const GQL = `#graphql
    mutation SetProductTemplateRef($ownerId: ID!, $namespace: String!, $key: String!, $type: String!, $value: String!) {
      metafieldsSet(metafields: [{ ownerId: $ownerId, namespace: $namespace, key: $key, type: $type, value: $value }]) {
        metafields { id key namespace type }
        userErrors { field message }
      }
    }
  `
  const resp = await admin.graphql(GQL, {
    variables: {
      ownerId: productId,
      namespace: 'rbp',
      key: 'product_spec_template',
      type: 'metaobject_reference',
      value: existing.id,
    },
  })
  if (!resp.ok) throw new Error(`metafieldsSet (product metaobject ref) HTTP ${resp.status}`)
  const data = (await resp.json()) as {
    data?: { metafieldsSet?: { userErrors?: Array<{ message: string }> } }
  }
  const errs = data?.data?.metafieldsSet?.userErrors ?? []
  if (errs.length)
    throw new Error(`metafieldsSet (product metaobject ref) failed: ${errs.map(e => e.message).join('; ')}`)
}
