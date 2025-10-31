// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
// Callback route after creating a legacy Spec Template via Templates page.
// Upserts ImportTemplate 1:1 with the Spec Template and redirects to Import Settings.
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { requireHqShopOr404 } from '../lib/access.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireHqShopOr404(request)
  await authenticate.admin(request)
  const url = new URL(request.url)
  const search = url.search || ''
  const templateId = url.searchParams.get('templateId') || ''
  const name = url.searchParams.get('name') || undefined
  if (!templateId) {
    // Missing templateId: bounce to Imports home with an error
    const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    sp.set('error', 'missingTemplateId')
    return redirect(`/app/imports?${sp.toString()}`)
  }
  // Upsert ImportTemplate: 1:1 invariant with Spec Template
  const { importerRepo } = await import('../../src/apps/admin.portal/app/server/importer.repo')
  await importerRepo.upsert(templateId, { name, state: 'NEEDS_SETTINGS' })
  // Redirect to Import Settings for the created template, preserving embedded params and marking created
  const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  sp.set('created', '1')
  return redirect(`/app/imports/${templateId}?${sp.toString()}`)
}

export default function TemplateCreatedRedirect() {
  return null
}
// <!-- END RBP GENERATED: importer-v2-3 -->
