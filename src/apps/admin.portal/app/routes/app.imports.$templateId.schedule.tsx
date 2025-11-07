// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from '@remix-run/react'
import { ImportState, type ScheduleConfig } from '../state/importerMachine'
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

type Props = {
  initialTemplateName?: string
  initialState?: string
  initialSchedule?: ScheduleConfig
}

export default function ImportSchedulePage(props: Props = {}) {
  const { templateId: tplParam } = useParams()
  const templateId = tplParam || 'DEMO-TEMPLATE'
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(!props.initialSchedule)
  const [saving, setSaving] = useState(false)
  const [busyRecrawl, setBusyRecrawl] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [state, setState] = useState<ImportState>((props.initialState as ImportState) || ImportState.NEEDS_SETTINGS)
  // client-side preview only
  const [form, setForm] = useState<ScheduleConfig>(
    props.initialSchedule || { enabled: false, freq: 'none', at: '09:00', nextRunAt: undefined },
  )

  useEffect(() => {
    if (props.initialSchedule) return
    ;(async () => {
      try {
        const res = await fetch(`/api/importer/schedule?templateId=${encodeURIComponent(templateId)}`)
        if (res.ok) {
          const jr = (await res.json()) as { state?: string; schedule?: ScheduleConfig }
          const st = (jr.state || ImportState.NEEDS_SETTINGS) as ImportState
          const sch = jr.schedule || { enabled: false, freq: 'none', at: '09:00', nextRunAt: undefined }
          setState(st)
          setForm({ enabled: !!sch.enabled, freq: sch.freq || 'none', at: sch.at || '09:00', nextRunAt: sch.nextRunAt })
          // no-op
        }
      } catch {
        // ignore
      }
      setLoading(false)
    })()
  }, [templateId, props.initialSchedule])

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

  const canEnable = state === ImportState.APPROVED || state === ImportState.SCHEDULED

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setBanner(null)
    if (form.enabled && !canEnable) {
      setBanner('Schedule is available after a published run.')
      return
    }
    setSaving(true)
    try {
      // Save schedule via API; server will handle state transitions
      const resp = await fetch('/api/importer/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, enabled: form.enabled, freq: form.freq, at: form.at }),
      })
      if (!resp.ok) setBanner('Failed to save schedule')
      else setToast('Schedule saved')
      // Navigate back preserving embedded session params
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
        title={`Schedule — ${props.initialTemplateName || templateId}`}
        backAction={{
          content: 'Back',
          onAction: () => navigate(`/app/imports${location.search || ''}`),
        }}
      >
        <InlineStack gap="300" blockAlign="center">
          <Link url={`/app/imports/${templateId}${location.search}`}>Manage settings</Link>
          <Text as="span" tone="subdued" variant="bodySm">
            {state === ImportState.APPROVED || state === ImportState.SCHEDULED
              ? 'Scheduling available'
              : 'Enable after a published run'}
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
            {loading ? (
              <BlockStack gap="200">
                <Text as="p" tone="subdued">
                  Loading…
                </Text>
              </BlockStack>
            ) : (
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
            )}
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
