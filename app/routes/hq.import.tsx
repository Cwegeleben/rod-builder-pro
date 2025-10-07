// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { authenticate } from '../shopify.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  return redirect('/app/products/import', { status: 302 })
}

export default function HQImportRedirect() {
  return null
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
