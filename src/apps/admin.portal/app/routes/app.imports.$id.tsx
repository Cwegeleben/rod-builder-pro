import { useSearchParams, useParams } from '@remix-run/react'
import RunDetail from '../components/imports/RunDetail'

export default function ImportRunDetailRoute() {
  const [params] = useSearchParams()
  const { id } = useParams()
  // <!-- BEGIN RBP GENERATED: hq-imports-shopify-style-v1 -->
  return <RunDetail runId={id || ''} initialSearch={params} />
  // <!-- END RBP GENERATED: hq-imports-shopify-style-v1 -->
}
