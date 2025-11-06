import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, IndexTable, InlineStack, Text, Banner, Spinner } from '@shopify/polaris'

export default function RecentImportRuns() {
  type RunRow = {
    id: string
    supplierId: string
    startedAt: string
    finishedAt?: string | null
    status: string
    summary?: unknown
  }
  type DebugRow = { id: string; type: string; at: string; payload?: unknown }
  const [runs, setRuns] = useState<RunRow[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [debugCache, setDebugCache] = useState<
    Record<
      string,
      {
        loading: boolean
        error?: string
        logs: DebugRow[]
        publish: unknown[]
        rawLoading?: boolean
        rawError?: string
        raw?: unknown
      }
    >
  >({})

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const r = await fetch('/api/importer/runs?take=50', { headers: { 'Cache-Control': 'no-store' } })
        if (!r.ok) return
        const j = (await r.json()) as { ok: boolean; runs?: RunRow[] }
        if (!active) return
        setRuns(Array.isArray(j.runs) ? j.runs : [])
      } catch {
        /* ignore */
      }
    }
    load()
    const poll = setInterval(load, 8000)
    return () => {
      active = false
      clearInterval(poll)
    }
  }, [])

  const headings = useMemo(() => {
    return [
      { title: 'Run' },
      { title: 'Supplier' },
      { title: 'Started' },
      { title: 'Status' },
      { title: 'Summary' },
      { title: 'Details' },
    ]
  }, []) as unknown as [{ title: string }, ...Array<{ title: string }>]

  const rel = (iso?: string | null) => {
    if (!iso) return '—'
    try {
      const t = Date.parse(iso)
      const d = Math.max(0, Math.floor((Date.now() - t) / 1000))
      if (d < 60) return `${d}s ago`
      const m = Math.floor(d / 60)
      if (m < 60) return `${m}m ago`
      const h = Math.floor(m / 60)
      return `${h}h ago`
    } catch {
      return iso || '—'
    }
  }

  async function toggleExpand(runId: string) {
    setExpanded(prev => ({ ...prev, [runId]: !prev[runId] }))
    // Lazy fetch debug data on first expand
    setDebugCache(prev => (prev[runId] ? prev : { ...prev, [runId]: { loading: true, logs: [], publish: [] } }))
    if (!debugCache[runId]) {
      try {
        const r = await fetch(`/api/importer/runs/${encodeURIComponent(runId)}/debug?hq=1`, {
          headers: { 'Cache-Control': 'no-store' },
        })
        if (!r.ok) {
          const msg = `Failed to load debug (${r.status})`
          setDebugCache(prev => ({ ...prev, [runId]: { loading: false, error: msg, logs: [], publish: [] } }))
          return
        }
        const j = (await r.json()) as {
          logs?: DebugRow[]
          publish?: unknown[]
          error?: string
          step?: string
          source?: string
          ok?: boolean
          note?: string
          prismaError?: string
        }
        if (j && j.error) {
          const step = j.step || j.source || 'debug'
          const note = j.note
          const prismaError = j.prismaError
          const msg = [
            j.error,
            step ? `(step: ${step})` : '',
            note ? `note: ${note}` : '',
            prismaError ? `prisma: ${prismaError}` : '',
          ]
            .filter(Boolean)
            .join(' ')
          setDebugCache(prev => ({ ...prev, [runId]: { loading: false, error: msg, logs: [], publish: [] } }))
          return
        }
        setDebugCache(prev => ({
          ...prev,
          [runId]: { loading: false, logs: j.logs || [], publish: (j.publish as unknown[]) || [] },
        }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error'
        setDebugCache(prev => ({ ...prev, [runId]: { loading: false, error: msg, logs: [], publish: [] } }))
      }
    }
  }

  const summarize = (summary?: unknown) => {
    try {
      const s = summary && typeof summary === 'object' ? (summary as Record<string, unknown>) : {}
      const counts = (s.counts as Record<string, number>) || {}
      const publish =
        (s.publish as { totals?: { created: number; updated: number; skipped: number; failed: number } }) || {}
      const parts: string[] = []
      const totalStaged =
        counts.adds || counts.changes || counts.nochanges || counts.deletes
          ? (counts.adds || 0) + (counts.changes || 0) + (counts.nochanges || 0) + (counts.deletes || 0)
          : 0
      if (totalStaged) parts.push(`${totalStaged} staged`)
      if (publish?.totals) {
        const t = publish.totals
        parts.push(`pub C${t.created}/U${t.updated}/S${t.skipped}/F${t.failed}`)
      }
      return parts.length ? parts.join(' • ') : '—'
    } catch {
      return '—'
    }
  }

  return (
    <Card>
      <IndexTable resourceName={{ singular: 'run', plural: 'runs' }} itemCount={runs.length} headings={headings}>
        {runs.map((r, index) => {
          const isOpen = !!expanded[r.id]
          const dbg = debugCache[r.id]
          return (
            <IndexTable.Row id={r.id} key={r.id} position={index} aria-expanded={isOpen}>
              <IndexTable.Cell>
                <Text as="span" tone="subdued" variant="bodySm">
                  {r.id}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Badge>{r.supplierId}</Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span" tone="subdued" variant="bodySm">
                  {rel(r.startedAt)}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Badge tone={r.status === 'published' ? 'success' : r.status === 'failed' ? 'critical' : undefined}>
                  {r.status}
                </Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span" tone="subdued" variant="bodySm">
                  {summarize(r.summary)}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <InlineStack gap="200">
                  <Button onClick={() => toggleExpand(r.id)} ariaExpanded={isOpen} ariaControls={`run-${r.id}-details`}>
                    {isOpen ? 'Hide' : 'View'}
                  </Button>
                </InlineStack>
                {isOpen ? (
                  <div id={`run-${r.id}-details`} style={{ marginTop: 8, maxHeight: 420, overflow: 'auto' }}>
                    {!dbg || dbg.loading ? (
                      <div style={{ padding: 8 }}>
                        <InlineStack gap="200" blockAlign="center">
                          <Spinner size="small" />
                          <Text as="span" tone="subdued" variant="bodySm">
                            Loading…
                          </Text>
                        </InlineStack>
                      </div>
                    ) : dbg.error ? (
                      <div>
                        <Banner tone="critical" title="Failed to load details">
                          <p style={{ margin: 0 }}>{dbg.error}</p>
                        </Banner>
                        <div style={{ marginTop: 8 }}>
                          {dbg.rawLoading ? (
                            <InlineStack gap="200" blockAlign="center">
                              <Spinner size="small" />
                              <Text as="span" tone="subdued" variant="bodySm">
                                Loading raw…
                              </Text>
                            </InlineStack>
                          ) : dbg.raw ? (
                            <div>
                              <Text as="h3" variant="headingSm">
                                Raw debug
                              </Text>
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                                {JSON.stringify(dbg.raw, null, 2)}
                              </pre>
                            </div>
                          ) : (
                            <InlineStack gap="200">
                              <Button
                                onClick={async () => {
                                  setDebugCache(prev => ({
                                    ...prev,
                                    [r.id]: {
                                      ...(prev[r.id] || { loading: false, logs: [], publish: [] }),
                                      rawLoading: true,
                                      rawError: undefined,
                                    },
                                  }))
                                  try {
                                    const rr = await fetch(
                                      `/api/importer/runs/${encodeURIComponent(r.id)}/debug/raw?hq=1`,
                                      { headers: { 'Cache-Control': 'no-store' } },
                                    )
                                    const rawJson = await rr.json()
                                    setDebugCache(prev => ({
                                      ...prev,
                                      [r.id]: {
                                        ...(prev[r.id] || { loading: false, logs: [], publish: [] }),
                                        rawLoading: false,
                                        raw: rawJson,
                                      },
                                    }))
                                  } catch (e) {
                                    const msg = e instanceof Error ? e.message : 'Network error'
                                    setDebugCache(prev => ({
                                      ...prev,
                                      [r.id]: {
                                        ...(prev[r.id] || { loading: false, logs: [], publish: [] }),
                                        rawLoading: false,
                                        rawError: msg,
                                      },
                                    }))
                                  }
                                }}
                              >
                                Load raw details
                              </Button>
                              {dbg.rawError ? (
                                <Text as="span" tone="critical" variant="bodySm">
                                  {dbg.rawError}
                                </Text>
                              ) : null}
                            </InlineStack>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Text as="h3" variant="headingSm">
                          Publish diagnostics
                        </Text>
                        <div style={{ margin: '8px 0' }}>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                            {JSON.stringify(dbg.publish || [], null, 2)}
                          </pre>
                        </div>
                        <Text as="h3" variant="headingSm">
                          Logs
                        </Text>
                        {(dbg.logs || []).map(row => (
                          <div
                            key={`${row.at}|${row.type}`}
                            style={{ padding: 8, borderBottom: '1px solid var(--p-color-border)' }}
                          >
                            <InlineStack gap="200" blockAlign="center">
                              <Text as="span" tone="subdued" variant="bodySm">
                                {new Date(row.at).toLocaleTimeString()}
                              </Text>
                              <Badge>{row.type}</Badge>
                            </InlineStack>
                            <div style={{ marginTop: 4 }}>
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                                {(() => {
                                  try {
                                    return JSON.stringify(row.payload ?? null, null, 2)
                                  } catch {
                                    return String(row.payload)
                                  }
                                })()}
                              </pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </IndexTable.Cell>
            </IndexTable.Row>
          )
        })}
      </IndexTable>
    </Card>
  )
}
