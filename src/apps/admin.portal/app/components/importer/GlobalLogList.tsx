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
} from '@shopify/polaris'

type LogRow = {
  at: string
  templateId: string
  runId: string
  type: string
  payload?: unknown
}

export default function GlobalLogList({ items = [] }: { items?: LogRow[] }) {
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
    return items.filter(r => {
      if (filterType !== 'all' && typeCategory(r.type) !== filterType) return false
      if (!q) return true
      const hay = `${r.templateId} ${r.runId} ${r.type} ${payloadSnippet(r.payload) || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, filterType, query])

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
        </InlineStack>
        <Divider />
        {[...grouped.entries()].map(([tpl, rows]) => (
          <Box key={tpl} padding="200" borderWidth="025" borderColor="border" borderRadius="100">
            <BlockStack gap="150">
              <InlineStack align="space-between">
                <InlineStack gap="200">
                  <Text as="h3" variant="headingSm">
                    template {tpl}
                  </Text>
                  <Badge>{String(rows.length)}</Badge>
                </InlineStack>
              </InlineStack>
              <BlockStack gap="100">
                {rows.map((r, i) => {
                  const key = `${r.at}|${r.type}|${r.runId}`
                  const isOpen = !!expanded[key]
                  const snip = payloadSnippet(r.payload)
                  return (
                    <Box key={key} padding="150" borderWidth="025" borderColor="border" borderRadius="050">
                      <InlineStack align="space-between">
                        <InlineStack gap="200" align="start">
                          {badge(r.type)}
                          <Text as="span" tone="subdued">
                            {rel(r.at)}
                          </Text>
                          <Text as="span" tone="subdued">
                            run
                          </Text>
                          <Text as="span" variant="bodySm">
                            {r.runId}
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" align="center">
                          {snip ? (
                            <Text as="span" tone="subdued" variant="bodySm">
                              {snip}
                            </Text>
                          ) : null}
                          <Button
                            accessibilityLabel="Toggle details"
                            onClick={() => setExpanded(cur => ({ ...cur, [key]: !cur[key] }))}
                          >
                            {isOpen ? 'Hide' : 'Details'}
                          </Button>
                        </InlineStack>
                      </InlineStack>
                      <Collapsible open={isOpen} id={`log-${i}`}>
                        <div style={{ maxHeight: 360, overflow: 'auto', marginTop: 8 }}>
                          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>
                            {JSON.stringify(r.payload ?? null, null, 2)}
                          </pre>
                        </div>
                      </Collapsible>
                    </Box>
                  )
                })}
              </BlockStack>
            </BlockStack>
          </Box>
        ))}
        {grouped.size === 0 ? (
          <Text as="p" tone="subdued">
            No logs match your filters.
          </Text>
        ) : null}
      </BlockStack>
    </>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
