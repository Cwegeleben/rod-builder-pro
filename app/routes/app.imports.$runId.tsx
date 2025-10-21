// <!-- BEGIN RBP GENERATED: admin-hq-importer-ux-v2 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'

// Run Detail alias route
// Redirects to existing detail route preserving search params

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const search = url.search
  const runId = String(params.runId)
  return redirect(`admin/import/runs/${runId}${search}`)
}

export default function ImportRunDetailAlias() {
  return null
}
// <!-- END RBP GENERATED: admin-hq-importer-ux-v2 -->
