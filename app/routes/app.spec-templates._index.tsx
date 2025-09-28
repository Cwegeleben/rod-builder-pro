import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Legacy route: redirect to new templates location
  const url = new URL(request.url)
  url.pathname = '/app/products/templates'
  return redirect(url.toString())
}

export default function LegacySpecTemplatesRedirect() {
  return null
}
