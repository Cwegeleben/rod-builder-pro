import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Legacy route: redirect to new location under products
  const url = new URL(request.url)
  url.pathname = '/app/products/import'
  return redirect(url.toString())
}

export const action = async ({ request }: ActionFunctionArgs) => {
  // Ensure POSTs also land on the new route
  const url = new URL(request.url)
  url.pathname = '/app/products/import'
  return redirect(url.toString())
}

export default function LegacyImportRedirect() {
  return null
}
