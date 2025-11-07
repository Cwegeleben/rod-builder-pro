// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
// Expose /app/imports/:templateId/schedule by composing admin portal page.
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData, useParams } from '@remix-run/react'
import { Banner, Link } from '@shopify/polaris'
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
    const row = await prisma.importTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, name: true, state: true, importConfig: true },
    })
    if (!row) return json<LoaderData>({ ok: false, templateId, error: 'Template not found' }, { status: 404 })
    const cfg: Record<string, unknown> =
      row.importConfig && typeof row.importConfig === 'object' ? (row.importConfig as Record<string, unknown>) : {}
    const rawSchedule =
      cfg.schedule && typeof cfg.schedule === 'object' ? (cfg.schedule as Record<string, unknown>) : {}
    const sch = {
      enabled: rawSchedule.enabled === true,
      freq: typeof rawSchedule.freq === 'string' ? rawSchedule.freq : 'none',
      at: typeof rawSchedule.at === 'string' ? rawSchedule.at : '09:00',
      nextRunAt: typeof rawSchedule.nextRunAt === 'string' ? rawSchedule.nextRunAt : undefined,
    }
    // Observability: emit schedule:view (best-effort; ignore errors)
    try {
      await prisma.importLog.create({
        data: {
          templateId,
          runId: `schedule-${Date.now()}`,
          type: 'schedule:view',
          payload: {
            state: row.state,
            enabled: sch.enabled,
            freq: sch.freq,
            at: sch.at,
            nextRunAt: sch.nextRunAt,
            ua: request.headers.get('user-agent') || undefined,
          },
        },
      })
    } catch {
      // ignore logging failure
    }
    return json<LoaderData>({
      ok: true,
      templateId,
      name: row.name as string | undefined,
      state: row.state as string,
      schedule: sch,
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
        <Banner tone="critical" title="Template not found">
          <p>{data.error || 'Unable to load schedule for this import.'}</p>
          <p>
            <Link url="/app/imports">Back to imports</Link>
          </p>
        </Banner>
      </div>
    )
  }
  return (
    <ImportSchedulePage
      initialTemplateName={data.name || templateId || data.templateId}
      initialState={data.state}
      // Cast schedule to the expected shape ensuring enabled defaults to false when undefined
      initialSchedule={
        data.schedule
          ? {
              enabled: !!data.schedule.enabled,
              freq: ((data.schedule.freq as string) || 'none') as 'none' | 'daily' | 'weekly' | 'monthly',
              at: (data.schedule.at as string) || '09:00',
              nextRunAt: data.schedule.nextRunAt as string | undefined,
            }
          : undefined
      }
    />
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
