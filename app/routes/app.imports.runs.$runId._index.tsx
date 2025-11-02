// <!-- BEGIN RBP GENERATED: importer-review-inline-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const search = url.search
  const runId = String(params.runId)
  return redirect(`/app/imports/runs/${runId}/review${search}`)
}

export default function ImportRunReviewAlias() {
  return null
}
// <!-- END RBP GENERATED: importer-review-inline-v1 -->
