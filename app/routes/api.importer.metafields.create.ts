import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { getAdminClient } from '../services/shopifyAdmin.server'
import { createBatsonDefinitions } from '../services/shopifyMetafields.server'

export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const form = await request.formData()
  const intent = String(form.get('intent') || '')
  const target = String(form.get('target') || '')
  if (intent !== 'create' || target !== 'batson-rod-blanks')
    return json({ error: 'Unsupported intent/target' }, { status: 400 })
  try {
    const shop = process.env.SHOP_CUSTOM_DOMAIN || process.env.SHOP || ''
    if (!shop) throw new Error('SHOP not configured')
    const { accessToken, shopName } = await getAdminClient(shop)
    const res = await createBatsonDefinitions(shopName, accessToken, true)
    if (Object.keys(res.errors).length) {
      return json({
        created: res.created,
        error: `Some keys failed: ${Object.entries(res.errors)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ')}`,
      })
    }
    return json({ created: res.created })
  } catch (err) {
    const message = (err as Error)?.message || 'Failed to create metafields'
    return json({ error: message }, { status: 500 })
  }
}
