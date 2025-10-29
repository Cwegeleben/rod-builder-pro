import type { ActionFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { requireHqShopOr404 } from '../lib/access.server'
// import { syncTemplatesToShop } from '../models/shopMetafields.server'
import { upsertTemplatesToMetaobjects } from '../models/shopMetaobjects.server'
import { snapshotTemplate } from '../models/templateVersion.server'
import { createTemplate, deleteTemplates, renameTemplate } from '../models/specTemplate.server'
import { prisma } from '../db.server'
import { addField, updateField, deleteField, reorderField, isCoreFieldRecord } from '../models/specField.server'
import {
  CORE_SPEC_FIELD_DEFS,
  buildCoreFieldDefsForTemplate,
  slugifyTemplateName,
} from '../models/specTemplateCoreFields'
import {
  isRemoteHybridEnabled,
  createOrUpdateRemoteFromLocalDraft,
  importRemoteTemplateAsDraft,
} from '../models/remoteTemplates.server'

// SENTINEL: products-workspace-v3-0 (Resource route for mutations)
// BEGIN products-workspace-v3-0
export const action = async ({ request }: ActionFunctionArgs) => {
  await requireHqShopOr404(request)
  try {
    const { admin } = await authenticate.admin(request)
    const form = await request.formData()
    const actionType = String(form.get('_action') || '')

    // <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 -->
    // Minimal helpers (scope-safe) for metaobject definition and update without exporting internals
    async function getDefinitionKeys(): Promise<Set<string>> {
      const q = `#graphql
        query GetDefinition($type: String!) {
          metaobjectDefinitionByType(type: $type) {
            fieldDefinitions { key }
          }
        }
      `
      try {
        const resp = await admin.graphql(q, { variables: { type: 'rbp_template' } })
        if (!resp.ok) return new Set()
        const jr = (await resp.json()) as {
          data?: { metaobjectDefinitionByType?: { fieldDefinitions?: Array<{ key: string }> } | null }
        }
        const defs = jr?.data?.metaobjectDefinitionByType?.fieldDefinitions || []
        return new Set(defs.map(d => d.key))
      } catch {
        return new Set()
      }
    }
    async function setMetaobjectFields(moId: string, fields: Array<{ key: string; value: string }>): Promise<void> {
      const mut = `#graphql
        mutation Update($id: ID!, $fields: [MetaobjectFieldInput!]!) {
          metaobjectUpdate(id: $id, metaobject: { fields: $fields }) {
            metaobject { id }
            userErrors { message }
          }
        }
      `
      const r = await admin.graphql(mut, { variables: { id: moId, fields } })
      if (!r.ok) throw new Error(`metaobjectUpdate ${r.status}`)
      const jr = (await r.json()) as { data?: { metaobjectUpdate?: { userErrors?: Array<{ message: string }> } } }
      const errs = jr?.data?.metaobjectUpdate?.userErrors || []
      if (errs.length) throw new Error(errs.map(e => e.message).join('; '))
    }
    // <!-- END RBP GENERATED: importer-templates-orphans-v1 -->

    switch (actionType) {
      case 'publishTemplates': {
        const templateId = form.get('templateId') ? String(form.get('templateId')) : undefined
        await upsertTemplatesToMetaobjects(admin, templateId ? { templateIds: [templateId] } : undefined)
        if (templateId) {
          try {
            await snapshotTemplate(templateId)
          } catch (e) {
            console.error('snapshotTemplate failed', e)
          }
        } else {
          // Snapshot all templates sequentially; errors ignored per-template
          const ids = await prisma.specTemplate.findMany({ select: { id: true } })
          for (const { id } of ids) {
            try {
              await snapshotTemplate(id)
            } catch (e) {
              console.error('snapshotTemplate failed (bulk)', id, e)
            }
          }
        }
        return json({ ok: true, published: templateId || 'all' })
      }
      case 'deleteOrphanTemplate': {
        const orphanId = String(form.get('id'))
        // Look up the metaobject id via handle, then delete by id
        const lookup = `#graphql
          query GetForDelete($handle:String!){
            metaobjectByHandle(handle:{type:"rbp_template", handle:$handle}){ id }
          }
        `
        const lresp = await admin.graphql(lookup, { variables: { handle: orphanId } })
        if (!lresp.ok) return json({ ok: false, error: `Lookup failed (${lresp.status})` }, { status: 500 })
        const ljson = await lresp.json()
        const remoteId: string | undefined = ljson?.data?.metaobjectByHandle?.id
        if (!remoteId) return json({ ok: false, error: 'Remote metaobject not found' }, { status: 404 })
        const mut = `#graphql
          mutation DeleteTpl($id: ID!){
            metaobjectDelete(id:$id){ deletedId userErrors { field message } }
          }
        `
        const dresp = await admin.graphql(mut, { variables: { id: remoteId } })
        if (!dresp.ok) return json({ ok: false, error: `Delete failed (${dresp.status})` }, { status: 500 })
        const djson = await dresp.json()
        const errors: Array<{ message: string }> = djson?.data?.metaobjectDelete?.userErrors || []
        if (errors.length) return json({ ok: false, error: errors.map(e => e.message).join('; ') }, { status: 400 })
        return json({ ok: true, deleted: orphanId })
      }
      case 'createTemplate': {
        const name = String(form.get('name') || 'Untitled template').trim() || 'Untitled template'
        const t = await createTemplate(name)
        const coreDefs = buildCoreFieldDefsForTemplate(name)
        // Insert core fields transactionally with prefixed keys
        await prisma.$transaction(
          coreDefs.map((f, idx) =>
            prisma.specField.create({
              data: {
                templateId: t.id,
                key: f.key,
                label: f.label,
                type: f.type,
                required: f.required,
                position: idx + 1,
                storage: 'CORE',
                coreFieldPath: f.coreFieldPath,
              },
            }),
          ),
        )
        // Mark this navigation as a fresh creation so the edit page can adapt initial UI
        return redirect(`/app/products/templates/${t.id}?new=1`)
      }
      // <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 -->
      case 'updateProductImageUrl': {
        const id = String(form.get('id'))
        const raw = String(form.get('productImageUrl') || '').trim()
        const value = raw === '' ? null : raw
        if (value && !/^https?:\/\//i.test(value)) {
          return json({ ok: false, error: 'Invalid URL (must start with http/https)' }, { status: 400 })
        }
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma as any).specTemplate.update({ where: { id }, data: { productImageUrl: value } })
        } catch {
          /* ignore until migration applied */
        }
        return json({ ok: true, id, productImageUrl: value })
      }
      // <!-- END RBP GENERATED: importer-templates-orphans-v1 -->
      case 'updateSupplierAvailability': {
        // Internal hook for importer job to update supplier availability metadata
        const id = String(form.get('id'))
        const raw = String(form.get('supplierAvailability') || '').trim()
        const value = raw === '' ? null : raw.slice(0, 500)
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma as any).specTemplate.update({ where: { id }, data: { supplierAvailability: value } })
        } catch {
          /* ignore until migration applied */
        }
        return json({ ok: true, id, supplierAvailability: value })
      }
      // <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 -->
      // Removed updatePrimaryVariantCost: cost default eliminated; cost is a core field
      case 'migrateCostTopLevelToField': {
        // <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 -->
        // Backfill: for any template with a legacy top-level 'cost' in DB or metaobject, set 'primary_variant_cost'
        const TYPE = 'rbp_template'
        const first = 50
        let after: string | null = null
        const definedKeys = await getDefinitionKeys()
        const hasPVC = definedKeys.has('primary_variant_cost')
        // Build local cost map
        const locals = await prisma.specTemplate.findMany({ select: { id: true, name: true } })
        const localCost = new Map<string, number>()
        for (const t of locals) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = (await (prisma as any).specTemplate.findUnique({
            where: { id: t.id },
            select: { cost: true },
          })) as {
            cost?: number | null
          }
          if (row?.cost != null && Number.isFinite(row.cost)) localCost.set(t.id, Number(row.cost))
        }
        let updated = 0
        // Walk remote metaobjects; write primary_variant_cost when possible
        while (true) {
          const GQL = `#graphql
            query List($type: String!, $first: Int!, $after: String) {
              metaobjects(type: $type, first: $first, after: $after) {
                edges { cursor node { id handle
                  costField: field(key:"cost"){ value }
                } }
                pageInfo { hasNextPage endCursor }
              }
            }
          `
          const resp = await admin.graphql(GQL, { variables: { type: TYPE, first, after } })
          if (!resp.ok) break
          const jr = (await resp.json()) as {
            data?: {
              metaobjects?: {
                edges: Array<{
                  cursor: string
                  node: { id: string; handle?: string; costField?: { value?: string | null } | null }
                }>
                pageInfo: { hasNextPage: boolean; endCursor?: string | null }
              }
            }
          }
          const edges = jr?.data?.metaobjects?.edges || []
          for (const e of edges) {
            const handle = e?.node?.handle
            if (!handle) continue
            const local = localCost.get(handle)
            const legacy = (() => {
              const raw = e?.node?.costField?.value
              const n = raw == null ? NaN : Number(raw)
              return Number.isFinite(n) ? (n as number) : undefined
            })()
            const value = local ?? legacy
            if (value == null) continue
            if (!hasPVC) continue
            try {
              await setMetaobjectFields(e.node.id, [{ key: 'primary_variant_cost', value: String(value) }])
              updated += 1
            } catch {
              // ignore per-object failure
            }
          }
          const pi = jr?.data?.metaobjects?.pageInfo
          if (pi?.hasNextPage && pi?.endCursor) after = pi.endCursor
          else break
        }
        return json({ ok: true, updated })
        // <!-- END RBP GENERATED: importer-templates-orphans-v1 -->
      }
      case 'syncAllOrphans': {
        if (isRemoteHybridEnabled()) return json({ ok: false, error: 'Hybrid mode hides orphans' }, { status: 400 })
        const { admin } = await authenticate.admin(request)
        const TYPE = 'rbp_template'
        const first = 100
        let after: string | null = null
        const GQL = `#graphql
          query List($type: String!, $first: Int!, $after: String) {
            metaobjects(type: $type, first: $first, after: $after) {
              edges { cursor node { handle templateId: field(key: "template_id") { value } nameField: field(key:"name"){ value } fieldsJsonField: field(key:"fields_json"){ value } } }
              pageInfo { hasNextPage endCursor }
            }
          }
        `
        const existing = await prisma.specTemplate.findMany({ select: { id: true } })
        const local = new Set(existing.map(r => r.id))
        let adopted = 0
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
                    templateId?: { value?: string | null } | null
                    nameField?: { value?: string | null } | null
                    fieldsJsonField?: { value?: string | null } | null
                  }
                }>
                pageInfo: { hasNextPage: boolean; endCursor?: string | null }
              }
            }
          }
          const edges = jr?.data?.metaobjects?.edges || []
          for (const e of edges) {
            const node = e.node
            const id = node?.templateId?.value || node?.handle
            if (!id || local.has(id)) continue
            const nameVal = node?.nameField?.value || id
            let fields: Array<Record<string, unknown>> = []
            try {
              const raw = node?.fieldsJsonField?.value
              const arr = raw ? JSON.parse(raw) : []
              if (Array.isArray(arr)) fields = arr as Array<Record<string, unknown>>
            } catch {
              /* ignore */
            }
            try {
              await prisma.specTemplate.create({ data: { id, name: nameVal } })
              for (const [idx, f] of fields.entries()) {
                await prisma.specField.create({
                  data: {
                    id: (f.id as string) || undefined,
                    templateId: id,
                    key: String(f.key || `field_${idx + 1}`),
                    label: String(f.label || f.key || `Field ${idx + 1}`),
                    type: ((): 'text' | 'number' | 'boolean' | 'select' => {
                      const vt = f.type
                      return vt === 'number' || vt === 'boolean' || vt === 'select' ? vt : 'text'
                    })(),
                    required: Boolean(f.required),
                    position: typeof f.position === 'number' ? (f.position as number) : idx + 1,
                    storage: (f.storage as string) === 'METAFIELD' ? 'METAFIELD' : 'CORE',
                    coreFieldPath:
                      ((f as { mapping?: { coreFieldPath?: string | null } }).mapping?.coreFieldPath as string) || null,
                    metafieldNamespace:
                      ((f as { mapping?: { metafield?: { namespace?: string | null } } }).mapping?.metafield
                        ?.namespace as string) || null,
                    metafieldKey:
                      ((f as { mapping?: { metafield?: { key?: string | null } } }).mapping?.metafield
                        ?.key as string) || null,
                    metafieldType:
                      ((f as { mapping?: { metafield?: { type?: string | null } } }).mapping?.metafield
                        ?.type as string) || null,
                  },
                })
              }
              local.add(id)
              adopted += 1
            } catch {
              /* ignore per-orphan errors */
            }
          }
          const pi = jr?.data?.metaobjects?.pageInfo
          if (pi?.hasNextPage && pi?.endCursor) after = pi.endCursor
          else break
        }
        return json({ ok: true, updatedCount: adopted })
      }
      // <!-- END RBP GENERATED: importer-templates-orphans-v1 -->
      case 'publishHybridTemplate': {
        if (!isRemoteHybridEnabled()) return json({ ok: false, error: 'Hybrid mode disabled' }, { status: 400 })
        const templateId = String(form.get('id'))
        // Publish (upsert) remote metaobject from local draft
        const adminApi = { graphql: admin.graphql.bind(admin) }
        await createOrUpdateRemoteFromLocalDraft(adminApi, templateId)
        // Hard delete local draft (template + cascade fields via FK)
        await prisma.specTemplate.delete({ where: { id: templateId } })
        return json({ ok: true, published: templateId })
      }
      case 'importRemoteTemplateDraft': {
        if (!isRemoteHybridEnabled()) return json({ ok: false, error: 'Hybrid mode disabled' }, { status: 400 })
        const remoteId = String(form.get('id'))
        const adminApi = { graphql: admin.graphql.bind(admin) }
        try {
          const draftId = await importRemoteTemplateAsDraft(adminApi, remoteId)
          return json({ ok: true, draftId })
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : 'Import failed' }, { status: 500 })
        }
      }
      case 'deleteTemplates': {
        const ids = form.getAll('ids').map(String)
        // Attempt to delete corresponding remote metaobjects first to avoid creating orphans.
        // We ignore individual remote deletion errors but log them.
        for (const id of ids) {
          try {
            const lookup = `#graphql\n              query GetForDelete($handle:String!){\n                metaobjectByHandle(handle:{type:"rbp_template", handle:$handle}){ id }\n              }\n            `
            const lresp = await admin.graphql(lookup, { variables: { handle: id } })
            if (!lresp.ok) {
              console.warn('Remote lookup failed during delete', id, lresp.status)
              continue
            }
            const ljson = await lresp.json()
            const remoteId: string | undefined = ljson?.data?.metaobjectByHandle?.id
            if (!remoteId) continue
            const mut = `#graphql\n              mutation DeleteTpl($id: ID!){\n                metaobjectDelete(id:$id){ deletedId userErrors { field message } }\n              }\n            `
            const dresp = await admin.graphql(mut, { variables: { id: remoteId } })
            if (!dresp.ok) {
              console.warn('Remote delete failed', id, dresp.status)
              continue
            }
            const djson = await dresp.json()
            const errors: Array<{ message: string }> = djson?.data?.metaobjectDelete?.userErrors || []
            if (errors.length) {
              console.warn('Remote delete userErrors', id, errors.map(e => e.message).join('; '))
            }
          } catch (e) {
            console.warn('Remote delete exception', id, e)
          }
        }
        await deleteTemplates(ids)
        return json({ ok: true, deleted: ids })
      }
      case 'restoreOrphanTemplate': {
        const orphanId = String(form.get('id'))
        // Pull metaobject by handle; reconstruct template + fields
        const q = `#graphql
          query GetTpl($handle:String!) {
            metaobjectByHandle(handle:{type:"rbp_template", handle:$handle}) {
              handle
              nameField: field(key:"name"){ value }
              fieldsJsonField: field(key:"fields_json"){ value }
            }
          }
        `
        const resp = await admin.graphql(q, { variables: { handle: orphanId } })
        if (!resp.ok) return json({ ok: false, error: `Metaobject fetch failed (${resp.status})` }, { status: 500 })
        const data = (await resp.json()) as {
          data?: {
            metaobjectByHandle?: {
              handle: string
              nameField?: { value?: string | null } | null
              fieldsJsonField?: { value?: string | null } | null
            } | null
          }
        }
        const mo = data?.data?.metaobjectByHandle
        if (!mo) return json({ ok: false, error: 'Metaobject not found' }, { status: 404 })
        const nameVal: string = mo.nameField?.value || orphanId
        type RemoteField = {
          id?: string
          key?: string
          label?: string
          type?: string
          required?: boolean
          position?: number
          storage?: 'CORE' | 'METAFIELD'
          mapping?: {
            coreFieldPath?: string | null
            metafield?: { namespace?: string | null; key?: string | null; type?: string | null }
          }
        }
        let fields: RemoteField[] = []
        const rawFields = mo.fieldsJsonField?.value
        if (rawFields) {
          try {
            const parsed = JSON.parse(rawFields)
            if (Array.isArray(parsed)) fields = parsed as RemoteField[]
          } catch {
            /* ignore parse error */
          }
        }
        // Create template with fixed id via direct prisma call (bypass cuid())
        await prisma.specTemplate.create({ data: { id: orphanId, name: nameVal || orphanId } })
        for (const [idx, f] of fields.entries()) {
          try {
            await prisma.specField.create({
              data: {
                id: f.id || undefined,
                templateId: orphanId,
                key: f.key || `field_${idx + 1}`,
                label: f.label || f.key || `Field ${idx + 1}`,
                type: ((): 'text' | 'number' | 'boolean' | 'select' => {
                  const vt = f.type
                  if (vt === 'text' || vt === 'number' || vt === 'boolean' || vt === 'select') return vt
                  return 'text'
                })(),
                required: Boolean(f.required),
                position: typeof f.position === 'number' ? f.position : idx + 1,
                storage: f.storage === 'METAFIELD' ? 'METAFIELD' : 'CORE',
                coreFieldPath: f.mapping?.coreFieldPath || null,
                metafieldNamespace: f.mapping?.metafield?.namespace || null,
                metafieldKey: f.mapping?.metafield?.key || null,
                metafieldType: f.mapping?.metafield?.type || null,
              },
            })
          } catch {
            // Skip individual field errors
          }
        }
        return json({ ok: true, restored: orphanId })
      }
      case 'renameTemplate': {
        const id = String(form.get('id'))
        const name = String(form.get('name') || '')
        await renameTemplate(id, name)
        return json({ ok: true })
      }
      case 'addField': {
        const templateId = String(form.get('templateId'))
        const key = String(form.get('key'))
        const label = String(form.get('label'))
        // Force to text type & required per new rule
        const type = 'text' as const
        const required = true
        // Force new fields to be metafields; ignore attempts to set core
        const storage: 'CORE' | 'METAFIELD' = 'METAFIELD'
        const coreFieldPath: string | null = null
        // Derive namespace from template name
        const tpl = await prisma.specTemplate.findUnique({ where: { id: templateId }, select: { name: true } })
        const metafieldNamespace = slugifyTemplateName(tpl?.name || 'product_spec')
        const metafieldKey = key
        const metafieldType = 'single_line_text_field'
        // Prevent duplicate of reserved core base keys or dynamic prefixed keys
        const existingCoreBaseKeys = new Set(CORE_SPEC_FIELD_DEFS.map(c => c.key))
        // Also block if key ends with a base core key preceded by an underscore, matching the naming scheme
        const blocks = Array.from(existingCoreBaseKeys).some(base => key === base || key.endsWith(`_${base}`))
        if (blocks) {
          return json({ ok: false, error: 'Key reserved for core field' }, { status: 400 })
        }
        const f = await addField({
          templateId,
          key,
          label,
          type,
          required,
          storage,
          coreFieldPath,
          metafieldNamespace,
          metafieldKey,
          metafieldType,
        })
        return json({ ok: true, field: f })
      }
      case 'updateField': {
        const id = String(form.get('id'))
        // Load existing field to enforce core restrictions
        const existing = await prisma.specField.findUnique({ where: { id } })
        if (!existing) return json({ ok: false, error: 'Field not found' }, { status: 404 })
        if (isCoreFieldRecord({ storage: existing.storage, coreFieldPath: existing.coreFieldPath })) {
          // Allow only label, required changes for core fields
          const patch: Record<string, FormDataEntryValue> = {}
          for (const [k, v] of form.entries()) {
            if (k === 'label' || k === 'required') patch[k] = v
          }
          if (Object.keys(patch).length === 0) return json({ ok: true, field: existing })
          const f = await updateField(id, patch)
          return json({ ok: true, field: f })
        }
        const data: Record<string, FormDataEntryValue> = {}
        for (const [k, v] of form.entries()) {
          if (!['_action', 'id'].includes(k)) data[k] = v
        }
        const f = await updateField(id, data)
        return json({ ok: true, field: f })
      }
      case 'deleteField': {
        const id = String(form.get('id'))
        const existing = await prisma.specField.findUnique({ where: { id } })
        if (existing && isCoreFieldRecord({ storage: existing.storage, coreFieldPath: existing.coreFieldPath })) {
          return json({ ok: false, error: 'Cannot delete core field' }, { status: 409 })
        }
        await deleteField(id)
        return json({ ok: true })
      }
      case 'reorderField': {
        const id = String(form.get('id'))
        const direction = String(form.get('direction')) as 'up' | 'down'
        const f = await reorderField(id, direction)
        return json({ ok: true, field: f })
      }
      default:
        return json({ ok: false, error: 'Unknown action' }, { status: 400 })
    }
  } catch (err: unknown) {
    // Map common Prisma unique error to 409; otherwise 500
    const e = err as { message?: string; code?: string } | undefined
    const msg = String(e?.message || 'Unexpected Error')
    const status = e?.code === 'P2002' ? 409 : 500
    return json({ ok: false, error: msg }, { status })
  }
}
// END products-workspace-v3-0
