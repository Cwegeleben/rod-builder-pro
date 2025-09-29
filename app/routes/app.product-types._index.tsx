import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { authenticate } from '../shopify.server'

// SENTINEL: products-workspace-v3-0 (Redirect legacy route)
// BEGIN products-workspace-v3-0
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  return redirect('/app/products/templates')
}

export default function Redirecting() {
  return null
}
// END products-workspace-v3-0
