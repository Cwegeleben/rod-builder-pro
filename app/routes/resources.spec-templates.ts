import type { ActionFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { createTemplate, deleteTemplates, renameTemplate } from '../models/specTemplate.server'
import { addField, updateField, deleteField, reorderField } from '../models/specField.server'

// SENTINEL: products-workspace-v3-0 (Resource route for mutations)
// BEGIN products-workspace-v3-0
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request)
  const form = await request.formData()
  const actionType = String(form.get('_action') || '')

  switch (actionType) {
    case 'createTemplate': {
      const name = String(form.get('name') || 'Untitled template')
      const t = await createTemplate(name)
      return redirect(`/app/products/templates/${t.id}`)
    }
    case 'deleteTemplates': {
      const ids = form.getAll('ids').map(String)
      await deleteTemplates(ids)
      return json({ ok: true })
    }
    case 'renameTemplate': {
      const id = String(form.get('id'))
      const name = String(form.get('name'))
      await renameTemplate(id, name)
      return json({ ok: true })
    }
    case 'addField': {
      const templateId = String(form.get('templateId'))
      const key = String(form.get('key'))
      const label = String(form.get('label'))
      const type = String(form.get('type')) as 'text' | 'number' | 'boolean' | 'select'
      const required = form.get('required') === 'on' || form.get('required') === 'true'
      const storage = String(form.get('storage')) as 'CORE' | 'METAFIELD'
      const coreFieldPath = (form.get('coreFieldPath') as string) || null
      const metafieldNamespace = (form.get('metafieldNamespace') as string) || null
      const metafieldKey = (form.get('metafieldKey') as string) || null
      const metafieldType = (form.get('metafieldType') as string) || null
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
      const data: Record<string, FormDataEntryValue> = {}
      for (const [k, v] of form.entries()) {
        if (!['_action', 'id'].includes(k)) data[k] = v
      }
      const f = await updateField(id, data)
      return json({ ok: true, field: f })
    }
    case 'deleteField': {
      const id = String(form.get('id'))
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
}
// END products-workspace-v3-0
