import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, IndexTable, InlineStack, Text } from '@shopify/polaris'

type LogRow = { at: string; templateId: string; runId: string; type: string; payload?: unknown }

type RunStatus =
  | 'created'
  | 'discover'
  | 'crawling'
  | 'staging'
  | 'diffing'
  | 'staged'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled'

export default function RecentRunsTable() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [statusByRun, setStatusByRun] = useState<Record<string, { status: RunStatus; startedAt?: string }>>({})

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
    // map to summary rows; include any run groups we see, newest first
    const groups = Array.from(byRun.values()).map(arr => {
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
        const consistency = arr.find(x => x.type === 'prepare:consistency')
        if (consistency) {
          const p = (consistency.payload || {}) as Record<string, unknown>
          const dc = (p['diffCount'] as number) || 0
          const sc = (p['stagedCount'] as number) || 0
          totals.staged = dc || sc || totals.staged
        }
      } catch {
        /* ignore */
      }
      // status hint from logs
      let hint: RunStatus | null = null
      const t = last?.type || ''
      if (/^publish:error$/.test(t)) hint = 'failed'
      else if (/^crawl:headers$/.test(t)) hint = 'crawling'
      else if (/^prepare:consistency$/.test(t)) hint = 'staged'
      return { runId, templateId: tpl, startedAt: first.at, endedAt: last?.at, totals, durationSec, hint, rows: arr }
    })
    // newest first
    groups.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    return groups
  }, [logs])

  const headings = useMemo(() => {
    return [
      { title: 'Template' },
      { title: 'Totals' },
      { title: 'Duration' },
      { title: 'Status' },
      { title: 'Actions' },
    ]
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

  // Fetch live run status snapshots for the top 20 runs to derive friendly status
  useEffect(() => {
    let active = true
    const top = runs.slice(0, 20)
    if (!top.length) return
    const load = async () => {
      try {
        const entries = await Promise.all(
          top.map(async r => {
            try {
              const resp = await fetch(`/api/importer/runs/${encodeURIComponent(r.runId)}/status`, {
                headers: { 'Cache-Control': 'no-store' },
              })
              if (!resp.ok) return [r.runId, null] as const
              const j = (await resp.json()) as { status?: RunStatus; startedAt?: string }
              return [r.runId, { status: (j.status || 'created') as RunStatus, startedAt: j.startedAt }] as const
            } catch {
              return [r.runId, null] as const
            }
          }),
        )
        if (!active) return
        const next: Record<string, { status: RunStatus; startedAt?: string }> = {}
        for (const [id, s] of entries) if (s) next[id] = s
        setStatusByRun(prev => ({ ...prev, ...next }))
      } catch {
        /* ignore */
      }
    }
    load()
    const t = setInterval(load, 30000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [runs])

  const friendly = (
    runId: string,
    hint: RunStatus | null,
  ): { label: string; tone?: 'success' | 'critical' | 'info' } => {
    const snap = statusByRun[runId]
    const st = (snap?.status || hint || 'created') as RunStatus
    switch (st) {
      case 'published':
        return { label: 'Published', tone: 'success' }
      case 'publishing':
        return { label: 'Publishing', tone: 'info' }
      case 'staged':
        return { label: 'Ready', tone: 'info' }
      case 'diffing':
      case 'staging':
        return { label: 'Preparing', tone: 'info' }
      case 'crawling':
        return { label: 'Crawling headers', tone: 'info' }
      case 'discover':
      case 'created':
        return { label: 'Created' }
      case 'failed':
        return { label: 'Publish failed', tone: 'critical' }
      case 'cancelled':
        return { label: 'Cancelled', tone: 'critical' }
      default:
        return { label: String(st) }
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
            onClick={() => {
              // Navigate to Review for this run
              window.location.assign(`/app/imports/runs/${encodeURIComponent(r.runId)}/review`)
            }}
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
              {(() => {
                const f = friendly(r.runId, r.hint as RunStatus | null)
                return <Badge tone={f.tone}>{f.label}</Badge>
              })()}
            </IndexTable.Cell>
            <IndexTable.Cell>
              {(() => {
                const f = friendly(r.runId, r.hint as RunStatus | null)
                if (f.label !== 'Published') return null
                return (
                  <span
                    onMouseDown={e => e.stopPropagation()}
                    onMouseUp={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  >
                    <Button
                      size="slim"
                      onClick={() => {
                        const ok = window.confirm('Schedule this import to run automatically?')
                        if (!ok) return
                        // Navigate to Import Settings where scheduling can be configured
                        window.location.assign(`/app/imports/${encodeURIComponent(r.templateId)}?schedule=1`)
                      }}
                    >
                      Schedule
                    </Button>
                  </span>
                )
              })()}
            </IndexTable.Cell>
          </IndexTable.Row>
        ))}
      </IndexTable>
    </Card>
  )
}
