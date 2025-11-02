// <!-- BEGIN RBP GENERATED: importer-review-inline-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useEffect, useMemo, useState } from 'react'
import { useFetcher, useLoaderData, useSearchParams } from '@remix-run/react'
import { Page, Banner, Tabs, BlockStack, Toast, Frame } from '@shopify/polaris'
import { prisma } from '../db.server'
import { isHqShop } from '../lib/access.server'
import ReviewFilters from 'app/components/importer/review/ReviewFilters'
import ReviewIndexTable from 'app/components/importer/review/ReviewIndexTable'

export async function loader({ request, params }: LoaderFunctionArgs) {
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
  const title = 'Review import'
  const subtitle = `${run.supplierId} — ${new Date(run.startedAt).toLocaleString()}`

  return (
    <Page title={title} subtitle={subtitle} backAction={{ content: 'Back to imports', url: '/app/admin/import/runs' }}>
      <BlockStack gap="400">
        {toast ? (
          <Frame>
            <Toast content={toast} duration={2000} onDismiss={() => setToast(null)} />
          </Frame>
        ) : null}
        {hasConflicts ? (
          <Banner tone="critical" title="Resolve conflicts before publishing to Shopify."></Banner>
        ) : null}
        <Tabs tabs={tabs as unknown as { id: string; content: string }[]} selected={selectedTab} onSelect={setTab} />
        <ReviewFilters searchParams={params} onChange={setParams} />
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
