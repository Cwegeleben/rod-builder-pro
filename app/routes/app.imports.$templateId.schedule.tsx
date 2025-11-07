// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
// Expose /app/imports/:templateId/schedule by composing admin portal page.
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData, useParams } from '@remix-run/react'
import ImportSchedulePage from '../../src/apps/admin.portal/app/routes/app.imports.$templateId.schedule'

type LoaderData = {
  ok: boolean
  templateId: string
  name?: string
  state?: string
  schedule?: { enabled?: boolean; freq?: string; at?: string; nextRunAt?: string }
  error?: string
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const templateId = String(params.templateId || '').trim()
  if (!templateId) return json<LoaderData>({ ok: false, templateId: '', error: 'Missing template id' }, { status: 400 })
  try {
    const { prisma } = await import('../db.server')
    const row = await (prisma as any).importTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, name: true, state: true, importConfig: true },
    })
    if (!row) return json<LoaderData>({ ok: false, templateId, error: 'Template not found' }, { status: 404 })
    const cfg = row.importConfig && typeof row.importConfig === 'object' ? (row.importConfig as any) : {}
    const sch = cfg.schedule && typeof cfg.schedule === 'object' ? (cfg.schedule as any) : {}
    return json<LoaderData>({
      ok: true,
      templateId,
      name: row.name as string | undefined,
      state: row.state as string,
      schedule: { enabled: !!sch.enabled, freq: sch.freq || 'none', at: sch.at || '09:00', nextRunAt: sch.nextRunAt },
    })
  } catch (e) {
    return json<LoaderData>(
      { ok: false, templateId, error: (e as Error)?.message || 'Failed to load schedule' },
      { status: 500 },
    )
  }
}

export default function ImportsSchedule() {
  const data = useLoaderData<LoaderData>()
  const { templateId } = useParams()
  if (!data.ok) {
    return (
      <div style={{ padding: '1rem' }}>
        <h1>Schedule</h1>
        <div
          style={{ marginTop: 12, border: '1px solid #fca5a5', background: '#fef2f2', color: '#b91c1c', padding: 12 }}
        >
          {data.error || 'Unable to load schedule.'}
        </div>
        <p style={{ marginTop: 12 }}>
          <a href={`/app/imports`}>Back to imports</a>
        </p>
      </div>
    )
  }
  return (
    <ImportSchedulePage
      initialTemplateName={data.name || templateId || data.templateId}
      initialState={data.state}
      initialSchedule={data.schedule}
    />
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
