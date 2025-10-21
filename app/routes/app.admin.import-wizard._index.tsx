import { redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  return redirect('/app/admin/import/runs?migrated=1', { headers: { 'Cache-Control': 'no-store' } })
}

export default function LegacyImportWizardIndexRedirect() {
  return null
}
