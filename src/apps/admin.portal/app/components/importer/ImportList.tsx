// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { useEffect, useState } from 'react'
import { useLocation } from '@remix-run/react'
import ImportRowStateBadge from './ImportRowStateBadge'
import ShopifyFilterLink from './ShopifyFilterLink'
import { importerActions, importerAdapters, ImportState } from '../../state/importerMachine'
import { IndexTable, Button, ButtonGroup, Link, Text, Frame, Toast, Banner } from '@shopify/polaris'

type Row = {
  templateId: string
  name?: string
  state: ImportState
  runId?: string
  nextRunAt?: string
  hadFailures?: boolean
}

type InitialDbTemplate = {
  id: string
  name?: string
  state: string
  hadFailures?: boolean
  lastRunAt?: string | null
}

// NOTE: For Logic Pass 1 we simulate a single row pulled from adapters
export default function ImportList({ initialDbTemplates }: { initialDbTemplates?: InitialDbTemplate[] } = {}) {
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()

  useEffect(() => {
    ;(async () => {
      // Seed from server-loaded templates first (SSR-safe)
      if (Array.isArray(initialDbTemplates)) {
        const seeded = initialDbTemplates.map(t => ({
          templateId: t.id,
          name: t.name || t.id,
          state: (Object.values(ImportState) as string[]).includes(t.state)
            ? (t.state as ImportState)
            : ImportState.NEEDS_SETTINGS,
          nextRunAt: undefined,
          hadFailures: !!t.hadFailures,
        }))
        setRows(seeded)
      }
      try {
        let url = '/api/importer/templates?kind=import-templates'
        try {
          if (typeof window !== 'undefined') {
            const sp = new URLSearchParams(window.location.search || '')
            sp.set('kind', 'import-templates')
            url = `/api/importer/templates?${sp.toString()}`
          }
        } catch {
          // ignore; fall back to default url without session params
        }
        const resp = await fetch(url)
        if (resp.ok) {
          const jr = (await resp.json()) as {
            templates?: Array<{
              id: string
              name?: string
              state: string
              hadFailures?: boolean
              lastRunAt?: string | null
            }>
          }
          const list = Array.isArray(jr.templates) ? jr.templates : []
          // If API returns successfully, do not fall back to demo; show real rows (or empty state)
          setRows(
            list.map(t => ({
              templateId: t.id,
              name: t.name || t.id,
              state: (Object.values(ImportState) as string[]).includes(t.state)
                ? (t.state as ImportState)
                : ImportState.NEEDS_SETTINGS,
              nextRunAt: undefined,
              hadFailures: !!t.hadFailures,
            })),
          )
          return
        }
      } catch {
        // ignore; keep SSR-seeded rows (or empty state)
      }
    })()
  }, [])

  // Validate action removed
  async function doApprove(r: Row) {
    if (!confirm('Publish all drafts for this run?')) return
    setBusy(r.templateId)
    try {
      const resp = await fetch('/api/importer/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: r.templateId }),
      })
      if (!resp.ok) throw new Error('Approve failed')
    } finally {
      setBusy(null)
    }
    // Refresh from API
    try {
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
      sp.set('kind', 'import-templates')
      const res = await fetch(`/api/importer/templates?${sp.toString()}`)
      if (res.ok) {
        const jr = (await res.json()) as {
          templates?: Array<{ id: string; name?: string; state: string; hadFailures?: boolean }>
        }
        const list = Array.isArray(jr.templates) ? jr.templates : []
        setRows(
          list.map(t => ({
            templateId: t.id,
            name: t.name || t.id,
            state: (Object.values(ImportState) as string[]).includes(t.state)
              ? (t.state as ImportState)
              : ImportState.NEEDS_SETTINGS,
            nextRunAt: undefined,
            hadFailures: !!t.hadFailures,
          })),
        )
      }
    } catch {
      /* ignore */
    }
  }
  async function doReset(r: Row) {
    if (!confirm('Delete drafts and reset this import?')) return
    setBusy(r.templateId)
    try {
      const resp = await fetch('/api/importer/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: r.templateId }),
      })
      if (!resp.ok) throw new Error('Reset failed')
    } finally {
      setBusy(null)
    }
    // Refresh from API
    try {
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
      sp.set('kind', 'import-templates')
      const res = await fetch(`/api/importer/templates?${sp.toString()}`)
      if (res.ok) {
        const jr = (await res.json()) as {
          templates?: Array<{ id: string; name?: string; state: string; hadFailures?: boolean }>
        }
        const list = Array.isArray(jr.templates) ? jr.templates : []
        setRows(
          list.map(t => ({
            templateId: t.id,
            name: t.name || t.id,
            state: (Object.values(ImportState) as string[]).includes(t.state)
              ? (t.state as ImportState)
              : ImportState.NEEDS_SETTINGS,
            nextRunAt: undefined,
            hadFailures: !!t.hadFailures,
          })),
        )
      }
    } catch {
      /* ignore */
    }
  }

  async function doRunNow(r: Row) {
    setBusy(r.templateId)
    try {
      await importerActions.recrawlRunNow(r.templateId)
    } finally {
      setBusy(null)
    }
    const [cfg, sched] = await Promise.all([
      importerAdapters.getImportConfig(r.templateId),
      importerAdapters.getSchedule(r.templateId),
    ])
    setRows(cur =>
      cur.map(x =>
        x.templateId === r.templateId
          ? {
              ...x,
              state: cfg.state,
              hadFailures: (cfg as { hadFailures?: boolean }).hadFailures,
              nextRunAt: sched.nextRunAt,
            }
          : x,
      ),
    )
  }

  const resourceName = { singular: 'import', plural: 'imports' }

  return (
    <div>
      {toast ? (
        <Frame>
          <Toast content={toast} duration={2000} onDismiss={() => setToast(null)} />
        </Frame>
      ) : null}
      {error ? (
        <Banner tone="critical" title="Publish failed" onDismiss={() => setError(null)}>
          <p>{error}</p>
        </Banner>
      ) : null}
      {rows.length === 0 ? (
        <Text as="p" tone="subdued">
          No imports yet. Use “Add import” to create your first one.
        </Text>
      ) : (
        <IndexTable
          resourceName={resourceName}
          itemCount={rows.length}
          headings={[{ title: 'Name' }, { title: 'State' }, { title: 'Next run' }, { title: 'Actions' }]}
        >
          {rows.map((r, index) => {
            const isBusy = busy === r.templateId
            const nextRun = r.nextRunAt
              ? (() => {
                  try {
                    return new Date(r.nextRunAt).toISOString().replace('T', ' ').replace(/Z$/, '')
                  } catch {
                    return r.nextRunAt
                  }
                })()
              : '—'
            return (
              <IndexTable.Row id={r.templateId} key={r.templateId} position={index}>
                <IndexTable.Cell>
                  <Link url={`/app/imports/${r.templateId}${location.search}`}>{r.name || r.templateId}</Link>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <ImportRowStateBadge state={r.state} />
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" tone="subdued">
                    {r.state === ImportState.SCHEDULED ? nextRun : '—'}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <ButtonGroup>
                    {/* Prepare Review starts async preflight + staging */}
                    <Button
                      variant="primary"
                      tone="success"
                      url={`/app/imports/${r.templateId}/prepare${location.search}`}
                    >
                      Prepare review
                    </Button>
                    {/* Publish removed; always offer Review which will auto-stage */}
                    <Button url={`/app/imports/${r.templateId}/review${location.search}`}>Review</Button>
                    {r.state === ImportState.NEEDS_SETTINGS && (
                      <Button url={`/app/imports/${r.templateId}${location.search}`}>Edit settings</Button>
                    )}
                    {/* Validate flow removed from list UI */}
                    {r.state === ImportState.READY_TO_APPROVE && (
                      <>
                        {r.runId ? <ShopifyFilterLink runId={r.runId} /> : null}
                        <Button loading={isBusy} onClick={() => doApprove(r)}>
                          Approve
                        </Button>
                        <Button tone="critical" loading={isBusy} onClick={() => doReset(r)}>
                          Delete/Reset
                        </Button>
                      </>
                    )}
                    {r.state === ImportState.APPROVED && (
                      <>
                        <Button url={`/app/imports/${r.templateId}/schedule`}>Schedule</Button>
                        <Button loading={isBusy} onClick={() => doRunNow(r)}>
                          Run Now
                        </Button>
                        <Button tone="critical" loading={isBusy} onClick={() => doReset(r)}>
                          Delete/Reset
                        </Button>
                      </>
                    )}
                    {r.state === ImportState.SCHEDULED && (
                      <>
                        <Button url={`/app/imports/${r.templateId}/schedule`}>Schedule</Button>
                        <Button loading={isBusy} onClick={() => doRunNow(r)}>
                          Run Now
                        </Button>
                        {r.hadFailures ? (
                          <Text as="span" tone="critical">
                            Last run had failures
                          </Text>
                        ) : null}
                      </>
                    )}
                    {r.state !== ImportState.APPROVED && r.state !== ImportState.SCHEDULED && (
                      <Button disabled>Schedule</Button>
                    )}
                  </ButtonGroup>
                </IndexTable.Cell>
              </IndexTable.Row>
            )
          })}
        </IndexTable>
      )}
    </div>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
