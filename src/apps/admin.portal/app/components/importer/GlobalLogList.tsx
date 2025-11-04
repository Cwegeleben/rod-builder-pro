// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { useEffect, useMemo, useState } from 'react'
import {
  Text,
  Badge,
  InlineStack,
  BlockStack,
  Box,
  Button,
  Filters,
  ChoiceList,
  Divider,
  Collapsible,
  IndexTable,
  Link,
  EmptyState,
} from '@shopify/polaris'
import { Modal } from '@shopify/polaris'

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
  const [logItems, setLogItems] = useState<LogRow[]>(items)
  const [hydrated, setHydrated] = useState(false)
  // Defer IndexTable rendering to client to avoid SSR/CSR mismatches in condensed mode
  useEffect(() => {
    setHydrated(true)
  }, [])
  const [filterType, setFilterType] = useState<
    'all' | 'prepare' | 'settings' | 'approve' | 'error' | 'discovery' | 'scrape' | 'schedule' | 'recrawl'
  >('all')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [past, setPast] = useState<'all' | '1h' | '24h' | '7d'>('all')
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const badge = (t: LogRow['type']) => {
    switch (t) {
      case 'discovery':
        return <Badge tone="info">discovery</Badge>
      case 'scrape':
        return <Badge tone="attention">scrape</Badge>
      case 'drafts':
        return <Badge>drafts</Badge>
      case 'approve':
      case 'APPROVED':
      case 'approved':
        return <Badge tone="success">approve</Badge>
      case 'abort':
        return <Badge tone="critical">abort</Badge>
      case 'schedule':
        return <Badge tone="info">schedule</Badge>
      case 'recrawl':
        return <Badge tone="attention">recrawl</Badge>
      case 'error':
        return <Badge tone="critical">error</Badge>
      case 'template:created':
        return <Badge tone="success">created</Badge>
      case 'settings:saved':
        return <Badge tone="info">settings</Badge>
      case 'prepare:start':
        return <Badge tone="info">prepare</Badge>
      case 'prepare:report':
        return <Badge tone="attention">progress</Badge>
      case 'prepare:done':
        return <Badge tone="success">prepared</Badge>
      case 'prepare:error':
        return <Badge tone="critical">prep error</Badge>
      default:
        return <Badge>{t}</Badge>
    }
  }

  if (!items.length) {
    return (
      <Box padding="200" borderWidth="025" borderColor="border" borderRadius="100">
        <EmptyState
          heading="No logs yet"
          action={{ content: 'Refresh', onAction: () => window.location.reload() }}
          secondaryAction={{
            content: 'Learn more',
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
    }
  }, [items])

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
      if (type === 'discovery' || type === 'scrape' || type === 'recrawl') {
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
    if (t === 'recrawl') return 'recrawl'
    return 'all'
  }

  // filter + group by templateId
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return logItems.filter(r => {
      if (filterType !== 'all' && typeCategory(r.type) !== filterType) return false
      if (!q) return true
      const hay = `${r.templateId} ${r.runId} ${r.type} ${payloadSnippet(r.payload) || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [logItems, filterType, query])

  const grouped = useMemo(() => {
    const g = new Map<string, LogRow[]>()
    for (const r of filtered) {
      if (!g.has(r.templateId)) g.set(r.templateId, [])
      g.get(r.templateId)!.push(r)
    }
    // sort each group desc by time
    for (const [k, arr] of g.entries()) {
      arr.sort((a, b) => (a.at > b.at ? -1 : 1))
      g.set(k, arr)
    }
    return g
  }, [filtered])

  return (
    <>
      {/* Controls */}
      <BlockStack gap="200">
        <Filters
          queryValue={query}
          onQueryChange={setQuery}
          onQueryClear={() => setQuery('')}
          onClearAll={() => {
            setQuery('')
            setFilterType('all')
            setPast('all')
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
          <InlineStack gap="200" align="end">
            <Button tone="critical" onClick={() => setDeleteOpen(true)} accessibilityLabel="Delete imports">
              Delete imports…
            </Button>
            <LiveControls
              onRefreshRequest={async () => {
                try {
                  const qs = new URLSearchParams()
                  if (past !== 'all') qs.set('since', past)
                  const r = await fetch(`/api/importer/logs?${qs.toString()}`)
                  if (r.ok) {
                    const j = (await r.json()) as { logs?: LogRow[] }
                    if (Array.isArray(j.logs)) setLogItems(j.logs)
                    // reset cursor based on newest batch
                    const last = j.logs && j.logs[j.logs.length - 1]
                    setCursor(last ? last.at : null)
                  }
                } catch {
                  // ignore
                }
              }}
              onLogs={rows => {
                if (Array.isArray(rows)) setLogItems(rows)
                const last = rows && rows[rows.length - 1]
                setCursor(last ? last.at : null)
              }}
            />
          </InlineStack>
        </Filters>
        <Divider />
        {/* Delete imports modal */}
        <DeleteImports open={deleteOpen} onClose={() => setDeleteOpen(false)} templates={templateNames} />
        {/* Active runs strip */}
        {(() => {
          const latestByRun = new Map<string, LogRow>()
          for (const l of logItems) {
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
        {[...grouped.entries()].map(([tpl, rows]) => {
          const resourceName = { singular: 'log', plural: 'logs' }
          const displayName = templateNames[tpl] || tpl
          return (
            <Box key={tpl} padding="200" borderWidth="025" borderColor="border" borderRadius="100">
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <InlineStack gap="200">
                    <Text as="h3" variant="headingSm">
                      template {displayName}
                    </Text>
                    {displayName !== tpl ? (
                      <Text as="span" tone="subdued" variant="bodySm">
                        ({tpl})
                      </Text>
                    ) : null}
                    <Badge>{String(rows.length)}</Badge>
                  </InlineStack>
                </InlineStack>
                {/* Render the table only after mount to avoid SSR/CSR markup mismatches in condensed layouts */}
                {!hydrated ? null : (
                  <IndexTable
                    resourceName={resourceName}
                    itemCount={rows.length}
                    selectable={false}
                    condensed
                    headings={[
                      { title: 'When' },
                      { title: 'Type' },
                      { title: 'Run' },
                      { title: 'Summary' },
                      { title: 'Actions' },
                    ]}
                  >
                    {rows.map((r, i) => {
                      const key = `${r.at}|${r.type}|${r.runId}`
                      const isOpen = !!expanded[key]
                      return (
                        <IndexTable.Row id={key} key={key} position={i}>
                          <IndexTable.Cell>
                            <Text as="span" tone="subdued">
                              {rel(r.at)}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>{badge(r.type)}</IndexTable.Cell>
                          <IndexTable.Cell>
                            <InlineStack gap="100" align="start">
                              <Text as="span" tone="subdued">
                                run
                              </Text>
                              <Link url={`/app/imports/runs/${r.runId}/review`}>{r.runId}</Link>
                            </InlineStack>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <BlockStack gap="100">
                              <Text as="span" tone="subdued" variant="bodySm">
                                {summarize(r.type, r.payload) ?? ''}
                              </Text>
                              <Collapsible open={isOpen} id={`log-${i}`}>
                                <div style={{ maxHeight: 360, overflow: 'auto', marginTop: 8 }}>
                                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>
                                    {JSON.stringify(r.payload ?? null, null, 2)}
                                  </pre>
                                </div>
                              </Collapsible>
                            </BlockStack>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Button
                              accessibilityLabel="Toggle details"
                              onClick={() => setExpanded(cur => ({ ...cur, [key]: !cur[key] }))}
                            >
                              {isOpen ? 'Hide' : 'Details'}
                            </Button>
                            <Button
                              variant="plain"
                              accessibilityLabel="Copy payload"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(JSON.stringify(r.payload ?? null, null, 2))
                                } catch {
                                  // ignore
                                }
                              }}
                            >
                              Copy
                            </Button>
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
                            setLogItems(cur => [...cur, ...j.logs!])
                            const last = j.logs[j.logs.length - 1]
                            setCursor(last ? last.at : cursor)
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
              </BlockStack>
            </Box>
          )
        })}
        {grouped.size === 0 ? (
          <Text as="p" tone="subdued">
            No logs match your filters.
          </Text>
        ) : null}
      </BlockStack>
    </>
  )
}

// Lightweight live controls component embedded to keep the parent clean
function LiveControls({
  onRefreshRequest,
  onLogs,
}: {
  onRefreshRequest?: () => void
  onLogs?: (rows: LogRow[]) => void
}) {
  const [live, setLive] = useState(false)
  const [connected, setConnected] = useState(false)

  // Manage EventSource lifecycle
  useMemo(() => {
    let es: EventSource | null = null
    if (live) {
      try {
        es = new EventSource('/api/importer/logs/stream')
        es.onopen = () => setConnected(true)
        es.onerror = () => setConnected(false)
        es.onmessage = ev => {
          try {
            const data = JSON.parse(ev.data)
            if (Array.isArray(data?.logs)) onLogs?.(data.logs as LogRow[])
          } catch {
            // ignore
          }
        }
      } catch {
        setConnected(false)
      }
    }
    return () => {
      if (es) es.close()
      setConnected(false)
    }
  }, [live])

  return (
    <InlineStack gap="200" align="end">
      <Button pressed={live} onClick={() => setLive(v => !v)}>
        {live ? (connected ? 'Live (on)' : 'Live (reconnecting)') : 'Live'}
      </Button>
      <Button onClick={() => onRefreshRequest?.()}>Refresh</Button>
    </InlineStack>
  )
}

function DeleteImports({
  open,
  onClose,
  templates,
}: {
  open: boolean
  onClose: () => void
  templates: Record<string, string>
}) {
  const [selected, setSelected] = useState<string[]>([])
  const options = useMemo(
    () => Object.entries(templates).map(([id, name]) => ({ label: name, value: id })),
    [templates],
  )
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete imports"
      primaryAction={{
        content: 'Delete',
        destructive: true,
        onAction: async () => {
          if (!selected.length) return onClose()
          try {
            await fetch('/api/importer/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ templateIds: selected }),
            })
          } catch {
            // ignore
          } finally {
            onClose()
            // reload to reflect updated list/logs
            try {
              window.location.reload()
            } catch {
              // ignore reload errors
            }
          }
        },
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="200">
          <Text as="p">
            Select the imports to delete. This will remove their settings, logs, and any staged items for their
            supplier.
          </Text>
          <ChoiceList
            allowMultiple
            title="Imports"
            titleHidden
            choices={options}
            selected={selected}
            onChange={vals => setSelected(vals as string[])}
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
