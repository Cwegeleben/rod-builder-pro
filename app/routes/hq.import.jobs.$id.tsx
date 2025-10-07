// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { authenticate } from '../shopify.server'

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  if (!session?.shop) return json({}, { status: 401 })
  const id = params.id
  return json({ id })
}

export default function ImportJobPage() {
  const { id } = useLoaderData<typeof loader>() as { id: string }
  return (
    <div className="p-m space-y-m">
      <h2>Import Job {id}</h2>
      <p>Job status UI coming soon.</p>
    </div>
  )
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
