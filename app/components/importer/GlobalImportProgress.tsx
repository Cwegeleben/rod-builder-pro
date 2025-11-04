import React from 'react'
import { Banner, BlockStack, InlineStack, Text, Button } from '@shopify/polaris'

type RunStatus = {
  runId: string
  status: string
  templateId?: string | null
  templateName?: string | null
  progress?: { phase?: string; percent?: number; etaSeconds?: number; details?: unknown } | null
  counts?: Record<string, number>
  startedAt?: string
  finishedAt?: string | null
  preflight?: { candidates?: number; etaSeconds?: number; expectedItems?: number } | null
}

type Preparing = {
  runId: string
  startedAt?: string
  etaSeconds?: number
}

export function GlobalImportProgress() {
  const [runs, setRuns] = React.useState<Record<string, RunStatus>>({})
  const [ready, setReady] = React.useState<Array<{ runId: string; templateId?: string | null }>>([])
  const [failed, setFailed] = React.useState<Array<{ runId: string; templateId?: string | null }>>([])
  const [cancelled, setCancelled] = React.useState<Array<{ runId: string; templateId?: string | null }>>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [names, setNames] = React.useState<Record<string, string>>({})
  // Track open EventSources by runId for cleanup and dynamic attach
  const sourcesRef = React.useRef<Record<string, EventSource>>({})
  const formatEtaShort = React.useCallback((seconds?: number) => {
    if (!Number.isFinite(seconds as number)) return null
    const total = Math.max(0, Math.round((seconds as number) || 0))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    if (h > 0) return `${h}h${m ? ` ${m}m` : ''}`
    if (m > 0) return `${m}m${s ? ` ${s}s` : ''}`
    return `${s}s`
  }, [])
  const formatStartedAgo = React.useCallback((startedAt?: string) => {
    if (!startedAt) return null
    const t = Date.parse(startedAt)
    if (!Number.isFinite(t)) return null
    const diff = Math.max(0, Math.floor((Date.now() - t) / 1000))
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    if (h > 0) return `Started ${h}h${m ? ` ${m}m` : ''} ago`
    if (m > 0) return `Started ${m}m ago`
    return 'Started just now'
  }, [])
  React.useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        setLoading(true)
        const res = await fetch('/api/importer/templates?kind=import-templates', {
          headers: { Accept: 'application/json' },
        })
        const jr = (await res.json()) as {
          templates?: Array<{ id: string; name?: string; preparing?: Preparing | null }>
        }
        const templates = Array.isArray(jr.templates) ? jr.templates : []
        setNames(prev => ({ ...prev, ...Object.fromEntries(templates.map(t => [t.id, t.name || t.id])) }))
        const preps = templates.map(t => t.preparing).filter(Boolean) as Preparing[]
        // Attach SSE per preparing run, deduplicating via sourcesRef
        for (const p of preps) {
          const key = p.runId
          if (sourcesRef.current[key]) continue
          const url = `/api/importer/runs/${encodeURIComponent(key)}/status/stream`
          const es = new EventSource(url)
          sourcesRef.current[key] = es
          es.addEventListener('update', e => {
            if (cancelled) return
            try {
              const data = JSON.parse((e as MessageEvent).data) as RunStatus
              setRuns(prev => ({ ...prev, [data.runId]: data }))
              // If SSE provides templateId+name, record it
              if (data.templateId && data.templateName) {
                setNames(prev => ({ ...prev, [data.templateId!]: data.templateName! }))
              }
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
                templateName?: string | null
              }
              if (data?.ok && data.runId) {
                setRuns(prev => {
                  const next = { ...prev }
                  delete next[data.runId!]
                  return next
                })
                if (data.templateId && data.templateName) {
                  setNames(prev => ({ ...prev, [data.templateId!]: data.templateName! }))
                }
                if (data.status === 'failed') {
                  setFailed(prev => [{ runId: data.runId!, templateId: data.templateId }, ...prev].slice(0, 3))
                } else if (data.status === 'staged') {
                  setReady(prev => [{ runId: data.runId!, templateId: data.templateId }, ...prev].slice(0, 3))
                } else if (data.status === 'cancelled') {
                  setCancelled(prev => [{ runId: data.runId!, templateId: data.templateId }, ...prev].slice(0, 3))
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
              delete sourcesRef.current[key]
            }
          })
          es.addEventListener('error', () => {
            try {
              es.close()
            } catch {
              /* noop */
            }
            delete sourcesRef.current[key]
          })
        }
        // Periodically poll for new preparing runs to subscribe to
        const poll = setInterval(async () => {
          if (cancelled) return
          try {
            const r = await fetch('/api/importer/templates?kind=import-templates', {
              headers: { Accept: 'application/json' },
            })
            const j = (await r.json()) as {
              templates?: Array<{ id: string; name?: string; preparing?: Preparing | null }>
            }
            const tpls = Array.isArray(j.templates) ? j.templates : []
            setNames(prev => ({ ...prev, ...Object.fromEntries(tpls.map(t => [t.id, t.name || t.id])) }))
            const news = tpls.map(t => t.preparing?.runId).filter(Boolean) as string[]
            for (const rid of news) {
              if (!sourcesRef.current[rid]) {
                const url2 = `/api/importer/runs/${encodeURIComponent(rid)}/status/stream`
                const es2 = new EventSource(url2)
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
                      } else if (data.status === 'staged') {
                        setReady(prev => [{ runId: data.runId!, templateId: data.templateId }, ...prev].slice(0, 3))
                      } else if (data.status === 'cancelled') {
                        setCancelled(prev => [{ runId: data.runId!, templateId: data.templateId }, ...prev].slice(0, 3))
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
      } finally {
        setLoading(false)
      }
    }
    // Run async bootstrap; return cleanup that just marks cancelled
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const runList = Object.values(runs).filter(r => r && r.status && r.status !== 'staged' && r.status !== 'failed')
  if (loading && runList.length === 0 && ready.length === 0 && failed.length === 0 && cancelled.length === 0)
    return null
  if (runList.length === 0 && ready.length === 0 && failed.length === 0 && cancelled.length === 0) return null

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
      <BlockStack gap="200">
        {cancelled.map(r => (
          <Banner key={`cancel-${r.runId}`} tone="warning" title="Prepare cancelled">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span">This prepare run was cancelled.</Text>
              <Button url="/app/imports">View logs</Button>
            </InlineStack>
          </Banner>
        ))}
        {failed.map(r => (
          <Banner key={`failed-${r.runId}`} tone="critical" title="Prepare failed">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span">
                {`An error occurred while preparing${r.templateId ? ` “${names[r.templateId] || r.templateId}”` : ''}.`}
              </Text>
              <InlineStack gap="200">
                {r.templateId ? (
                  <Button url={`/app/imports/${r.templateId}`}>View logs</Button>
                ) : (
                  <Button url="/app/imports">View logs</Button>
                )}
                {r.templateId ? (
                  <Button
                    variant="primary"
                    onClick={async () => {
                      try {
                        await fetch('/api/importer/prepare', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ templateId: r.templateId, confirmOverwrite: true }),
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
        ))}
        {ready.map(r => (
          <Banner key={`ready-${r.runId}`} tone="success" title="Review is ready">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span">
                {`Staging complete${r.templateId ? ` for “${names[r.templateId] || r.templateId}”` : ''}. You can start reviewing changes.`}
              </Text>
              {r.templateId ? (
                <Button url={`/app/imports/${r.templateId}/review`} variant="primary">
                  Open Review
                </Button>
              ) : null}
            </InlineStack>
          </Banner>
        ))}
        {runList.map(r => {
          const pct = Math.max(0, Math.min(100, Math.round((r.progress?.percent as number) || 0)))
          const phase = String(r.progress?.phase || r.status || 'preparing')
          const eta =
            typeof r.progress?.etaSeconds === 'number'
              ? Math.max(0, Math.round(r.progress?.etaSeconds || 0))
              : undefined
          const started = r.startedAt
          const pf = (r as unknown as { preflight?: { candidates?: number; expectedItems?: number } | null }).preflight
          const preflightSummary = (() => {
            const c = typeof pf?.candidates === 'number' ? pf!.candidates! : undefined
            const exp = typeof pf?.expectedItems === 'number' ? pf!.expectedItems! : undefined
            const bits: string[] = []
            if (typeof c === 'number') bits.push(`~${c} series`)
            if (typeof exp === 'number') bits.push(`~${exp} items`)
            return bits.length ? `• ${bits.join(' • ')}` : ''
          })()
          return (
            <Banner key={r.runId} tone="info">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="400" blockAlign="center">
                  <Text as="span">Preparing review… {phase}</Text>
                  <InlineStack gap="300" blockAlign="center">
                    <Text as="span" tone="subdued">
                      {pct}%{typeof eta === 'number' ? ` • ~${formatEtaShort(eta)}` : ''}
                    </Text>
                    {started ? <Text as="span" tone="subdued">{`• ${formatStartedAgo(started)}`}</Text> : null}
                    {preflightSummary ? (
                      <Text as="span" tone="subdued">
                        {preflightSummary}
                      </Text>
                    ) : null}
                  </InlineStack>
                </InlineStack>
                <InlineStack gap="200">
                  {r.templateId ? (
                    <Button url={`/app/imports/${r.templateId}`}>View logs</Button>
                  ) : (
                    <Button url="/app/imports">View logs</Button>
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
              </InlineStack>
              <div style={{ marginTop: 6, height: 6, width: '100%', background: 'var(--p-color-bg-secondary)' }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: 6,
                    background: 'var(--p-color-bg-fill-brand)',
                    transition: 'width 300ms ease',
                  }}
                />
              </div>
            </Banner>
          )
        })}
      </BlockStack>
    </div>
  )
}

export default GlobalImportProgress
