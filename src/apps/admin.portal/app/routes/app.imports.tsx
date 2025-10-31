import { json } from '@remix-run/node'
import { useSearchParams } from '@remix-run/react'
import AdminImportsPage from '../components/imports/AdminImportsPage'

export const loader = async () => {
  // No server data required; UI fetches client-side as needed
  return json({ ok: true })
}

export default function ImportsRoute() {
  const [params] = useSearchParams()
  // <!-- BEGIN RBP GENERATED: hq-imports-shopify-style-v1 -->
  return <AdminImportsPage initialSearch={params} />
  // <!-- END RBP GENERATED: hq-imports-shopify-style-v1 -->
}
