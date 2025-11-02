// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
// Expose /app/imports/new by composing the admin portal NewImportWizard and
// handling the server-side action to create a new ImportTemplate.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import NewImportWizard from '../../src/apps/admin.portal/app/routes/app.imports.new'

export default function ImportsNew() {
  return <NewImportWizard />
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url)
  const search = url.search || ''
  const form = await request.formData()
  const name = String(form.get('name') || '').trim() || 'New Import'

  // Import prisma server-side only here to avoid client bundle issues
  const { prisma } = await import('../db.server')
  const { createTemplate } = await import('../models/specTemplate.server')
  const { buildCoreFieldDefsForTemplate } = await import('../models/specTemplateCoreFields')
  try {
    // importer-v2-3: Create a Spec Template first, then 1:1 ImportTemplate with same id
    const tpl = await createTemplate(name)
    const coreDefs = buildCoreFieldDefsForTemplate(tpl.name || name)
    // Insert core fields transactionally with prefixed keys
    await (prisma as any).$transaction(
      coreDefs.map((f: any, idx: number) =>
        (prisma as any).specField.create({
          data: {
            templateId: tpl.id,
            key: f.key,
            label: f.label,
            type: f.type,
            required: f.required,
            position: idx + 1,
            storage: 'CORE',
            coreFieldPath: f.coreFieldPath,
          },
        }),
      ),
    )
    // Now create the ImportTemplate record using the Spec Template id (1:1)
    await (prisma as any).importTemplate.create({
      data: {
        id: tpl.id,
        name: tpl.name || name,
        importConfig: {},
        state: 'NEEDS_SETTINGS',
        hadFailures: false,
      },
    })
    // Log template created
    try {
      await (prisma as any).importLog.create({
        data: { templateId: tpl.id, runId: tpl.id, type: 'template:created', payload: { name: tpl.name || name } },
      })
    } catch {
      /* ignore */
    }
    // Redirect to settings for this template id
    const sp = new URLSearchParams(search || '')
    sp.set('created', '1')
    const qs = sp.toString()
    return redirect(`/app/imports/${tpl.id}?${qs}`)
  } catch (err) {
    const message = (err as Error)?.message || 'Failed to create template'
    // Return action data so the client can display an inline error
    return json({ error: message }, { status: 400 })
  }
}
// <!-- END RBP GENERATED: importer-v2-3 -->
