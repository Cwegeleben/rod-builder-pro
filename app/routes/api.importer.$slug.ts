import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'

// Minimal redirect shim to handle stale clients calling
// /api/importer/crawl.discover (dot) instead of /api/importer/crawl/discover (slash)
// Use 307 to preserve method and body for POSTs.
export async function loader({ request, params }: LoaderFunctionArgs) {
  const slug = String(params.slug || '')
  if (slug === 'crawl.discover') {
    const from = new URL(request.url)
    const to = new URL('/api/importer/crawl/discover', from)
    to.search = from.search
    return redirect(to.toString(), 307)
  }
  return new Response('Not Found', { status: 404 })
}

export async function action({ request, params }: ActionFunctionArgs) {
  const slug = String(params.slug || '')
  if (slug === 'crawl.discover') {
    const from = new URL(request.url)
    const to = new URL('/api/importer/crawl/discover', from)
    to.search = from.search
    return redirect(to.toString(), 307)
  }
  return new Response('Not Found', { status: 404 })
}

export default function ApiImporterSlugRedirect() {
  return null
}
