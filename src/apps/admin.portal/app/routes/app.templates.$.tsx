// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { redirect } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'

export async function loader(_args: LoaderFunctionArgs) {
  void _args // placeholder to satisfy lint
  return redirect('/app/imports')
}

export default function LegacyTemplatesRedirect() {
  return <div>importer-v2-3 placeholder: Redirecting to /app/imports…</div>
}
// <!-- END RBP GENERATED: importer-v2-3 -->
