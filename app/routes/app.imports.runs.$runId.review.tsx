// <!-- BEGIN RBP GENERATED: importer-review-inline-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useEffect, useMemo, useState } from 'react'
import { useFetcher, useLoaderData, useSearchParams } from '@remix-run/react'
import {
  Page,
  Banner,
  Tabs,
  BlockStack,
  Toast,
  Frame,
  Button,
  Modal,
  Text,
  InlineStack,
  ProgressBar,
} from '@shopify/polaris'
import { prisma } from '../db.server'
import { isHqShop } from '../lib/access.server'
import ReviewFilters from 'app/components/importer/review/ReviewFilters'
import ReviewIndexTable from 'app/components/importer/review/ReviewIndexTable'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  // E2E stub mode: allow tests to render the Review page without HQ/session or DB
  if (url.searchParams.get('e2e') === '1') {
    const runId = String(params.runId || '')
    const now = new Date().toISOString()
    return json({ run: { id: runId || 'run-e2e', supplierId: 'test-supplier', startedAt: now } })
  }
  if (!(await isHqShop(request))) throw new Response('Not Found', { status: 404 })

  const runId = String(params.runId || '')

  const run = await prisma.importRun.findUnique({
    where: { id: runId },
    select: { id: true, supplierId: true, startedAt: true },
  })
  if (!run) throw new Response('Not Found', { status: 404 })
  return json({ run })
}

type LoaderData = Awaited<ReturnType<typeof loader>> extends { json(): infer U } ? U : never

export default function ReviewRunRoute() {
  const { run } = useLoaderData<LoaderData>() as unknown as {
    run: { id: string; supplierId: string; startedAt: string }
  }
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'unlinked' | 'linked' | 'conflicts' | 'all') || 'all'
  const page = Math.max(1, Number(params.get('page') || '1') || 1)
  const pageSize = [25, 50].includes(Number(params.get('pageSize'))) ? Number(params.get('pageSize')) : 25

  const fetcher = useFetcher()
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [polling, setPolling] = useState(false)
  const [publishTotals, setPublishTotals] = useState<{
    created: number
    updated: number
    skipped: number
    failed: number
  } | null>(null)
  const [publishProgress, setPublishProgress] = useState<number>(0)
  type DebugLog = { id: string; type: string; at: string; payload: unknown }
  const debugFetcher = useFetcher<{ run?: unknown; logs?: DebugLog[] }>()
  const [showDebug, setShowDebug] = useState(false)
  // const navigate = useNavigate()
  // const location = useLocation()

  // Fetch table data
  const listUrl = useMemo(() => {
    const usp = new URLSearchParams(params)
    usp.set('tab', tab)
    usp.set('page', String(page))
    usp.set('pageSize', String(pageSize))
    return `/api/importer/runs/${run.id}/staged?${usp.toString()}`
  }, [params, tab, page, pageSize, run.id])
  useEffect(() => {
    fetcher.load(listUrl)
    // Collapse on tab/page/filter change
    setExpandedRowId(null)
    setSelectedIds([])
  }, [listUrl])

  type UIRow = {
    core: {
      id: string
      title: string | null
      externalId: string
      vendor: string
      status: 'staged' | 'approved' | 'rejected'
      confidence: number | null
      price?: number | null
      availability?: string | null
      shopifyProductId?: string | null
    }
    attributes: Record<string, unknown>
    diffClass: string
  }
  const data = (fetcher.data || {}) as {
    rows?: Array<UIRow>
    columns?: Array<{ key: string; label: string; type: string }>
    totals?: { unlinked: number; linked: number; conflicts: number; all: number }
    page?: number
    pageSize?: number
    totalPages?: number
  }

  const tabs = [
    { id: 'unlinked', content: `Unlinked (${data?.totals?.unlinked || 0})` },
    { id: 'linked', content: `Linked (${data?.totals?.linked || 0})` },
    { id: 'conflicts', content: `Conflicts (${data?.totals?.conflicts || 0})` },
    { id: 'all', content: `All (${data?.totals?.all || 0})` },
  ] as const
  const selectedTab = Math.max(
    0,
    tabs.findIndex(t => t.id === tab),
  )

  function setTab(idx: number) {
    const next = tabs[idx]?.id || 'all'
    const usp = new URLSearchParams(params)
    usp.set('tab', next)
    usp.set('page', '1')
    setParams(usp)
  }

  async function bulkAction(kind: 'approve' | 'reject') {
    if (!selectedIds.length) return
    const resp = await fetch(`/api/importer/runs/${run.id}/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds }),
    })
    if (resp.ok) {
      setToast(kind === 'approve' ? 'Approved' : 'Rejected')
      fetcher.load(listUrl)
      setSelectedIds([])
    }
  }

  const hasConflicts = (data?.totals?.conflicts || 0) > 0
  const approvedCount = (() => {
    const rows = data?.rows || []
    return rows.filter(r => r.core.status === 'approved').length
  })()
  const title = 'Review import'
  const subtitle = `${run.supplierId} — ${new Date(run.startedAt).toLocaleString()}`

  const hasRows = (data?.rows?.length || 0) > 0
  const allZero = (data?.totals?.all || 0) === 0
  return (
    <Page title={title} subtitle={subtitle} backAction={{ content: 'Back to Imports', url: '/app/imports' }}>
      <BlockStack gap="400">
        {toast ? (
          <Frame>
            <Toast content={toast} duration={2000} onDismiss={() => setToast(null)} />
          </Frame>
        ) : null}
        {!hasRows ? (
          <Banner title="No items to review" tone="info">
            There are no changes detected for this run. Try returning to Imports and launching Review again after
            Discovery has found products.
            {allZero ? (
              <div style={{ marginTop: 8 }}>
                <a
                  href="#"
                  onClick={e => {
                    e.preventDefault()
                    setShowDebug(s => !s)
                    if (!debugFetcher.data) debugFetcher.load(`/api/importer/runs/${run.id}/debug`)
                  }}
                >
                  {showDebug ? 'Hide' : 'Show'} debug details
                </a>
              </div>
            ) : null}
          </Banner>
        ) : hasConflicts ? (
          <Banner tone="critical" title="Resolve conflicts before publishing to Shopify."></Banner>
        ) : null}
        {showDebug ? (
          <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 6 }}>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {JSON.stringify(debugFetcher.data || {}, null, 2)}
            </pre>
          </div>
        ) : null}
        <InlineStack align="space-between">
          <Tabs tabs={tabs as unknown as { id: string; content: string }[]} selected={selectedTab} onSelect={setTab} />
          <Button
            variant="primary"
            tone="success"
            disabled={hasConflicts || approvedCount === 0}
            onClick={async () => {
              setPublishing(true)
              setPolling(true)
              setPublishProgress(0)
              setPublishTotals(null)
              // Start polling status immediately
              const poll = async () => {
                try {
                  const r = await fetch(`/api/importer/runs/${run.id}/publish/status`, {
                    headers: { 'Cache-Control': 'no-store' },
                  })
                  if (r.ok) {
                    const s = (await r.json()) as {
                      ok: boolean
                      progress: number
                      state: string
                      totals?: { created: number; updated: number; skipped: number; failed: number }
                    }
                    if (s?.ok) {
                      setPublishProgress(s.progress || 0)
                      if (s.totals) setPublishTotals(s.totals)
                      if (s.state === 'published') {
                        // Redirect once complete; prefer server totals
                        const t = s.totals || publishTotals || { created: 0, updated: 0, skipped: 0, failed: 0 }
                        const query = new URLSearchParams()
                        query.set('tag', `importRun:${run.id}`)
                        query.set('banner', 'publishOk')
                        query.set('created', String(t.created))
                        query.set('updated', String(t.updated))
                        query.set('skipped', String(t.skipped))
                        query.set('failed', String(t.failed))
                        window.location.assign(`/app/products?${query.toString()}`)
                        return
                      }
                    }
                  }
                } catch {
                  /* ignore transient errors */
                }
                if (polling) setTimeout(poll, 800)
              }
              setTimeout(poll, 0)
              try {
                const resp = await fetch(`/api/importer/runs/${run.id}/publish/shopify`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ dryRun: true }),
                })
                if (!resp.ok) throw new Error('Publish failed')
                const jr = (await resp.json()) as {
                  ok: boolean
                  runId: string
                  totals: { created: number; updated: number; skipped: number; failed: number }
                  filter: { tag: string }
                }
                if (jr?.ok) {
                  setPublishTotals(jr.totals)
                  setPublishProgress(p => (p < 90 ? 90 : p))
                } else {
                  setToast('Publish failed')
                  setPolling(false)
                }
              } catch (e) {
                setToast((e as Error)?.message || 'Publish failed')
                setPolling(false)
              } finally {
                setPublishing(false)
              }
            }}
          >
            Publish to Shopify
          </Button>
        </InlineStack>
        <ReviewFilters searchParams={params} onChange={setParams} />
        <Modal
          open={publishing}
          onClose={() => {
            setPublishing(false)
            setPolling(false)
          }}
          title="Publishing to Shopify…"
          primaryAction={{ content: 'Close', onAction: () => setPublishing(false) }}
        >
          <Modal.Section>
            <BlockStack gap="200">
              <Text as="p">This may take a minute. You can safely leave this page.</Text>
              <ProgressBar progress={publishProgress || 10} size="small" />
              {publishTotals ? (
                <Text as="p">
                  Created {publishTotals.created}, Updated {publishTotals.updated}, Skipped {publishTotals.skipped},
                  Failed {publishTotals.failed}
                </Text>
              ) : null}
            </BlockStack>
          </Modal.Section>
        </Modal>
        <ReviewIndexTable
          runId={run.id}
          rows={data.rows || []}
          columns={data.columns || []}
          page={data.page || page}
          pageSize={data.pageSize || pageSize}
          totalPages={data.totalPages || 1}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          expandedRowId={expandedRowId}
          onExpand={setExpandedRowId}
          onPageChange={(p: number) => {
            const usp = new URLSearchParams(params)
            usp.set('page', String(p))
            setParams(usp)
          }}
          onPageSizeChange={(s: number) => {
            const usp = new URLSearchParams(params)
            usp.set('pageSize', String(s))
            usp.set('page', '1')
            setParams(usp)
          }}
          onApproveSelected={() => bulkAction('approve')}
          onRejectSelected={() => bulkAction('reject')}
        />
      </BlockStack>
    </Page>
  )
}
// <!-- END RBP GENERATED: importer-review-inline-v1 -->
