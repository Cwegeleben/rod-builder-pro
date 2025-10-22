// <!-- BEGIN RBP GENERATED: admin-link-integrity-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'

// REMOVE LATER: Legacy job page shim. Redirect to Import Runs (no UI).
export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  const url = new URL(request.url)
  return redirect(`/app/admin/import/runs${url.search}`)
}

export default function LegacyJobRedirect() {
  return null
}
// <!-- END RBP GENERATED: admin-link-integrity-v1 -->
