import { useEffect, useMemo, useState } from 'react'
import { Badge, Card, IndexTable, InlineStack, Modal, Text } from '@shopify/polaris'

type LogRow = { at: string; templateId: string; runId: string; type: string; payload?: unknown }

export default function RecentRunsTable() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [openRun, setOpenRun] = useState<{ runId: string; rows: LogRow[] } | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const r = await fetch('/api/importer/logs?take=200')
        if (!r.ok) return
        const j = (await r.json()) as { logs?: LogRow[] }
        if (!active) return
        if (Array.isArray(j.logs)) setLogs(j.logs)
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

  const runs = useMemo(() => {
    // group by runId; pick only completed (done/error/cancelled) within last ~200 logs
    const byRun = new Map<string, LogRow[]>()
    for (const l of logs) {
      if (!byRun.has(l.runId)) byRun.set(l.runId, [])
      byRun.get(l.runId)!.push(l)
    }
    const completed = Array.from(byRun.values()).filter(arr => {
      arr.sort((a, b) => (a.at < b.at ? -1 : 1))
      const last = arr[arr.length - 1]
      if (!last) return false
      // Treat both prepare and publish terminal events as completed runs
      const t = last.type
      return (
        t === 'prepare:done' ||
        t === 'prepare:error' ||
        t === 'prepare:cancelled' ||
        t === 'publish:done' ||
        t === 'publish:error'
      )
    })
    // map to summary rows
    return completed.map(arr => {
      const first = arr[0]
      const last = arr[arr.length - 1]
      const tpl = first.templateId
      const runId = first.runId
      const totals = { staged: 0, adds: 0, changes: 0, errors: 0 }
      let durationSec = 0
      try {
        const done = arr.find(x => x.type === 'prepare:done')
        if (done) {
          const p = (done.payload || {}) as Record<string, unknown>
          totals.staged = (p['staged'] as number) || (p['adds'] as number) || (p['count'] as number) || 0
          durationSec = (p['elapsed'] as number) || (p['runtime'] as number) || 0
        }
        const prog = arr.find(x => x.type === 'prepare:report')
        if (prog) {
          const p = (prog.payload || {}) as Record<string, unknown>
          totals.adds = (p['adds'] as number) || (p['staged'] as number) || 0
          totals.errors = (p['errors'] as number) || 0
        }
      } catch {
        /* ignore */
      }
      const status =
        last.type === 'prepare:done' || last.type === 'publish:done'
          ? 'success'
          : last.type === 'prepare:error' || last.type === 'publish:error'
            ? 'failed'
            : 'cancelled'
      return { runId, templateId: tpl, startedAt: first.at, endedAt: last.at, totals, durationSec, status, rows: arr }
    })
  }, [logs])

  const headings = useMemo(() => {
    return [{ title: 'Template' }, { title: 'Totals' }, { title: 'Duration' }, { title: 'Status' }, { title: 'Run' }]
  }, []) as unknown as [{ title: string }, ...Array<{ title: string }>]

  const formatDuration = (s?: number) => {
    if (!Number.isFinite(s as number)) return '—'
    const sec = Math.max(0, Math.round((s as number) || 0))
    const m = Math.floor(sec / 60)
    const rem = sec % 60
    return m > 0 ? `${m}m ${rem ? `${rem}s` : ''}` : `${rem}s`
  }
  const rel = (iso: string) => {
    try {
      const t = Date.parse(iso)
      const d = Math.max(0, Math.floor((Date.now() - t) / 1000))
      if (d < 60) return `${d}s ago`
      const m = Math.floor(d / 60)
      if (m < 60) return `${m}m ago`
      const h = Math.floor(m / 60)
      return `${h}h ago`
    } catch {
      return iso
    }
  }

  return (
    <Card>
      <IndexTable resourceName={{ singular: 'run', plural: 'runs' }} itemCount={runs.length} headings={headings}>
        {runs.map((r, index) => (
          <IndexTable.Row
            id={r.runId}
            key={r.runId}
            position={index}
            onClick={() => setOpenRun({ runId: r.runId, rows: r.rows })}
          >
            <IndexTable.Cell>
              <InlineStack gap="200" blockAlign="center">
                <Badge>{r.templateId}</Badge>
                <Text as="span" tone="subdued" variant="bodySm">
                  {rel(r.startedAt)}
                </Text>
              </InlineStack>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text as="span" tone="subdued" variant="bodySm">
                {`${r.totals.staged} staged`}
                {r.totals.errors ? ` • ${r.totals.errors} errors` : ''}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>{formatDuration(r.durationSec)}</IndexTable.Cell>
            <IndexTable.Cell>
              <Badge tone={r.status === 'success' ? 'success' : r.status === 'failed' ? 'critical' : undefined}>
                {r.status}
              </Badge>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text as="span" tone="subdued" variant="bodySm">
                {r.runId}
              </Text>
            </IndexTable.Cell>
          </IndexTable.Row>
        ))}
      </IndexTable>
      <Modal
        open={!!openRun}
        onClose={() => setOpenRun(null)}
        title={openRun ? `Run ${openRun.runId}` : ''}
        primaryAction={{ content: 'Close', onAction: () => setOpenRun(null) }}
      >
        <Modal.Section>
          {openRun ? (
            <div style={{ maxHeight: 420, overflow: 'auto' }}>
              {openRun.rows.map(r => (
                <div key={`${r.at}|${r.type}`} style={{ padding: 8, borderBottom: '1px solid var(--p-color-border)' }}>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="span" tone="subdued" variant="bodySm">
                      {new Date(r.at).toLocaleTimeString()}
                    </Text>
                    <Badge>{r.type}</Badge>
                  </InlineStack>
                  <div style={{ marginTop: 4 }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                      {(() => {
                        try {
                          return JSON.stringify(r.payload ?? null, null, 2)
                        } catch {
                          return String(r.payload)
                        }
                      })()}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Modal.Section>
      </Modal>
    </Card>
  )
}
