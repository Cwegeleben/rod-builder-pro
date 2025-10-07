// <!-- BEGIN RBP GENERATED: supplier-inventory-sync-v1 -->
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { runSupplierInventorySync } from '../services/inventory/supplierSync'

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request)
  if (!session?.shop) return json({ error: 'Unauthorized' }, { status: 401 })
  const summaries = await runSupplierInventorySync(admin)
  return json({ summaries })
}
// <!-- END RBP GENERATED: supplier-inventory-sync-v1 -->
