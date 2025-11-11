// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
// /app/imports parent route acts as a layout and renders child routes via <Outlet/>.
// The index child composes the Imports home UI; /app/imports/new renders the wizard, etc.
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import GlobalImportProgress from '../components/importer/GlobalImportProgress'
import { isProductDbExclusive } from '../lib/flags.server'

export async function loader({ request }: LoaderFunctionArgs) {
  if (isProductDbExclusive()) {
    const u = new URL(request.url)
    // Preserve query context for transparency
    const dest = new URL('/app/products', u.origin)
    dest.searchParams.set('legacy', 'disabled')
    return redirect(dest.pathname + dest.search)
  }
  return null
}

export default function ImportsLayout() {
  return (
    <div>
      <GlobalImportProgress />
      <Outlet />
    </div>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
