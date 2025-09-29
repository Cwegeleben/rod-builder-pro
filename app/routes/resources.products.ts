// Resource route to handle products bulk actions
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { authenticate } from '../shopify.server'

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request)
  const form = await request.formData()
  const action = String(form.get('_action') || '')
  const ids = form.getAll('ids') as string[]
  try {
    switch (action) {
      case 'setStatus': {
        // const status = String(form.get('status') || '') // ACTIVE|DRAFT|ARCHIVED
        // Placeholder: not implemented; return ok
        return json({ ok: true, updated: ids.length })
      }
      case 'addTags': {
        const tags = String(form.get('tags') || '')
        return json({ ok: true, updated: ids.length, tags })
      }
      default:
        return json({ ok: false, error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Action failed'
    return json({ ok: false, error: message }, { status: 500 })
  }
}
