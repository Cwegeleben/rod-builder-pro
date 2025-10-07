// <!-- BEGIN RBP GENERATED: supplier-inventory-sync-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { getInventoryStatusSummary } from '../services/inventory/supplierSync'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  if (!session?.shop) return json({ error: 'Unauthorized' }, { status: 401 })
  const status = await getInventoryStatusSummary()
  return json({ suppliers: status })
}
// <!-- END RBP GENERATED: supplier-inventory-sync-v1 -->
