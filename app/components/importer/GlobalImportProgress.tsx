import React from 'react'
import { Banner, BlockStack, InlineStack, Text, Button } from '@shopify/polaris'

type RunStatus = {
  runId: string
  status: string
  templateId?: string | null
  progress?: { phase?: string; percent?: number; etaSeconds?: number; details?: unknown } | null
  counts?: Record<string, number>
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
  const [loading, setLoading] = React.useState<boolean>(true)
  React.useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        setLoading(true)
        const res = await fetch('/api/importer/templates?kind=import-templates', {
          headers: { Accept: 'application/json' },
        })
        const jr = (await res.json()) as { templates?: Array<{ preparing?: Preparing | null }> }
        const preps = (jr.templates || []).map(t => t.preparing).filter(Boolean) as Preparing[]
        // Open an SSE stream for each preparing run
        const sources: EventSource[] = []
        preps.forEach(p => {
          const url = `/api/importer/runs/${encodeURIComponent(p.runId)}/status/stream`
          const es = new EventSource(url)
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
                } else {
                  setReady(prev => [{ runId: data.runId!, templateId: data.templateId }, ...prev].slice(0, 3))
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
            }
          })
          es.addEventListener('error', () => {
            try {
              es.close()
            } catch {
              /* noop */
            }
          })
          sources.push(es)
        })
        return () => {
          cancelled = true
          sources.forEach(s => {
            try {
              s.close()
            } catch {
              /* noop */
            }
          })
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
  if (loading && runList.length === 0 && ready.length === 0 && failed.length === 0) return null
  if (runList.length === 0 && ready.length === 0 && failed.length === 0) return null

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
      <BlockStack gap="200">
        {failed.map(r => (
          <Banner key={`failed-${r.runId}`} tone="critical" title="Prepare failed">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span">An error occurred while preparing the review.</Text>
              <Button url="/app/imports">View logs</Button>
            </InlineStack>
          </Banner>
        ))}
        {ready.map(r => (
          <Banner key={`ready-${r.runId}`} tone="success" title="Review is ready">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span">Staging complete. You can start reviewing changes.</Text>
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
          return (
            <Banner key={r.runId} tone="info">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="400" blockAlign="center">
                  <Text as="span">Preparing review… {phase}</Text>
                  <Text as="span" tone="subdued">
                    {pct}%{typeof eta === 'number' ? ` • ~${eta}s` : ''}
                  </Text>
                </InlineStack>
                <InlineStack gap="200">
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
