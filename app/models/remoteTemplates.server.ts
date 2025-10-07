import { prisma } from '../db.server'

// Feature flag helper
export function isRemoteHybridEnabled() {
  const val = (process.env.VITE_REMOTE_TEMPLATES || '').toLowerCase().trim()
  return val === '1' || val === 'true' || val === 'yes'
}

type AdminApi = { graphql: (query: string, init?: { variables?: Record<string, unknown> }) => Promise<Response> }
const TEMPLATE_TYPE = 'rbp_template'

export type RemoteField = {
  id: string
  key: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'select'
  required: boolean
  position: number
  storage: 'CORE' | 'METAFIELD'
  coreFieldPath?: string | null
  metafield?: { namespace?: string | null; key?: string | null; type?: string | null }
}

export type RemoteTemplate = {
  id: string
  name: string
  version?: number
  fields: RemoteField[]
}

interface GetDefResponse {
  data?: { metaobjectDefinitionByType?: { fieldDefinitions: Array<{ key: string }> } | null }
  errors?: Array<{ message: string }>
}
interface CreateDefResponse {
  data?: { metaobjectDefinitionCreate?: { userErrors?: Array<{ message: string }> } }
}
async function ensureDefinition(admin: AdminApi) {
  const q = `#graphql\n    query GetDefinition($type:String!){ metaobjectDefinitionByType(type:$type){ fieldDefinitions{ key } } }\n  `
  const r = await admin.graphql(q, { variables: { type: TEMPLATE_TYPE } })
  if (!r.ok) throw new Error(`Get definition HTTP ${r.status}`)
  const j = (await r.json()) as GetDefResponse
  if (j?.data?.metaobjectDefinitionByType) return
  const create = `#graphql\n      mutation CreateDef($type:String!){ metaobjectDefinitionCreate(definition:{ type:$type, name:"RBP Template", fieldDefinitions:[ {name:"Template ID", key:"template_id", type:"single_line_text_field"},{name:"Name", key:"name", type:"single_line_text_field"},{name:"Fields JSON", key:"fields_json", type:"multi_line_text_field"},{name:"Version", key:"version", type:"single_line_text_field"},{name:"Updated At", key:"updated_at", type:"single_line_text_field"}]}){ userErrors{ message } } }\n    `
  const c = await admin.graphql(create, { variables: { type: TEMPLATE_TYPE } })
  if (!c.ok) throw new Error(`Create definition HTTP ${c.status}`)
  const cj = (await c.json()) as CreateDefResponse
  const errs = cj?.data?.metaobjectDefinitionCreate?.userErrors || []
  if (errs.length) throw new Error(errs.map(e => e.message).join('; '))
}

export async function listPublishedRemoteTemplates(admin: AdminApi): Promise<RemoteTemplate[]> {
  await ensureDefinition(admin)
  const GQL = `#graphql\n    query List($type:String!, $first:Int!, $after:String){ metaobjects(type:$type, first:$first, after:$after){ edges{ cursor node{ handle updatedAt nameField: field(key:"name"){ value } fieldsJsonField: field(key:"fields_json"){ value } versionField: field(key:"version"){ value } } } pageInfo{ hasNextPage endCursor } } }\n  `
  const templates: RemoteTemplate[] = []
  let after: string | null = null
  for (;;) {
    const resp = await admin.graphql(GQL, { variables: { type: TEMPLATE_TYPE, first: 50, after } })
    if (!resp.ok) throw new Error(`List metaobjects HTTP ${resp.status}`)
    type EdgeNode = {
      handle: string
      updatedAt: string
      nameField?: { value?: string | null }
      fieldsJsonField?: { value?: string | null }
      versionField?: { value?: string | null }
    }
    interface ListResp {
      data?: {
        metaobjects?: {
          edges: Array<{ node: EdgeNode }>
          pageInfo: { hasNextPage: boolean; endCursor?: string | null }
        }
      }
    }
    const data = (await resp.json()) as ListResp
    const edges = data?.data?.metaobjects?.edges || []
    for (const { node } of edges) {
      let parsed: RemoteField[] = []
      const raw = node.fieldsJsonField?.value
      if (raw) {
        try {
          const arr = JSON.parse(raw)
          if (Array.isArray(arr)) {
            interface RawField {
              id?: unknown
              key?: unknown
              label?: unknown
              type?: unknown
              required?: unknown
              position?: unknown
              storage?: unknown
              coreFieldPath?: unknown
              metafield?: { namespace?: unknown; key?: unknown; type?: unknown }
            }
            parsed = (arr as RawField[]).map(f => {
              const key = String(f.key || '')
              const storage: 'CORE' | 'METAFIELD' = f.storage === 'METAFIELD' ? 'METAFIELD' : 'CORE'
              const allowedTypes: RemoteField['type'][] = ['text', 'number', 'boolean', 'select']
              const rawType = typeof f.type === 'string' ? f.type : ''
              const type: RemoteField['type'] = (allowedTypes as string[]).includes(rawType)
                ? (rawType as RemoteField['type'])
                : 'text'
              const metafield =
                storage === 'METAFIELD'
                  ? {
                      namespace: f.metafield?.namespace ? String(f.metafield.namespace) : null,
                      key: f.metafield?.key ? String(f.metafield.key) : null,
                      type: f.metafield?.type ? String(f.metafield.type) : null,
                    }
                  : undefined
              return {
                id: String(f.id || key),
                key,
                label: f.label ? String(f.label) : key,
                type,
                required: Boolean(f.required),
                position: typeof f.position === 'number' ? (f.position as number) : 0,
                storage,
                coreFieldPath: f.coreFieldPath ? String(f.coreFieldPath) : null,
                metafield,
              }
            })
          }
        } catch {
          // ignore JSON parse errors
        }
      }
      templates.push({
        id: node.handle,
        name: node.nameField?.value || node.handle,
        version: node.versionField?.value ? parseInt(node.versionField.value, 10) : undefined,
        fields: parsed,
      })
    }
    const pageInfo = data?.data?.metaobjects?.pageInfo
    if (pageInfo?.hasNextPage && pageInfo?.endCursor) after = pageInfo.endCursor
    else break
  }
  return templates
}

export async function createOrUpdateRemoteFromLocalDraft(admin: AdminApi, templateId: string) {
  // Load local template + fields
  const tpl = await prisma.specTemplate.findUnique({
    where: { id: templateId },
    include: { fields: { orderBy: { position: 'asc' } } },
  })
  if (!tpl) throw new Error('Template not found')
  const fields = tpl.fields.map(f => ({
    id: f.id,
    key: f.key,
    label: f.label,
    type: f.type as 'text' | 'number' | 'boolean' | 'select',
    required: f.required,
    position: f.position,
    storage: f.storage as 'CORE' | 'METAFIELD',
    coreFieldPath: f.coreFieldPath,
    metafield:
      f.storage === 'METAFIELD'
        ? { namespace: f.metafieldNamespace, key: f.metafieldKey, type: f.metafieldType }
        : undefined,
  }))
  const nowIso = new Date().toISOString()
  // Check existing
  const GET = `#graphql\n    query Get($type:String!, $handle:String!){ metaobjectByHandle(handle:{type:$type, handle:$handle}){ id } }\n  `
  const getResp = await admin.graphql(GET, { variables: { type: TEMPLATE_TYPE, handle: templateId } })
  if (!getResp.ok) throw new Error(`Get metaobject HTTP ${getResp.status}`)
  const getJson = (await getResp.json()) as { data?: { metaobjectByHandle?: { id: string } | null } }
  const existingId = getJson?.data?.metaobjectByHandle?.id
  const desiredFields = [
    { key: 'template_id', value: templateId },
    { key: 'name', value: tpl.name },
    { key: 'fields_json', value: JSON.stringify(fields) },
    { key: 'version', value: '1' },
    { key: 'updated_at', value: nowIso },
  ]
  if (existingId) {
    const MUT = `#graphql\n      mutation Update($id:ID!,$fields:[MetaobjectFieldInput!]!){ metaobjectUpdate(id:$id, metaobject:{fields:$fields}){ metaobject{ id } userErrors{ message } } }\n    `
    const u = await admin.graphql(MUT, { variables: { id: existingId, fields: desiredFields } })
    if (!u.ok) throw new Error(`metaobjectUpdate HTTP ${u.status}`)
    interface UpdateResp {
      data?: { metaobjectUpdate?: { userErrors?: Array<{ message: string }> } }
    }
    const uj = (await u.json()) as UpdateResp
    const errs = uj?.data?.metaobjectUpdate?.userErrors || []
    if (errs.length) throw new Error(errs.map(e => e.message).join('; '))
    return existingId
  } else {
    const CREATE = `#graphql\n      mutation Create($type:String!,$handle:String!,$fields:[MetaobjectFieldInput!]!){ metaobjectCreate(metaobject:{type:$type, handle:$handle, fields:$fields}){ metaobject{ id } userErrors{ message } } }\n    `
    const c = await admin.graphql(CREATE, {
      variables: { type: TEMPLATE_TYPE, handle: templateId, fields: desiredFields },
    })
    if (!c.ok) throw new Error(`metaobjectCreate HTTP ${c.status}`)
    interface CreateResp {
      data?: { metaobjectCreate?: { metaobject?: { id: string }; userErrors?: Array<{ message: string }> } }
    }
    const cj = (await c.json()) as CreateResp
    const errs = cj?.data?.metaobjectCreate?.userErrors || []
    if (errs.length) throw new Error(errs.map(e => e.message).join('; '))
    return cj?.data?.metaobjectCreate?.metaobject?.id as string
  }
}

// Import a remote published template as a new local draft (Phase 2)
// Creates a new specTemplate row with remoteTemplateId + remoteVersion populated.
// If a draft already exists for the given remote handle (remoteTemplateId), returns existing draft id.
export async function importRemoteTemplateAsDraft(admin: AdminApi, remoteHandle: string) {
  const existing = await prisma.$queryRaw<
    { id: string }[]
  >`SELECT id FROM SpecTemplate WHERE remoteTemplateId = ${remoteHandle} LIMIT 1`
  if (existing.length) return existing[0].id
  const Q = `#graphql\n    query Get($type:String!,$handle:String!){\n      metaobjectByHandle(handle:{type:$type, handle:$handle}){\n        handle updatedAt\n        nameField: field(key:"name"){ value }\n        fieldsJsonField: field(key:"fields_json"){ value }\n        versionField: field(key:"version"){ value }\n      }\n    }\n  `
  const resp = await admin.graphql(Q, { variables: { type: TEMPLATE_TYPE, handle: remoteHandle } })
  if (!resp.ok) throw new Error(`Get remote template HTTP ${resp.status}`)
  interface RemoteGetResp {
    data?: {
      metaobjectByHandle?: {
        handle: string
        nameField?: { value?: string | null }
        fieldsJsonField?: { value?: string | null }
        versionField?: { value?: string | null }
      }
    }
  }
  const json = (await resp.json()) as RemoteGetResp
  const mo = json?.data?.metaobjectByHandle
  if (!mo) throw new Error('Remote template not found')
  const name = mo.nameField?.value || remoteHandle
  const rawFields = mo.fieldsJsonField?.value
  let parsed: Array<{
    id?: string
    key?: string
    label?: string
    type?: string
    required?: boolean
    position?: number
    storage?: string
    coreFieldPath?: string | null
    metafield?: { namespace?: string | null; key?: string | null; type?: string | null }
  }> = []
  if (rawFields) {
    try {
      const arr = JSON.parse(rawFields)
      if (Array.isArray(arr)) parsed = arr
    } catch {
      /* ignore */
    }
  }
  const draftId = crypto.randomUUID()
  const versionNum = mo.versionField?.value ? parseInt(mo.versionField.value, 10) : 1
  await prisma.$executeRawUnsafe(
    'INSERT INTO SpecTemplate (id, name, createdAt, updatedAt, remoteTemplateId, remoteVersion) VALUES (?,?,?,?,?,?)',
    draftId,
    name + ' (edit)',
    new Date().toISOString(),
    new Date().toISOString(),
    remoteHandle,
    versionNum,
  )
  for (const f of parsed.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
    try {
      await prisma.specField.create({
        data: {
          templateId: draftId,
          key: f.key || f.id || 'field_' + Math.random().toString(36).slice(2, 8),
          label: f.label || f.key || 'Field',
          type: ((): 'text' | 'number' | 'boolean' | 'select' => {
            const vt = f.type
            return vt === 'text' || vt === 'number' || vt === 'boolean' || vt === 'select' ? vt : 'text'
          })(),
          required: Boolean(f.required),
          position: typeof f.position === 'number' ? f.position : 0,
          storage: f.storage === 'METAFIELD' ? 'METAFIELD' : 'CORE',
          coreFieldPath: f.coreFieldPath || null,
          metafieldNamespace: f.metafield?.namespace || null,
          metafieldKey: f.metafield?.key || null,
          metafieldType: f.metafield?.type || null,
        },
      })
    } catch {
      /* skip field errors */
    }
  }
  return draftId
}
