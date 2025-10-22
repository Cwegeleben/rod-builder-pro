// <!-- BEGIN RBP GENERATED: admin-hq-importer-ux-v2 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'

// Import Runs index alias route
// Keeps URLs relative to preserve shop/host/embedded params

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const search = url.search
  // Redirect to existing runs index under admin/import
  return redirect(`/app/admin/import/runs${search}`)
}

export default function ImportsIndexAlias() {
  return null
}
// <!-- END RBP GENERATED: admin-hq-importer-ux-v2 -->
