// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { useMemo, useState } from 'react'
import {
  Text,
  Badge,
  InlineStack,
  BlockStack,
  Box,
  Button,
  TextField,
  ButtonGroup,
  Divider,
  Collapsible,
  IndexTable,
  Link,
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
  const [logItems, setLogItems] = useState<LogRow[]>(items)
  const [filterType, setFilterType] = useState<
    'all' | 'prepare' | 'settings' | 'approve' | 'error' | 'discovery' | 'scrape' | 'schedule' | 'recrawl'
  >('all')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

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
      <Text as="p" tone="subdued">
        No logs yet.
      </Text>
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
        <InlineStack align="space-between">
          <ButtonGroup>
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'prepare', label: 'Prepare' },
                { key: 'settings', label: 'Settings' },
                { key: 'approve', label: 'Approve' },
                { key: 'discovery', label: 'Discovery' },
                { key: 'scrape', label: 'Scrape' },
                { key: 'schedule', label: 'Schedule' },
                { key: 'recrawl', label: 'Recrawl' },
                { key: 'error', label: 'Errors' },
              ] as Array<{ key: typeof filterType; label: string }>
            ).map(btn => (
              <Button
                key={btn.key}
                pressed={filterType === (btn.key as typeof filterType)}
                onClick={() => setFilterType(btn.key as typeof filterType)}
              >
                {btn.label}
              </Button>
            ))}
          </ButtonGroup>
          <InlineStack gap="200" align="end">
            <div style={{ minWidth: 260 }}>
              <TextField
                label="Search"
                labelHidden
                value={query}
                onChange={setQuery}
                placeholder="Filter by template, run, type, payload"
                autoComplete="off"
              />
            </div>
            <LiveControls
              onRefreshRequest={async () => {
                try {
                  const r = await fetch('/api/importer/logs')
                  if (r.ok) {
                    const j = (await r.json()) as { logs?: LogRow[] }
                    if (Array.isArray(j.logs)) setLogItems(j.logs)
                  }
                } catch {
                  // ignore
                }
              }}
              onLogs={rows => {
                if (Array.isArray(rows)) setLogItems(rows)
              }}
            />
          </InlineStack>
        </InlineStack>
        <Divider />
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
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    )
                  })}
                </IndexTable>
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
// <!-- END RBP GENERATED: importer-v2-3 -->
