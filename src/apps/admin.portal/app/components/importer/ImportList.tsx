// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { useEffect, useState } from 'react'
import { useLocation } from '@remix-run/react'
import ImportRowStateBadge from './ImportRowStateBadge'
import { ImportState } from '../../state/importerMachine'
import {
  IndexTable,
  Button,
  ButtonGroup,
  Link,
  Text,
  Frame,
  Toast,
  Banner,
  ProgressBar,
  InlineStack,
} from '@shopify/polaris'

type Row = {
  templateId: string
  name?: string
  state: ImportState
  runId?: string
  nextRunAt?: string
  hadFailures?: boolean
  preparing?: { runId: string; startedAt?: string; etaSeconds?: number; pct?: number; phase?: string }
  hasSeeds?: boolean
  hasStaged?: boolean
  queuedCount?: number
  lastRunAt?: string | null
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
  // Temporary: disable Polaris IndexTable on this page to avoid td/li hydration issues in embedded Admin
  const DISABLE_INDEXTABLE = true
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()

  useEffect(() => {
    // Avoid SSR/CSR markup mismatches from responsive IndexTable by rendering table client-only
    setHydrated(true)
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
          lastRunAt: t.lastRunAt ?? null,
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
              lastRunId?: string | null
              preparing?: { runId: string; startedAt?: string; etaSeconds?: number } | null
              hasSeeds?: boolean
              hasStaged?: boolean
              queuedCount?: number
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
              preparing: t.preparing || undefined,
              hasSeeds: !!t.hasSeeds,
              hasStaged: !!t.hasStaged,
              queuedCount: typeof t.queuedCount === 'number' ? t.queuedCount : 0,
              runId: t.lastRunId || undefined,
              lastRunAt: typeof t.lastRunAt === 'string' ? t.lastRunAt : null,
            })),
          )
          return
        }
      } catch {
        // ignore; keep SSR-seeded rows (or empty state)
      }
    })()
  }, [])

  // Poll progress for preparing rows
  useEffect(() => {
    const ids = rows.filter(r => r.preparing?.runId).map(r => ({ tpl: r.templateId, run: r.preparing!.runId }))
    if (!ids.length) return
    let active = true
    const timer = setInterval(async () => {
      if (!active) return
      for (const id of ids) {
        try {
          const s = await fetch(`/api/importer/runs/${id.run}/status`)
          if (!s.ok) continue
          const j = (await s.json()) as {
            status: string
            startedAt?: string
            preflight?: { candidates?: number; etaSeconds?: number } | null
            progress?: { percent?: number; phase?: string } | null
          }
          if (j.status === 'started' || j.status === 'done') {
            // stop showing preparing for this row
            setRows(cur => cur.map(r => (r.templateId === id.tpl ? { ...r, preparing: undefined } : r)))
            continue
          }
          if (j.status === 'staged') {
            // mark ready: stop preparing, enable Review, and toast
            setRows(cur =>
              cur.map(r => (r.templateId === id.tpl ? { ...r, preparing: undefined, hasStaged: true } : r)),
            )
            setToast('Review is ready')
            continue
          }
          const started = j.startedAt ? new Date(j.startedAt).getTime() : Date.now()
          const eta = j.preflight?.etaSeconds || 60
          // touch row to update preparing timestamps/eta; pct computed in render
          setRows(cur =>
            cur.map(r =>
              r.templateId === id.tpl
                ? {
                    ...r,
                    preparing: {
                      ...r.preparing!,
                      etaSeconds: eta,
                      startedAt: new Date(started).toISOString(),
                      pct: typeof j.progress?.percent === 'number' ? j.progress.percent : r.preparing?.pct,
                      phase: j.progress?.phase || r.preparing?.phase,
                    },
                  }
                : r,
            ),
          )
          // We display pct in render; storing in state is optional; compute on the fly
        } catch {
          /* ignore */
        }
      }
    }, 2000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [rows])

  // Validate action removed
  // Removed approve/reset/delete/run-now from simplified list UI

  async function toggleSchedule(r: Row, enabled: boolean) {
    setBusy(r.templateId)
    try {
      const resp = await fetch('/api/importer/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: r.templateId, enabled }),
      })
      if (!resp.ok) throw new Error('Schedule update failed')
      const jr = (await resp.json()) as {
        ok?: boolean
        state?: string
        schedule?: { nextRunAt?: string | null; enabled?: boolean; freq?: string; at?: string }
      }
      const nextState = (jr.state as ImportState) || (enabled ? ImportState.SCHEDULED : ImportState.APPROVED)
      const nextRunAt = jr.schedule?.nextRunAt || undefined
      setRows(cur => cur.map(x => (x.templateId === r.templateId ? { ...x, state: nextState, nextRunAt } : x)))
      setToast(enabled ? 'Schedule enabled' : 'Schedule disabled')
    } catch (e) {
      setError((e as Error)?.message || 'Schedule update failed')
    } finally {
      setBusy(null)
    }
  }

  // doRunNow removed from simplified list UI

  // doPrepare removed: Full Discover is launched from Settings page header

  const resourceName = { singular: 'import', plural: 'imports' }
  const [selected, setSelected] = useState<string[]>([])

  async function bulkDelete(ids: string[]) {
    if (!ids.length) return
    if (
      !confirm(
        `Delete ${ids.length} selected imports? This will remove their settings, logs, and staged items for their suppliers.`,
      )
    )
      return
    setBusy('bulk')
    try {
      const resp = await fetch('/api/importer/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateIds: ids }),
      })
      if (!resp.ok) throw new Error('Delete failed')
      setRows(cur => cur.filter(x => !ids.includes(x.templateId)))
      setSelected([])
    } catch {
      setError('Delete failed')
    } finally {
      setBusy(null)
    }
  }

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
      ) : !hydrated ? (
        <div aria-hidden>
          <Text as="p" tone="subdued">
            Loading…
          </Text>
        </div>
      ) : DISABLE_INDEXTABLE ? (
        <div>
          <div style={{ display: 'grid', gap: 12 }}>
            {rows.map(r => {
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
                <div
                  key={r.templateId}
                  role="button"
                  tabIndex={0}
                  onClick={e => {
                    // avoid triggering when clicking on explicit links/buttons
                    const t = e.target as HTMLElement
                    if (t.closest('a,button,[role="button"][data-no-row-nav]')) return
                    window.location.assign(`/app/imports/${encodeURIComponent(r.templateId)}${location.search}`)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      window.location.assign(`/app/imports/${encodeURIComponent(r.templateId)}${location.search}`)
                    }
                  }}
                  style={{
                    border: '1px solid var(--p-color-border)',
                    borderRadius: 8,
                    padding: 12,
                    display: 'grid',
                    gap: 8,
                    cursor: 'pointer',
                  }}
                >
                  <InlineStack align="space-between">
                    <InlineStack gap="200" blockAlign="center">
                      <Link url={`/app/imports/${r.templateId}${location.search}`}>{r.name || r.templateId}</Link>
                      <Text as="span" tone="subdued" variant="bodySm">
                        {(() => {
                          const parts: string[] = []
                          if (typeof r.queuedCount === 'number' && r.queuedCount > 0) parts.push(`(${r.queuedCount})`)
                          const lastRunAt = r.lastRunAt
                          if (typeof lastRunAt === 'string') {
                            try {
                              const t = Date.parse(lastRunAt)
                              const d = Math.max(0, Math.floor((Date.now() - t) / 1000))
                              const m = Math.floor(d / 60)
                              const label = m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`
                              parts.push(`• Last run ${label}`)
                            } catch {
                              /* ignore */
                            }
                          }
                          return parts.join(' ')
                        })()}
                      </Text>
                    </InlineStack>
                    <div>
                      <InlineStack gap="200" blockAlign="center">
                        <ImportRowStateBadge state={r.state} />
                        {r.queuedCount && r.queuedCount > 0 ? (
                          <Text as="span" tone="subdued">{`• ${r.queuedCount} queued`}</Text>
                        ) : null}
                        {r.runId ? (
                          <Link url={`/app/imports/runs/${encodeURIComponent(r.runId)}/review${location.search}`}>
                            View last run
                          </Link>
                        ) : null}
                      </InlineStack>
                    </div>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">
                      {r.state === ImportState.SCHEDULED ? nextRun : '—'}
                    </Text>
                    <ButtonGroup>
                      {r.state === ImportState.APPROVED || r.state === ImportState.SCHEDULED ? (
                        <Button
                          data-no-row-nav
                          loading={busy === r.templateId}
                          onClick={() => toggleSchedule(r, r.state !== ImportState.SCHEDULED)}
                        >
                          {r.state === ImportState.SCHEDULED ? 'Disable schedule' : 'Enable schedule'}
                        </Button>
                      ) : null}
                    </ButtonGroup>
                  </InlineStack>
                  {r.preparing ? (
                    <div>
                      <InlineStack gap="200" align="space-between">
                        <Text as="span">{`Preparing…${r.preparing.phase ? ` ${r.preparing.phase}` : ''}`}</Text>
                        <Text as="span" tone="subdued">
                          {(() => {
                            const started = r.preparing?.startedAt ? new Date(r.preparing.startedAt).getTime() : 0
                            const elapsed = started ? (Date.now() - started) / 1000 : 0
                            const eta = r.preparing?.etaSeconds || 60
                            const remain = Math.max(0, Math.ceil(eta - elapsed))
                            return `~${Math.max(1, Math.ceil(remain / 60))}m`
                          })()}
                        </Text>
                      </InlineStack>
                      {(() => {
                        const pct =
                          typeof r.preparing?.pct === 'number'
                            ? Math.max(0, Math.min(100, Math.round(r.preparing.pct)))
                            : (() => {
                                const started = r.preparing?.startedAt
                                  ? new Date(r.preparing.startedAt).getTime()
                                  : Date.now()
                                const elapsed = (Date.now() - started) / 1000
                                const eta = r.preparing?.etaSeconds || 60
                                return Math.max(5, Math.min(95, Math.round((elapsed / Math.max(eta, 30)) * 100)))
                              })()
                        return <ProgressBar progress={pct} size="small" />
                      })()}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <IndexTable
          resourceName={resourceName}
          itemCount={rows.length}
          condensed={false}
          selectable
          selectedItemsCount={selected.length}
          onSelectionChange={selection => {
            // selection can be 'all' or an array of ids
            if (selection === 'all') {
              setSelected(rows.map(r => r.templateId))
            } else if (Array.isArray(selection)) {
              setSelected(selection as string[])
            } else {
              setSelected([])
            }
          }}
          bulkActions={[
            {
              content: 'Delete selected',
              onAction: () => bulkDelete(selected),
            },
          ]}
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
              <IndexTable.Row
                id={r.templateId}
                key={r.templateId}
                position={index}
                selected={selected.includes(r.templateId)}
              >
                <IndexTable.Cell>
                  <Link url={`/app/imports/${r.templateId}${location.search}`}>{r.name || r.templateId}</Link>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  {r.preparing ? (
                    <div>
                      <InlineStack gap="200" align="space-between">
                        <Text as="span">{`Preparing…${r.preparing.phase ? ` ${r.preparing.phase}` : ''}`}</Text>
                        <Text as="span" tone="subdued">
                          {(() => {
                            const started = r.preparing?.startedAt ? new Date(r.preparing.startedAt).getTime() : 0
                            const elapsed = started ? (Date.now() - started) / 1000 : 0
                            const eta = r.preparing?.etaSeconds || 60
                            const remain = Math.max(0, Math.ceil(eta - elapsed))
                            return `~${Math.max(1, Math.ceil(remain / 60))}m`
                          })()}
                        </Text>
                      </InlineStack>
                      {(() => {
                        const pct =
                          typeof r.preparing?.pct === 'number'
                            ? Math.max(0, Math.min(100, Math.round(r.preparing.pct)))
                            : (() => {
                                const started = r.preparing?.startedAt
                                  ? new Date(r.preparing.startedAt).getTime()
                                  : Date.now()
                                const elapsed = (Date.now() - started) / 1000
                                const eta = r.preparing?.etaSeconds || 60
                                return Math.max(5, Math.min(95, Math.round((elapsed / Math.max(eta, 30)) * 100)))
                              })()
                        return <ProgressBar progress={pct} size="small" />
                      })()}
                    </div>
                  ) : (
                    <ImportRowStateBadge state={r.state} />
                  )}
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" tone="subdued">
                    {r.state === ImportState.SCHEDULED ? nextRun : '—'}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <ButtonGroup>
                    {/* Simplified: only inline schedule toggle when eligible; link in Name cell opens Settings */}
                    {r.state === ImportState.APPROVED || r.state === ImportState.SCHEDULED ? (
                      <Button loading={isBusy} onClick={() => toggleSchedule(r, r.state !== ImportState.SCHEDULED)}>
                        {r.state === ImportState.SCHEDULED ? 'Disable schedule' : 'Enable schedule'}
                      </Button>
                    ) : null}
                    {r.runId ? (
                      <Link url={`/app/imports/runs/${encodeURIComponent(r.runId)}/review${location.search}`}>
                        View last run
                      </Link>
                    ) : null}
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
