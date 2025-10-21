// <!-- BEGIN RBP GENERATED: admin-hq-importer-ux-v2 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'

// Import Settings alias route (HQ-only)
// Redirects to existing settings preserving search params

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  const url = new URL(request.url)
  const search = url.search
  return redirect(`admin/import/settings${search}`)
}

export default function ImportSettingsAlias() {
  return null
}
// <!-- END RBP GENERATED: admin-hq-importer-ux-v2 -->
