// <!-- BEGIN RBP GENERATED: supplier-inventory-sync-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { getCurrentInventoryBySupplier } from '../services/inventory/supplierSync'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  if (!session?.shop) return json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const domain = url.searchParams.get('domain')
  if (!domain) return json({ error: 'Missing domain' }, { status: 400 })
  const rows = await getCurrentInventoryBySupplier(domain)
  return json({ items: rows })
}
// <!-- END RBP GENERATED: supplier-inventory-sync-v1 -->
