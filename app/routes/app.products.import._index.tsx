import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'

// DEPRECATED: Supplier Import Wizard v1 (obsolete since RBP HQ Importer v2)
export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  return redirect('/app/admin/import/runs', { status: 302 })
}

export default function LegacyProductsImportRedirect() {
  return null
}
// Note: Legacy v1 wizard UI removed; this route is a permanent redirect for HQ users
