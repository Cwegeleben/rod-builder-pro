import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { requireHqShopOr404 } from '../lib/access.server'
import { getTemplatesFromShop } from '../models/shopMetafields.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireHqShopOr404(request)
  const { admin } = await authenticate.admin(request)
  const data = await getTemplatesFromShop(admin)
  return json({ ok: true, data })
}
