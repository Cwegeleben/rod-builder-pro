// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
// Expose /app/imports/:templateId/schedule by composing admin portal page.
import type { HeadersFunction, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData, useParams, useNavigate, useLocation } from '@remix-run/react'
// Inline schedule component to restore SSR and avoid importing another route file
import { useEffect, useMemo, useState } from 'react'
import { ImportState, type ScheduleConfig } from '../../src/apps/admin.portal/app/state/importerMachine'
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Checkbox,
  Select,
  TextField,
  Button,
  Frame,
  Toast,
  Banner,
  Link,
} from '@shopify/polaris'

type LoaderData = {
  ok: boolean
  templateId: string
  name?: string
  state?: string
  schedule?: { enabled?: boolean; freq?: string; at?: string; nextRunAt?: string }
  error?: string
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  // Ensure only authorized HQ/Admin can view this route
  try {
    const { requireHqShopOr404 } = await import('../lib/access.server')
    await requireHqShopOr404(request)
  } catch {
    // If access helper fails to load, continue; downstream prisma may still throw
  }
  const templateId = String(params.templateId || '').trim()
  if (!templateId)
    return json<LoaderData>(
      { ok: false, templateId: '', error: 'Missing template id' },
      { status: 400, headers: { 'X-RBP-Route': 'imports-schedule', 'X-RBP-Template': '' } },
    )
  try {
    const { prisma } = await import('../db.server')
    const row = await prisma.importTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, name: true, state: true, importConfig: true },
    })
    if (!row)
      return json<LoaderData>(
        { ok: false, templateId, error: 'Template not found' },
        { status: 404, headers: { 'X-RBP-Route': 'imports-schedule', 'X-RBP-Template': templateId } },
      )
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
    try {
      console.info(
        '[ScheduleLoader] route=imports-schedule tpl=%s state=%s enabled=%s freq=%s at=%s',
        templateId,
        row.state,
        String(sch.enabled),
        sch.freq,
        sch.at,
      )
    } catch {
      // noop
    }
    return json<LoaderData>(
      {
        ok: true,
        templateId,
        name: row.name as string | undefined,
        state: row.state as string,
        schedule: sch,
      },
      { headers: { 'X-RBP-Route': 'imports-schedule', 'X-RBP-Template': templateId } },
    )
  } catch (e) {
    return json<LoaderData>(
      { ok: false, templateId, error: (e as Error)?.message || 'Failed to load schedule' },
      { status: 500, headers: { 'X-RBP-Route': 'imports-schedule', 'X-RBP-Template': templateId } },
    )
  }
}

// Propagate diagnostic headers from the loader to the document response
export const headers: HeadersFunction = ({ loaderHeaders }) => {
  const h = new Headers()
  const route = loaderHeaders.get('X-RBP-Route')
  const tpl = loaderHeaders.get('X-RBP-Template')
  if (route) h.set('X-RBP-Route', route)
  if (tpl) h.set('X-RBP-Template', tpl)
  return h
}

export default function ImportsSchedule() {
  const data = useLoaderData<LoaderData>()
  const { templateId: tplParam } = useParams()
  const templateId = tplParam || data.templateId
  const navigate = useNavigate()
  const location = useLocation()
  const debug = typeof location.search === 'string' && /[?&]debugRoute=1(&|$)/.test(location.search)
  if (!data.ok) {
    return (
      <Page title="Schedule" backAction={{ content: 'Back', url: '/app/imports' }}>
        <Banner tone="critical" title="Template not found">
          <p>{data.error || 'Unable to load schedule for this import.'}</p>
          <p>
            <Link url="/app/imports">Back to imports</Link>
          </p>
        </Banner>
      </Page>
    )
  }
  // Local state mirrors portal component semantics
  const [state] = useState<ImportState>((data.state as ImportState) || ImportState.NEEDS_SETTINGS)
  const [form, setForm] = useState<ScheduleConfig>(
    data.schedule
      ? {
          enabled: !!data.schedule.enabled,
          freq: (data.schedule.freq as ScheduleConfig['freq']) || 'none',
          at: (data.schedule.at as string) || '09:00',
          nextRunAt: data.schedule.nextRunAt as string | undefined,
        }
      : { enabled: false, freq: 'none', at: '09:00', nextRunAt: undefined },
  )
  const [saving, setSaving] = useState(false)
  const [busyRecrawl, setBusyRecrawl] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  useEffect(() => {
    if (debug || process.env.NODE_ENV !== 'production') {
      try {
        console.info('[ImportsSchedule] mounted')
      } catch {
        /* ignore */
      }
    }
  }, [debug])
  const canEnable = state === ImportState.APPROVED || state === ImportState.SCHEDULED
  const nextPreview = useMemo(() => {
    const compute = (nowIso: string, cfg: ScheduleConfig): string | undefined => {
      if (!cfg.enabled) return undefined
      if (!cfg.freq || cfg.freq === 'none') return undefined
      const now = new Date(nowIso)
      if (Number.isNaN(now.getTime())) return undefined
      const [hh, mm] = (cfg.at || '09:00').split(':').map(v => parseInt(v, 10))
      const next = new Date(now)
      next.setSeconds(0, 0)
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) next.setHours(9, 0, 0, 0)
      else next.setHours(hh, mm, 0, 0)
      if (next.getTime() <= now.getTime()) {
        if (cfg.freq === 'daily') next.setDate(next.getDate() + 1)
        else if (cfg.freq === 'weekly') next.setDate(next.getDate() + 7)
        else if (cfg.freq === 'monthly') next.setMonth(next.getMonth() + 1)
      }
      return next.toISOString()
    }
    return compute(new Date().toISOString(), form) || undefined
  }, [form])
  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setBanner(null)
    if (form.enabled && !canEnable) {
      setBanner('Schedule is available after a published run.')
      return
    }
    setSaving(true)
    try {
      const resp = await fetch('/api/importer/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, enabled: form.enabled, freq: form.freq, at: form.at }),
      })
      if (!resp.ok) setBanner('Failed to save schedule')
      else setToast('Schedule saved')
      try {
        const back = `/app/imports${location.search || ''}`
        navigate(back)
      } catch {
        window.location.assign('/app/imports')
      }
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      {toast ? (
        <Frame>
          <Toast content={toast} duration={1600} onDismiss={() => setToast(null)} />
        </Frame>
      ) : null}
      <Page
        title={`Schedule — ${data.name || templateId}`}
        data-testid="schedule-page"
        backAction={{ content: 'Back', onAction: () => navigate(`/app/imports${location.search || ''}`) }}
        subtitle={debug ? 'Route: imports-schedule' : undefined}
      >
        <InlineStack gap="300" blockAlign="center">
          <Link url={`/app/imports/${templateId}${location.search}`}>Manage settings</Link>
          <Text as="span" tone="subdued" variant="bodySm">
            {canEnable ? 'Scheduling available' : 'Enable after a published run'}
          </Text>
          <Text as="span" tone="subdued" variant="bodySm">
            Importer v2.3
          </Text>
        </InlineStack>
        {banner ? (
          <Banner tone="warning" onDismiss={() => setBanner(null)}>
            <p>{banner}</p>
          </Banner>
        ) : null}
        <BlockStack gap="400">
          <Card>
            <form onSubmit={onSave}>
              <BlockStack gap="400">
                <InlineStack gap="300" blockAlign="center">
                  <Checkbox
                    label="Enable schedule"
                    checked={!!form.enabled}
                    onChange={(checked: boolean) => setForm(f => ({ ...f, enabled: checked }))}
                    disabled={!canEnable && !form.enabled}
                  />
                  {!canEnable && !form.enabled ? (
                    <Text as="span" tone="subdued" variant="bodySm">
                      Available after a published run
                    </Text>
                  ) : null}
                </InlineStack>
                <Divider />
                <InlineStack gap="400">
                  <div style={{ minWidth: 220 }}>
                    <Select
                      label="Frequency"
                      options={[
                        { label: 'Daily', value: 'daily' },
                        { label: 'Weekly', value: 'weekly' },
                        { label: 'Monthly', value: 'monthly' },
                      ]}
                      value={form.freq}
                      onChange={v => setForm(f => ({ ...f, freq: v as ScheduleConfig['freq'] }))}
                      disabled={!form.enabled}
                    />
                  </div>
                  <div style={{ minWidth: 180 }}>
                    <TextField
                      label="Time"
                      type="time"
                      value={form.at || '09:00'}
                      onChange={v => setForm(f => ({ ...f, at: v }))}
                      autoComplete="off"
                      disabled={!form.enabled}
                    />
                  </div>
                </InlineStack>
                <Text as="p" tone="subdued">
                  Next run:{' '}
                  {form.enabled ? (nextPreview ? new Date(nextPreview).toLocaleString?.() || nextPreview : '—') : '—'}
                </Text>
                <InlineStack gap="200">
                  <Button submit loading={saving}>
                    Save
                  </Button>
                  <Button onClick={() => navigate(`/app/imports${location.search || ''}`)}>Cancel</Button>
                </InlineStack>
              </BlockStack>
            </form>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Recrawl
              </Text>
              <Text as="p" tone="subdued">
                Recrawl will fetch current data and publish updates only when changes are detected.
              </Text>
              <InlineStack>
                <Button
                  onClick={async () => {
                    setBusyRecrawl(true)
                    try {
                      const resp = await fetch('/api/importer/recrawl', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ templateId }),
                      })
                      if (!resp.ok) throw new Error('Failed to start recrawl')
                      setToast('Recrawl started')
                    } catch (e) {
                      setBanner((e as Error)?.message || 'Failed to start recrawl')
                    } finally {
                      setBusyRecrawl(false)
                    }
                  }}
                  loading={busyRecrawl}
                  disabled={!(state === ImportState.APPROVED || state === ImportState.SCHEDULED)}
                >
                  Recrawl now
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    </>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
