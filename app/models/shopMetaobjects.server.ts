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

export async function upsertTemplatesToMetaobjects(
  admin: AdminApi,
  options?: { templateIds?: string[] },
): Promise<void> {
  // Ensure definition; get the set of defined field keys so we only send valid ones
  let definedKeys: Set<string>
  try {
    definedKeys = await ensureMetaobjectDefinition(admin)
  } catch (e: unknown) {
    let msg = ''
    if (typeof e === 'object' && e) {
      const maybe = e as { message?: unknown }
      if (typeof maybe.message === 'string') msg = maybe.message
    }
    if (/re-auth the shop/i.test(msg) || /access denied/i.test(msg)) throw e
    throw e
  }
  let templates = await buildTemplates()
  if (options?.templateIds && options.templateIds.length) {
    const set = new Set(options.templateIds)
    templates = templates.filter(t => set.has(t.id))
  }
  const nowIso = new Date().toISOString()
  for (const t of templates) {
    const desired = [
      { key: 'template_id', value: t.id },
      { key: 'name', value: t.name },
      { key: 'fields_json', value: JSON.stringify(t.fields) },
      { key: 'version', value: '1' },
      { key: 'updated_at', value: nowIso },
    ] as Array<{ key: string; value: string }>
    const fields = desired.filter(f => definedKeys.has(f.key))

    const existing = await getMetaobjectByHandle(admin, t.id)
    if (existing?.id) await updateMetaobject(admin, existing.id, fields)
    else await createMetaobject(admin, t.id, fields)
  }
}

async function ensureMetaobjectDefinition(admin: AdminApi): Promise<Set<string>> {
  // Check if a definition exists for our type; if not, create it with our fields
  const GET_DEF = `#graphql
    query GetDefinition($type: String!) {
      metaobjectDefinitionByType(type: $type) {
        name
        type
        fieldDefinitions { name key }
      }
    }
  `
  const getResp = await admin.graphql(GET_DEF, { variables: { type: TEMPLATE_TYPE } })
  if (!getResp.ok) throw new Error(`metaobjectDefinitionByType HTTP ${getResp.status}`)
  const defData = (await getResp.json()) as {
    data?: {
      metaobjectDefinitionByType?: { name: string; type: string; fieldDefinitions: Array<{ key: string }> } | null
    }
    errors?: Array<{ message: string }>
  }
  if (defData?.errors?.length) {
    const accessDenied = defData.errors.find(e => /access denied/i.test(e.message))
    if (accessDenied) {
      throw new Error(
        'Access denied retrieving metaobject definition. Re-auth the shop to grant read_metaobject_definitions & write_metaobject_definitions scopes, then retry Publish.',
      )
    }
    throw new Error(defData.errors.map(e => e.message).join('; '))
  }
  if (defData?.data?.metaobjectDefinitionByType) {
    return new Set(defData.data.metaobjectDefinitionByType.fieldDefinitions.map(f => f.key))
  }

  // Create definition with inline fieldDefinitions using field type enum
  const CREATE_DEF = `#graphql
    mutation CreateDefinition($type: String!, $name: String!) {
      metaobjectDefinitionCreate(
        definition: {
          type: $type,
          name: $name,
          fieldDefinitions: [
            { name: "Template ID", key: "template_id", type: "single_line_text_field" },
            { name: "Name", key: "name", type: "single_line_text_field" },
            { name: "Fields JSON", key: "fields_json", type: "multi_line_text_field" },
            { name: "Version", key: "version", type: "single_line_text_field" },
            { name: "Updated At", key: "updated_at", type: "single_line_text_field" }
          ]
        }
      ) {
        metaobjectDefinition { type }
        userErrors { message }
      }
    }
  `
  const createResp = await admin.graphql(CREATE_DEF, {
    variables: { type: TEMPLATE_TYPE, name: 'RBP Template' },
  })
  if (!createResp.ok) throw new Error(`metaobjectDefinitionCreate HTTP ${createResp.status}`)
  const createData = (await createResp.json()) as {
    data?: { metaobjectDefinitionCreate?: { userErrors?: Array<{ message: string }> } }
  }
  const errs = createData?.data?.metaobjectDefinitionCreate?.userErrors ?? []
  if (errs.length)
    throw new Error(
      `metaobjectDefinitionCreate failed: ${errs.map(e => e.message).join('; ')}. Ensure app has write_metaobject_definitions scope and shop has re-authed.`,
    )
  // Return the intended set since we just created them
  return new Set(['template_id', 'name', 'fields_json', 'version', 'updated_at'])
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
