import React from 'react'
import { Card, Button, Text, InlineStack, BlockStack, Banner, Badge, Frame, Toast } from '@shopify/polaris'

type RunStatus = {
  runId: string
  status: string
  templateId?: string | null
  progress?: { phase?: string; percent?: number; etaSeconds?: number } | null
}

type Preparing = { runId: string; startedAt?: string; etaSeconds?: number }
type TemplateRow = { id: string; name?: string; preparing?: Preparing | null }

export default function JobCenter() {
  const [open, setOpen] = React.useState(false)
  const [runs, setRuns] = React.useState<Record<string, RunStatus>>({})
  const [names, setNames] = React.useState<Record<string, string>>({})
  const [failed, setFailed] = React.useState<Array<{ runId: string; templateId?: string | null }>>([])
  const [toast, setToast] = React.useState<string | null>(null)
  const sourcesRef = React.useRef<Record<string, EventSource>>({})

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Seed names and preparing runs
        const res = await fetch('/api/importer/templates?kind=import-templates')
        const jr = (await res.json()) as { templates?: TemplateRow[] }
        const rows = jr.templates || []
        setNames(Object.fromEntries(rows.map(r => [r.id, r.name || r.id])))
        const preparing = rows.map(r => r.preparing?.runId).filter(Boolean) as string[]
        for (const runId of preparing) {
          if (sourcesRef.current[runId]) continue
          const es = new EventSource(`/api/importer/runs/${encodeURIComponent(runId)}/status/stream`)
          sourcesRef.current[runId] = es
          es.addEventListener('update', e => {
            if (cancelled) return
            try {
              const data = JSON.parse((e as MessageEvent).data) as RunStatus
              setRuns(prev => ({ ...prev, [data.runId]: data }))
            } catch {
              /* ignore */
            }
          })
          es.addEventListener('end', e => {
            try {
              const data = JSON.parse((e as MessageEvent).data) as {
                ok?: boolean
                runId?: string
                templateId?: string | null
                status?: string
              }
              if (data?.ok && data.runId) {
                setRuns(prev => {
                  const next = { ...prev }
                  delete next[data.runId!]
                  return next
                })
                if (data.status === 'failed') {
                  setFailed(prev => [{ runId: data.runId!, templateId: data.templateId }, ...prev].slice(0, 3))
                } else if (data.status === 'cancelled') {
                  setToast('Prepare cancelled')
                }
              }
            } catch {
              /* ignore */
            } finally {
              try {
                es.close()
              } catch {
                /* noop */
              }
              delete sourcesRef.current[runId]
            }
          })
          es.addEventListener('error', () => {
            try {
              es.close()
            } catch {
              /* noop */
            }
            delete sourcesRef.current[runId]
          })
        }
        // Poll for new preparing runs and subscribe
        const poll = setInterval(async () => {
          if (cancelled) return
          try {
            const r = await fetch('/api/importer/templates?kind=import-templates')
            const j = (await r.json()) as { templates?: TemplateRow[] }
            const news = (j.templates || []).map(t => t.preparing?.runId).filter(Boolean) as string[]
            for (const rid of news) {
              if (!sourcesRef.current[rid]) {
                const es2 = new EventSource(`/api/importer/runs/${encodeURIComponent(rid)}/status/stream`)
                sourcesRef.current[rid] = es2
                es2.addEventListener('update', ev => {
                  if (cancelled) return
                  try {
                    const data = JSON.parse((ev as MessageEvent).data) as RunStatus
                    setRuns(prev => ({ ...prev, [data.runId]: data }))
                  } catch {
                    /* ignore */
                  }
                })
                es2.addEventListener('end', ev => {
                  try {
                    const data = JSON.parse((ev as MessageEvent).data) as {
                      ok?: boolean
                      runId?: string
                      templateId?: string | null
                      status?: string
                    }
                    if (data?.ok && data.runId) {
                      setRuns(prev => {
                        const next = { ...prev }
                        delete next[data.runId!]
                        return next
                      })
                      if (data.status === 'failed') {
                        setFailed(prev => [{ runId: data.runId!, templateId: data.templateId }, ...prev].slice(0, 3))
                      } else if (data.status === 'cancelled') {
                        setToast('Prepare cancelled')
                      }
                    }
                  } catch {
                    /* ignore */
                  } finally {
                    try {
                      es2.close()
                    } catch {
                      /* noop */
                    }
                    delete sourcesRef.current[rid]
                  }
                })
                es2.addEventListener('error', () => {
                  try {
                    es2.close()
                  } catch {
                    /* noop */
                  }
                  delete sourcesRef.current[rid]
                })
              }
            }
          } catch {
            /* ignore */
          }
        }, 2000)
        return () => {
          cancelled = true
          clearInterval(poll)
          Object.values(sourcesRef.current).forEach(s => {
            try {
              s.close()
            } catch {
              /* noop */
            }
          })
          sourcesRef.current = {}
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
      Object.values(sourcesRef.current).forEach(s => {
        try {
          s.close()
        } catch {
          /* noop */
        }
      })
      sourcesRef.current = {}
    }
  }, [])

  const active = Object.values(runs).filter(
    r => r.status !== 'staged' && r.status !== 'failed' && r.status !== 'cancelled',
  )
  const count = active.length

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 20 }}>
      {toast ? (
        <Frame>
          <Toast content={toast} duration={1800} onDismiss={() => setToast(null)} />
        </Frame>
      ) : null}
      <InlineStack gap="100" align="end" blockAlign="center">
        <Button onClick={() => setOpen(!open)}>Jobs</Button>
        {count > 0 ? <Badge tone="attention">{String(count)}</Badge> : null}
      </InlineStack>
      {open ? (
        <div
          style={{
            position: 'fixed',
            right: 16,
            bottom: 64,
            width: 360,
            maxHeight: '60vh',
            overflow: 'auto',
            background: 'var(--p-color-bg)',
            boxShadow: 'var(--p-shadow-300)',
            borderRadius: 8,
            padding: 8,
          }}
        >
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">
              Job Center
            </Text>
            {failed.map(f => {
              const tname = f.templateId ? names[f.templateId] || f.templateId : undefined
              return (
                <Banner key={`fail-${f.runId}`} tone="critical" title="Prepare failed">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span">{`Run ${f.runId.slice(0, 6)}… failed${tname ? ` for “${tname}”` : ''}.`}</Text>
                    <InlineStack gap="200">
                      {f.templateId ? (
                        <Button url={`/app/imports/${f.templateId}`}>View logs</Button>
                      ) : (
                        <Button url="/app/imports">View logs</Button>
                      )}
                      {f.templateId ? (
                        <Button
                          variant="primary"
                          onClick={async () => {
                            try {
                              await fetch('/api/importer/prepare', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ templateId: f.templateId, confirmOverwrite: true }),
                              })
                            } catch {
                              /* ignore */
                            }
                          }}
                        >
                          Retry
                        </Button>
                      ) : null}
                    </InlineStack>
                  </InlineStack>
                </Banner>
              )
            })}
            {active.length === 0 ? (
              <Text as="span" tone="subdued">
                No active jobs.
              </Text>
            ) : null}
            {active.map(r => {
              const pct = Math.max(0, Math.min(100, Math.round((r.progress?.percent as number) || 0)))
              const phase = String(r.progress?.phase || r.status || 'preparing')
              const name = r.templateId ? names[r.templateId] || r.templateId : 'Preparing'
              return (
                <Card key={r.runId}>
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="span">{name}</Text>
                      <Text as="span" tone="subdued">
                        {pct}%
                      </Text>
                    </InlineStack>
                    <Text as="span" tone="subdued">
                      {phase}
                    </Text>
                    <div style={{ height: 6, width: '100%', background: 'var(--p-color-bg-secondary)' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: 6,
                          background: 'var(--p-color-bg-fill-brand)',
                          transition: 'width 300ms ease',
                        }}
                      />
                    </div>
                    <InlineStack align="space-between">
                      {r.templateId ? (
                        <Button url={`/app/imports/${r.templateId}/review`} disabled={r.status !== 'staged'}>
                          Open Review
                        </Button>
                      ) : (
                        <span />
                      )}
                      <Button
                        tone="critical"
                        onClick={async () => {
                          try {
                            await fetch(`/api/importer/runs/${encodeURIComponent(r.runId)}/cancel`, { method: 'POST' })
                          } catch {
                            /* ignore */
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              )
            })}
          </BlockStack>
        </div>
      ) : null}
    </div>
  )
}
