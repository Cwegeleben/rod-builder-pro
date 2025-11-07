// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from '@remix-run/react'
import {
  Text,
  Badge,
  InlineStack,
  BlockStack,
  Box,
  Filters,
  ChoiceList,
  Divider,
  IndexTable,
  Link,
  EmptyState,
  TextField,
  Button,
} from '@shopify/polaris'

type LogRow = {
  at: string
  templateId: string
  runId: string
  type: string
  payload?: unknown
}

export default function GlobalLogList({
  items = [],
  templateNames = {},
}: {
  items?: LogRow[]
  templateNames?: Record<string, string>
}) {
  // Enable Polaris IndexTable; keep client-only hydration to avoid SSR/CSR condensed mode mismatches
  const DISABLE_INDEXTABLE = false
  const [logItems, setLogItems] = useState<LogRow[]>(items)
  const [hydrated, setHydrated] = useState(false)
  // Defer IndexTable rendering to client to avoid SSR/CSR mismatches in condensed mode
  useEffect(() => {
    setHydrated(true)
  }, [])
  const [filterType, setFilterType] = useState<
    'all' | 'prepare' | 'settings' | 'approve' | 'error' | 'discovery' | 'scrape' | 'schedule' | 'recrawl'
  >('all')
  // free-text search removed; only keep structured filters
  const [past, setPast] = useState<'all' | '1h' | '24h' | '7d'>('all')
  const [filterImport, setFilterImport] = useState<'all' | string>('all')
  const [runIdFilter, setRunIdFilter] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const location = useLocation()
  const [live] = useState(true)

  // Map raw type -> high-level level badge
  const levelForType = (
    t: string,
  ): { tone: 'success' | 'critical' | 'attention' | 'warning' | 'info'; label: string } => {
    if (t === 'error' || t.endsWith(':error') || t === 'abort') return { tone: 'critical', label: 'error' }
    if (t === 'approve' || t === 'APPROVED' || t === 'approved' || t === 'template:created' || t === 'prepare:done')
      return { tone: 'success', label: 'success' }
    if (t === 'scrape' || t === 'recrawl' || t.startsWith('recrawl:') || t === 'prepare:report')
      return { tone: 'attention', label: 'progress' }
    if (t === 'schedule') return { tone: 'warning', label: 'scheduled' }
    // Default informational
    return { tone: 'info', label: 'info' }
  }
  const levelBadge = (t: LogRow['type']) => {
    const { tone, label } = levelForType(t)
    return <Badge tone={tone}>{label}</Badge>
  }

  if (!items.length) {
    return (
      <Box padding="200" borderWidth="025" borderColor="border" borderRadius="100">
        <EmptyState
          heading="No logs yet"
          secondaryAction={{
            content: 'IndexTable docs',
            url: 'https://polaris.shopify.com/components/data-display/index-table',
          }}
          image="https://cdn.shopify.com/shopifycloud/web/assets/v1/empty-state-illustration-2e6f7b2a1aa1b7a2c0a7b826fbc7f3b2b7d827f1b5a89e.svg"
        >
          <p>Activity from prepare, crawl, review, and publish will appear here.</p>
        </EmptyState>
      </Box>
    )
  }
  // Keep internal state in sync on first mount or when parent sends new items
  // (We do not override while live updates are flowing; parent generally only seeds initial list.)
  useMemo(() => {
    if (Array.isArray(items) && items.length && logItems.length === 0) {
      setLogItems(items)
      try {
        const last = items[items.length - 1]
        setCursor(last ? last.at : null)
      } catch {
        // ignore
      }
    }
  }, [items])

  // Silent SSE stream: auto-merge latest logs in background when live enabled
  useEffect(() => {
    if (!live) return
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/importer/logs/stream')
      es.onmessage = ev => {
        try {
          const data = JSON.parse(ev.data || '{}') as { logs?: LogRow[] }
          if (Array.isArray(data.logs) && data.logs.length) {
            setLogItems(cur => mergeLogs(cur, data.logs!))
          }
        } catch {
          // ignore malformed
        }
      }
      es.onerror = () => {
        // Let the browser retry automatically; if it closes, we fallback silently
      }
    } catch {
      // SSE not supported; ignore
    }
    return () => {
      try {
        es?.close()
      } catch {
        /* noop */
      }
    }
  }, [live])

  // Read initial filters from URL on mount (client only)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const sp = new URLSearchParams(window.location.search || '')
      const t = sp.get('type') as typeof filterType | null
      const imp = sp.get('import')
      const run = sp.get('run')
      const p = sp.get('past') as typeof past | null
      // (query removed)
      if (
        t &&
        ['all', 'prepare', 'settings', 'approve', 'discovery', 'scrape', 'schedule', 'recrawl', 'error'].includes(t)
      )
        setFilterType(t)
      if (imp) setFilterImport(imp as 'all' | string)
      if (run) setRunIdFilter(run)
      if (p && ['all', '1h', '24h', '7d'].includes(p)) setPast(p)
    } catch {
      // ignore
    }
  }, [])

  // Persist filters to URL (replaceState) on change
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const sp = new URLSearchParams(window.location.search || '')
      const setOrDel = (k: string, v: string | null | undefined) => {
        if (v && v !== 'all' && v !== '') sp.set(k, v)
        else sp.delete(k)
      }
      setOrDel('type', filterType)
      setOrDel('import', filterImport)
      setOrDel('run', runIdFilter)
      setOrDel('past', past)
      // query removed from persistence
      const qs = sp.toString()
      const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`
      if (next !== `${window.location.pathname}${window.location.search}`) {
        window.history.replaceState(null, '', next)
      }
    } catch {
      // ignore history failures
    }
  }, [filterType, filterImport, runIdFilter, past])

  // compact JSON preview for row
  const payloadSnippet = (payload: unknown): string | null => {
    try {
      if (payload == null) return null
      const str = JSON.stringify(payload)
      return str.length > 160 ? str.slice(0, 157) + '…' : str
    } catch {
      return null
    }
  }

  // extract a human-friendly summary based on common payload shapes
  const summarize = (type: string, payload: unknown): string | null => {
    try {
      const p = (payload ?? {}) as Record<string, unknown>
      const num = (v: unknown) => (typeof v === 'number' ? (v as number) : undefined)
      const str = (v: unknown) => (typeof v === 'string' ? (v as string) : undefined)
      if (type === 'prepare:start') {
        const c = num(p['candidates']) ?? num(p['c'])
        const exp = num(p['expectedItems']) ?? num(p['exp'])
        const eta = num(p['eta']) ?? num(p['etaSeconds'])
        const parts: string[] = []
        if (Number.isFinite(c)) parts.push(`${c} candidates`)
        if (Number.isFinite(exp)) parts.push(`~${exp} expected`)
        if (typeof eta === 'number' && Number.isFinite(eta)) parts.push(`ETA ~${Math.max(0, Math.round(eta / 60))}m`)
        return parts.length ? parts.join(' • ') : null
      }
      if (type === 'prepare:report') {
        const done = num(p['done']) ?? num(p['completed'])
        const total = num(p['total']) ?? num(p['expected'])
        const adds = num(p['adds']) ?? num(p['staged'])
        const errs = num(p['errors']) ?? num(p['errs'])
        const bits: string[] = []
        if (Number.isFinite(done) && Number.isFinite(total)) bits.push(`${done}/${total}`)
        if (Number.isFinite(adds)) bits.push(`${adds} staged`)
        if (typeof errs === 'number' && Number.isFinite(errs) && errs > 0) bits.push(`${errs} errors`)
        return bits.length ? bits.join(' • ') : null
      }
      if (type === 'prepare:done') {
        const adds = num(p['adds']) ?? num(p['staged']) ?? num(p['count'])
        const runTime = num(p['elapsed']) ?? num(p['runtime'])
        const parts: string[] = []
        if (Number.isFinite(adds)) parts.push(`${adds} staged`)
        if (typeof runTime === 'number' && Number.isFinite(runTime)) parts.push(`${Math.round(runTime)}s`)
        return parts.length ? parts.join(' • ') : null
      }
      if (type === 'approve' || type === 'APPROVED' || type === 'approved') {
        const published = num(p['published']) ?? num(p['ok'])
        const failed = num(p['failed']) ?? num(p['errors'])
        const parts: string[] = []
        if (Number.isFinite(published)) parts.push(`${published} published`)
        if (typeof failed === 'number' && Number.isFinite(failed) && failed > 0) parts.push(`${failed} failed`)
        return parts.length ? parts.join(' • ') : null
      }
      if (type === 'error' || type.endsWith(':error')) {
        return str((p as Record<string, unknown>)['message']) ?? payloadSnippet(payload)
      }
      if (type === 'crawl:headers') {
        const count = num(p['count'])
        return Number.isFinite(count) ? `headers: ${count}` : 'headers'
      }
      if (type === 'discovery' || type === 'scrape' || type === 'recrawl' || type.startsWith('recrawl:')) {
        const u = str(p['url']) ?? str(p['seed']) ?? str(p['source'])
        return u ?? payloadSnippet(payload)
      }
      if (type === 'settings:saved') {
        const changed = p['changed'] as unknown as unknown[] | undefined
        const k = Array.isArray(changed) ? (changed as unknown[]).join(', ') : undefined
        return k ? `updated: ${k}` : null
      }
      return payloadSnippet(payload)
    } catch {
      return payloadSnippet(payload)
    }
  }

  // relative time helper
  const rel = (iso: string) => {
    try {
      const ts = new Date(iso).getTime()
      const d = Math.max(0, Date.now() - ts)
      const s = Math.floor(d / 1000)
      if (s < 60) return `${s}s ago`
      const m = Math.floor(s / 60)
      if (m < 60) return `${m}m ago`
      const h = Math.floor(m / 60)
      if (h < 24) return `${h}h ago`
      const days = Math.floor(h / 24)
      return `${days}d ago`
    } catch {
      return iso
    }
  }

  // map raw types into high-level categories for filtering
  const typeCategory = (t: string): typeof filterType => {
    if (t.startsWith('prepare:')) return 'prepare'
    if (t === 'settings:saved') return 'settings'
    if (t === 'approve' || t === 'APPROVED' || t === 'approved') return 'approve'
    if (t === 'error' || t.endsWith(':error')) return 'error'
    if (t === 'discovery') return 'discovery'
    if (t === 'scrape') return 'scrape'
    if (t === 'schedule') return 'schedule'
    if (t === 'recrawl' || t.startsWith('recrawl:')) return 'recrawl'
    return 'all'
  }

  // filter rows (flat list)
  const filtered = useMemo(() => {
    return logItems.filter(r => {
      if (filterType !== 'all' && typeCategory(r.type) !== filterType) return false
      if (filterImport !== 'all' && r.templateId !== filterImport) return false
      if (runIdFilter && !r.runId.toLowerCase().includes(runIdFilter.trim().toLowerCase())) return false
      return true
    })
  }, [logItems, filterType, filterImport, runIdFilter])
  // newest -> oldest
  const rows = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => (a.at > b.at ? -1 : 1))
    return arr
  }, [filtered])

  // Determine active runs: latest log per run is a prepare:* that is not done/error
  const activeRunIds = useMemo(() => {
    const latest = new Map<string, LogRow>()
    for (const l of logItems) {
      const prev = latest.get(l.runId)
      if (!prev || prev.at < l.at) latest.set(l.runId, l)
    }
    const set = new Set<string>()
    for (const [rid, row] of latest.entries()) {
      if (row.type.startsWith('prepare:') && row.type !== 'prepare:done' && row.type !== 'prepare:error') {
        set.add(rid)
      }
    }
    return set
  }, [logItems])

  return (
    <>
      {/* Controls (search/delete removed; keep structured filters). Live SSE runs silently. */}
      <BlockStack gap="200">
        <Filters
          queryValue=""
          onQueryChange={() => {}}
          onQueryClear={() => {}}
          onClearAll={() => {
            setFilterType('all')
            setPast('all')
            setFilterImport('all')
            setRunIdFilter('')
          }}
          filters={[
            {
              key: 'type',
              label: 'Type',
              filter: (
                <ChoiceList
                  title="Type"
                  titleHidden
                  choices={[
                    { label: 'All', value: 'all' },
                    { label: 'Prepare', value: 'prepare' },
                    { label: 'Settings', value: 'settings' },
                    { label: 'Approve', value: 'approve' },
                    { label: 'Discovery', value: 'discovery' },
                    { label: 'Scrape', value: 'scrape' },
                    { label: 'Schedule', value: 'schedule' },
                    { label: 'Recrawl', value: 'recrawl' },
                    { label: 'Errors', value: 'error' },
                  ]}
                  selected={[filterType]}
                  onChange={vals => setFilterType((vals[0] as typeof filterType) || 'all')}
                  allowMultiple={false}
                />
              ),
            },
            {
              key: 'import',
              label: 'Import',
              filter: (
                <ChoiceList
                  title="Import"
                  titleHidden
                  choices={[
                    { label: 'All', value: 'all' },
                    ...Object.entries(templateNames).map(([id, name]) => ({ label: name || id, value: id })),
                  ]}
                  selected={[filterImport]}
                  onChange={vals => setFilterImport(((vals[0] as string) || 'all') as 'all' | string)}
                  allowMultiple={false}
                />
              ),
            },
            {
              key: 'run',
              label: 'Run ID',
              filter: (
                <TextField
                  label="Run ID"
                  labelHidden
                  value={runIdFilter}
                  onChange={setRunIdFilter}
                  autoComplete="off"
                  placeholder="Filter by run id"
                />
              ),
            },
            {
              key: 'past',
              label: 'Past',
              filter: (
                <ChoiceList
                  title="Past"
                  titleHidden
                  choices={[
                    { label: 'All', value: 'all' },
                    { label: '1h', value: '1h' },
                    { label: '24h', value: '24h' },
                    { label: '7d', value: '7d' },
                  ]}
                  selected={[past]}
                  onChange={vals => setPast((vals[0] as typeof past) || 'all')}
                  allowMultiple={false}
                />
              ),
            },
          ]}
          appliedFilters={
            filterType !== 'all'
              ? [
                  {
                    key: 'type',
                    label: `Type: ${filterType}`,
                    onRemove: () => setFilterType('all'),
                  },
                  ...(filterImport !== 'all'
                    ? [
                        {
                          key: 'import',
                          label: `Import: ${templateNames[filterImport] || filterImport}`,
                          onRemove: () => setFilterImport('all'),
                        },
                      ]
                    : []),
                  ...(runIdFilter
                    ? [
                        {
                          key: 'run',
                          label: `Run: ${runIdFilter}`,
                          onRemove: () => setRunIdFilter(''),
                        },
                      ]
                    : []),
                  ...(past !== 'all'
                    ? [
                        {
                          key: 'past',
                          label: `Past: ${past}`,
                          onRemove: () => setPast('all'),
                        },
                      ]
                    : []),
                ]
              : past !== 'all'
                ? [
                    {
                      key: 'past',
                      label: `Past: ${past}`,
                      onRemove: () => setPast('all'),
                    },
                  ]
                : []
          }
        >
          <InlineStack gap="200" align="end" />
        </Filters>
        <Divider />
        {/* Delete imports modal removed (per-import delete moved to settings page) */}
        {/* Active runs strip */}
        {(() => {
          const latestByRun = new Map<string, LogRow>()
          for (const l of rows) {
            const prev = latestByRun.get(l.runId)
            if (!prev || prev.at < l.at) latestByRun.set(l.runId, l)
          }
          const actives = [...latestByRun.values()].filter(
            x => x.type.startsWith('prepare:') && x.type !== 'prepare:done' && x.type !== 'prepare:error',
          )
          if (!actives.length) return null
          return (
            <Box padding="150" borderWidth="025" borderColor="border" borderRadius="050">
              <InlineStack gap="300" align="start">
                <Text as="h3" variant="headingSm">
                  Active runs
                </Text>
                {actives.slice(0, 6).map(a => (
                  <InlineStack key={a.runId} gap="150" align="center">
                    <Badge>{templateNames[a.templateId] || a.templateId}</Badge>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {a.runId}
                    </Text>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {rel(a.at)}
                    </Text>
                  </InlineStack>
                ))}
                {actives.length > 6 ? (
                  <Text as="span" tone="subdued" variant="bodySm">
                    +{actives.length - 6} more
                  </Text>
                ) : null}
              </InlineStack>
            </Box>
          )
        })()}
        {/* Flat logs table/list */}
        {!hydrated ? null : DISABLE_INDEXTABLE ? (
          <BlockStack gap="150">
            {rows.map(r => {
              const key = `${r.at}|${r.type}|${r.runId}`
              const displayName = templateNames[r.templateId] || r.templateId
              return (
                <Box key={key} padding="200" borderWidth="025" borderColor="border" borderRadius="050">
                  <InlineStack align="space-between" blockAlign="start">
                    <InlineStack gap="200" blockAlign="center">
                      <span title={new Date(r.at).toLocaleString()}>
                        <Text as="span" tone="subdued">
                          {rel(r.at)}
                        </Text>
                      </span>
                      {levelBadge(r.type)}
                      <InlineStack gap="100" align="start">
                        <Link url={`/app/imports/${r.templateId}${location.search}`}>
                          <Badge>{displayName}</Badge>
                        </Link>
                        <Text as="span" tone="subdued">
                          run
                        </Text>
                        <Link url={`/app/imports/runs/${r.runId}/review${location.search}`}>{r.runId}</Link>
                        {activeRunIds.has(r.runId) ? <Badge tone="attention">live</Badge> : null}
                      </InlineStack>
                    </InlineStack>
                  </InlineStack>
                  <Box paddingBlockStart="100">
                    <Text as="span" tone="subdued" variant="bodySm">
                      {summarize(r.type, r.payload) ?? ''}
                    </Text>
                  </Box>
                </Box>
              )
            })}
          </BlockStack>
        ) : (
          <IndexTable
            resourceName={{ singular: 'log', plural: 'logs' }}
            itemCount={rows.length}
            selectable={false}
            condensed
            headings={[
              { title: 'When' },
              { title: 'Level' },
              { title: 'Import' },
              { title: 'Run' },
              { title: 'Message' },
            ]}
          >
            {rows.map((r, i) => {
              const key = `${r.at}|${r.type}|${r.runId}`
              const displayName = templateNames[r.templateId] || r.templateId
              return (
                <IndexTable.Row id={key} key={key} position={i}>
                  <IndexTable.Cell>
                    <span title={new Date(r.at).toLocaleString()}>
                      <Text as="span" tone="subdued">
                        {rel(r.at)}
                      </Text>
                    </span>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{levelBadge(r.type)}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="150" blockAlign="center">
                      <Link url={`/app/imports/${r.templateId}${location.search}`}>
                        <Badge>{displayName}</Badge>
                      </Link>
                      {displayName !== r.templateId ? (
                        <Link url={`/app/imports/${r.templateId}${location.search}`}>
                          <Text as="span" tone="subdued" variant="bodySm">
                            ({r.templateId})
                          </Text>
                        </Link>
                      ) : null}
                    </InlineStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="100" align="start">
                      <Text as="span" tone="subdued">
                        run
                      </Text>
                      <Link url={`/app/imports/runs/${r.runId}/review${location.search}`}>{r.runId}</Link>
                      {activeRunIds.has(r.runId) ? <Badge tone="attention">live</Badge> : null}
                    </InlineStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <BlockStack gap="100">
                      <Text as="span" tone="subdued" variant="bodySm">
                        {summarize(r.type, r.payload) ?? ''}
                      </Text>
                    </BlockStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              )
            })}
          </IndexTable>
        )}
        {/* Load older */}
        <InlineStack align="center">
          <Button
            loading={loadingMore}
            disabled={!cursor || loadingMore}
            onClick={async () => {
              if (!cursor) return
              setLoadingMore(true)
              try {
                const qs = new URLSearchParams()
                qs.set('before', cursor)
                if (past !== 'all') qs.set('since', past)
                const r = await fetch(`/api/importer/logs?${qs.toString()}`)
                if (r.ok) {
                  const j = (await r.json()) as { logs?: LogRow[] }
                  if (Array.isArray(j.logs) && j.logs.length) {
                    setLogItems(cur => {
                      const next = mergeLogs(cur, j.logs as LogRow[])
                      const oldest = next[next.length - 1]
                      setCursor(oldest ? oldest.at : cursor)
                      return next
                    })
                  }
                }
              } catch {
                // ignore
              } finally {
                setLoadingMore(false)
              }
            }}
          >
            Load older
          </Button>
        </InlineStack>
        {rows.length === 0 ? (
          <Text as="p" tone="subdued">
            No logs match your filters.
          </Text>
        ) : null}
      </BlockStack>
    </>
  )
}

// Merge helper: dedupe by composite key and sort newest->oldest
function mergeLogs(a: LogRow[], b: LogRow[]): LogRow[] {
  const out: LogRow[] = []
  const seen = new Set<string>()
  const add = (r: LogRow) => {
    const k = `${r.at}|${r.type}|${r.runId}|${r.templateId}`
    if (seen.has(k)) return
    seen.add(k)
    out.push(r)
  }
  for (const r of a) add(r)
  for (const r of b) add(r)
  out.sort((x, y) => (x.at > y.at ? -1 : 1))
  return out
}

// Live streaming & bulk delete UI removed
// <!-- END RBP GENERATED: importer-v2-3 -->
