import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'

function buildTargetUrl(request: Request) {
  const url = new URL(request.url)
  const target = new URL('/app/product-types', url.origin)
  // Preserve all query parameters (Shopify embedded, hmac, host, etc.)
  target.search = url.search
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
