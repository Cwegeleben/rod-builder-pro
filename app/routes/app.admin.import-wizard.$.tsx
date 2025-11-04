// redirect shim only; do not expand.
import { redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  // Redirect all legacy import-wizard paths to the new Runs page with migrated flag
  return redirect('/app/admin/import/runs?migrated=1', { headers: { 'Cache-Control': 'no-store' } })
}

export default function LegacyImportWizardRedirect() {
  return null
}
