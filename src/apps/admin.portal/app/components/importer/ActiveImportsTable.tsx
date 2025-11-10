import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Card, IndexTable, InlineStack, ProgressBar, Text } from '@shopify/polaris'

// A lightweight live table of currently running prepare jobs. Rows fade out on completion.
export default function ActiveImportsTable() {
  type Preparing = { runId: string; startedAt?: string; etaSeconds?: number }
  type Row = {
    runId: string
    templateId: string
    templateName: string
    phase: string
    percent: number
    etaSeconds?: number
    status: string
    updatedAt: string
  }
  const [templates, setTemplates] = useState<Array<{ id: string; name?: string; preparing?: Preparing | null }>>([])
  const [rows, setRows] = useState<Row[]>([])
  const timers = useRef<Record<string, number>>({})
  const sourcesRef = useRef<Record<string, EventSource>>({})

  // bootstrap from templates endpoint
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const r = await fetch('/api/importer/templates?kind=import-templates', {
          headers: { Accept: 'application/json' },
        })
        const j = (await r.json()) as { templates?: Array<{ id: string; name?: string; preparing?: Preparing | null }> }
        if (!active) return
        const list = Array.isArray(j.templates) ? j.templates : []
        setTemplates(list)
      } catch {
        /* ignore */
      }
    }
    load()
    const poll = setInterval(load, 5000)
    return () => {
      active = false
      clearInterval(poll)
    }
  }, [])

  // track runIds from templates and subscribe to SSE per runId
  useEffect(() => {
    let cancelled = false
    const preps = templates
      .map(t => ({ tpl: t.id, name: t.name || t.id, run: t.preparing?.runId }))
      .filter(x => x.run) as Array<{ tpl: string; name: string; run: string }>

    // Unsubscribe any stale sources not present anymore
    for (const rid of Object.keys(sourcesRef.current)) {
      if (!preps.find(p => p.run === rid)) {
        try {
          sourcesRef.current[rid].close()
        } catch {
          /* noop */
        }
        delete sourcesRef.current[rid]
      }
    }

    if (!preps.length) {
      setRows([])
      return
    }

    for (const p of preps) {
      const rid = p.run
      if (sourcesRef.current[rid]) continue
      const es = new EventSource(`/api/importer/runs/${encodeURIComponent(rid)}/status/stream`)
      sourcesRef.current[rid] = es

      es.addEventListener('update', ev => {
        if (cancelled) return
        try {
          const j = JSON.parse((ev as MessageEvent).data) as {
            status: string
            runId: string
            progress?: { percent?: number; phase?: string; etaSeconds?: number } | null
            preflight?: { etaSeconds?: number } | null
          }
          const pct = Math.max(0, Math.min(100, Math.round((j.progress?.percent as number) || 0)))
          const phase = String(j.progress?.phase || j.status || 'preparing')
          const eta = ((): number | undefined => {
            if (typeof j.progress?.etaSeconds === 'number') return j.progress.etaSeconds
            return undefined
          })()
          const row: Row = {
            runId: rid,
            templateId: p.tpl,
            templateName: p.name,
            phase,
            percent: pct,
            etaSeconds: eta,
            status: j.status,
            updatedAt: new Date().toISOString(),
          }
          setRows(cur => {
            const idx = cur.findIndex(x => x.runId === rid)
            if (idx === -1) return [...cur, row]
            const next = [...cur]
            next[idx] = row
            return next
          })
        } catch {
          /* ignore */
        }
      })

      es.addEventListener('end', () => {
        try {
          if (!timers.current[rid]) {
            timers.current[rid] = window.setTimeout(() => {
              setRows(cur => cur.filter(x => x.runId !== rid))
              delete timers.current[rid]
            }, 3000)
          }
          // Close source
          try {
            es.close()
          } catch {
            /* noop */
          }
          delete sourcesRef.current[rid]
        } catch {
          /* ignore */
        }
      })

      es.addEventListener('error', () => {
        try {
          es.close()
        } catch {
          /* noop */
        }
        delete sourcesRef.current[rid]
      })
    }

    return () => {
      cancelled = true
      for (const s of Object.values(sourcesRef.current)) {
        try {
          s.close()
        } catch {
          /* noop */
        }
      }
      sourcesRef.current = {}
    }
  }, [templates])

  if (rows.length === 0) {
    return (
      <div style={{ padding: 12 }}>
        <Text tone="subdued" as="p">
          No active imports.
        </Text>
      </div>
    )
  }

  const headings = useMemo(() => {
    return [
      { title: 'Template' },
      { title: 'Phase' },
      { title: 'Progress' },
      { title: 'ETA' },
      { title: 'Status' },
      { title: 'Last update' },
    ]
  }, []) as unknown as [{ title: string }, ...Array<{ title: string }>]

  const formatEta = (s?: number) => {
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
      <IndexTable
        resourceName={{ singular: 'run', plural: 'runs' }}
        condensed={false}
        itemCount={rows.length}
        headings={headings}
      >
        {rows.map((r, index) => (
          <IndexTable.Row id={r.runId} key={r.runId} position={index}>
            <IndexTable.Cell>
              <InlineStack gap="200" blockAlign="center">
                <Badge>{r.templateName}</Badge>
                <Text as="span" tone="subdued" variant="bodySm">
                  {r.runId}
                </Text>
              </InlineStack>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Badge tone={r.status === 'failed' ? 'critical' : r.status === 'staged' ? 'success' : 'attention'}>
                {r.phase}
              </Badge>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <div style={{ minWidth: 160 }}>
                <InlineStack align="space-between">
                  <Text as="span" tone="subdued" variant="bodySm">
                    {r.percent}%
                  </Text>
                  <Text as="span" tone="subdued" variant="bodySm">
                    {r.phase}
                  </Text>
                </InlineStack>
                <ProgressBar progress={r.percent} size="small" />
              </div>
            </IndexTable.Cell>
            <IndexTable.Cell>{formatEta(r.etaSeconds)}</IndexTable.Cell>
            <IndexTable.Cell>{r.status}</IndexTable.Cell>
            <IndexTable.Cell>
              <Text as="span" tone="subdued">
                {rel(r.updatedAt)}
              </Text>
            </IndexTable.Cell>
          </IndexTable.Row>
        ))}
      </IndexTable>
    </Card>
  )
}
