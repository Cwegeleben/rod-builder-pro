import type { ActionFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { authenticate } from '../shopify.server'
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

// SENTINEL: products-workspace-v3-0 (Resource route for mutations)
// BEGIN products-workspace-v3-0
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request)
    const form = await request.formData()
    const actionType = String(form.get('_action') || '')

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
        return redirect(`/app/products/templates/${t.id}`)
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
