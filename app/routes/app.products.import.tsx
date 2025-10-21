// DEPRECATED: Supplier Import Wizard v1 (obsolete since RBP HQ Importer v2)
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  return redirect('/app/admin/import/runs', { status: 302 })
}

export default function LegacyProductsImportRedirect() {
  return null
}
