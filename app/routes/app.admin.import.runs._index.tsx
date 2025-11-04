// redirect shim only; do not expand.
// <!-- BEGIN RBP GENERATED: hq-import-runs-list-v1 -->
import { redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'

// legacy type removed; route now redirects

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  const url = new URL(request.url)
  const search = url.search
  // Canonicalize to new Imports home
  return redirect(`/app/imports${search}`)
}

export default function ImportRunsIndex() {
  return null
}
// <!-- END RBP GENERATED: hq-import-runs-list-v1 -->
