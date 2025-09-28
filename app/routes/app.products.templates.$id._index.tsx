import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'

function buildTargetUrl(request: Request) {
  const url = new URL(request.url)
  // For now redirect to product-types root; if a detail view exists, update accordingly
  const target = new URL('/app/product-types', url.origin)
  target.search = url.search // preserve Shopify query params
  return target.toString()
}

export async function loader({ request }: LoaderFunctionArgs) {
  return redirect(buildTargetUrl(request), { status: 302 })
}

export async function action({ request }: ActionFunctionArgs) {
  return redirect(buildTargetUrl(request), { status: 302 })
}

export default function Redirecting() {
  return null
}
