import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { requireHqShopOr404 } from '../lib/access.server'
import { assignTemplateRefToProduct } from '../models/shopMetaobjects.server'

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireHqShopOr404(request)
  const { admin } = await authenticate.admin(request)
  const form = await request.formData()
  const actionType = String(form.get('_action') || '')
  try {
    switch (actionType) {
      case 'assignTemplateRefToProduct': {
        const productId = String(form.get('productId') || '')
        const templateId = String(form.get('templateId') || '')
        if (!productId || !templateId)
          return json({ ok: false, error: 'Missing productId or templateId' }, { status: 400 })
        await assignTemplateRefToProduct(admin, productId, templateId)
        return json({ ok: true })
      }
      default:
        return json({ ok: false, error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error'
    return json({ ok: false, error: msg }, { status: 500 })
  }
}
