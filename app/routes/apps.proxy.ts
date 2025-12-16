import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { buildShopifyCorsHeaders } from '../utils/shopifyCors.server'

export async function loader({ request }: LoaderFunctionArgs) {
  return json(
    {
      ok: true,
      message: 'App proxy root responding',
      generatedAt: new Date().toISOString(),
    },
    {
      headers: buildShopifyCorsHeaders(request, {
        'Cache-Control': 'no-store, must-revalidate',
      }),
    },
  )
}
