// <!-- BEGIN RBP GENERATED: hq-import-runs-list-v1 -->
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, useSearchParams, useFetcher, useLocation, useNavigate } from '@remix-run/react'
import { useEffect } from 'react'
import { requireHQAccess } from '../services/auth/guards.server'
import { prisma } from '../db.server'
import { authenticate } from '../shopify.server'
import { useMemo } from 'react'
import { EmptyState } from '@shopify/polaris'
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  IndexTable,
  ChoiceList,
  ButtonGroup,
} from '@shopify/polaris'
import { ImportNav } from '../components/importer/ImportNav'

type RunRow = {
  id: string
  supplierId: string
  startedAt: string
  finishedAt: string | null
  status: string
  counts: { add: number; change: number; delete: number; conflict: number }
  unresolvedAdds: number
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  const { session } = await authenticate.admin(request)
  const shop = (session as unknown as { shop?: string }).shop || ''
  const url = new URL(request.url)
  const supplier = url.searchParams.get('supplier') || undefined
  const status = url.searchParams.get('status') || undefined
  const from = url.searchParams.get('from') || undefined
  const to = url.searchParams.get('to') || undefined
  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : undefined
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const runs = (await db.importRun.findMany({
    where: {
      ...(supplier ? { supplierId: supplier } : {}),
      ...(status ? { status } : {}),
      ...(fromDate || toDate
        ? {
            startedAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: 50,
  })) as Array<{ id: string; supplierId: string; startedAt: Date; finishedAt: Date | null; status: string }>

  const ids = runs.map(r => r.id)
  const diffs = (await db.importDiff.findMany({
    where: { importRunId: { in: ids } },
    select: { importRunId: true, diffType: true, resolution: true },
  })) as Array<{ importRunId: string; diffType: string; resolution?: string | null }>

  const countsByRun: Record<string, RunRow['counts'] & { unresolvedAdds: number }> = {}
  for (const id of ids) countsByRun[id] = { add: 0, change: 0, delete: 0, conflict: 0, unresolvedAdds: 0 }
  for (const d of diffs) {
    const c = countsByRun[d.importRunId]
    if (!c) continue
    if (d.diffType === 'add') {
      c.add++
      if (!d.resolution) c.unresolvedAdds++
    } else if (d.diffType === 'change') c.change++
    else if (d.diffType === 'delete') c.delete++
    else if (d.diffType === 'conflict') c.conflict++
  }

  const rows: RunRow[] = runs.map(r => ({
    id: r.id,
    supplierId: r.supplierId,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    status: r.status,
    counts: {
      add: countsByRun[r.id].add,
      change: countsByRun[r.id].change,
      delete: countsByRun[r.id].delete,
      conflict: countsByRun[r.id].conflict,
    },
    unresolvedAdds: countsByRun[r.id].unresolvedAdds,
  }))

  return json({ runs: rows, supplier: supplier || '', status: status || '', from: from || '', to: to || '', shop })
}

export default function ImportRunsIndex() {
  const { runs, supplier, status, from, to, shop } = useLoaderData<typeof loader>() as {
    runs: RunRow[]
    supplier: string
    status: string
    from: string
    to: string
    shop: string
  }
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  // One-time migrated toast
  // One-time migrated toast on mount when redirected from v1
  useEffect(() => {
    if (location.search.includes('migrated=1')) {
      try {
        const w = window as unknown as { shopifyToast?: { info?: (m: string) => void } }
        w.shopifyToast?.info?.('Supplier Import Wizard (v1) has been retired.')
      } catch {
        // ignore toast errors in SSR/loader context
      }
    }
  }, [location.search])
  const fetcher = useFetcher()

  const headings = useMemo(
    () => [
      { title: 'Run ID' },
      { title: 'Supplier' },
      { title: 'Started' },
      { title: 'Finished' },
      { title: 'Status' },
      { title: 'Adds' },
      { title: 'Changes' },
      { title: 'Deletes' },
      { title: 'Conflicts' },
      { title: 'Unresolved Adds' },
      { title: 'Actions' },
    ],
    [],
  ) as unknown as [{ title: string }, ...{ title: string }[]]

  const prettyTime = (iso: string | null) => {
    if (!iso) return '-'
    const d = new Date(iso)
    const abs = d.toISOString().replace('T', ' ').replace('Z', ' UTC')
    const ms = Date.now() - d.getTime()
    const mins = Math.max(0, Math.floor(ms / 60000))
    const rel = mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`
    return `${rel} (${abs})`
  }

  const prettyStatus = (r: RunRow): { label: string; tone: 'success' | 'critical' | 'attention' | 'info' } => {
    // naive applied detection: finishedAt + no unresolved adds + status=success -> applied; refine when backend adds flag
    if (r.status === 'failed') return { label: 'failed', tone: 'critical' }
    if (r.status === 'started') return { label: 'started', tone: 'attention' }
    if (r.unresolvedAdds > 0) return { label: 'needs review', tone: 'attention' }
    // If finished and success with no unresolved adds, consider approved/applied
    if (r.finishedAt && r.status === 'success') return { label: 'approved', tone: 'success' }
    return { label: r.status, tone: 'info' }
  }

  if (runs.length === 0) {
    return (
      <Card>
        <BlockStack gap="300">
          <ImportNav current="runs" title="Import Runs" />
          <InlineStack gap="100" blockAlign="center">
            <Text as="span" variant="bodySm">
              From
            </Text>
            <input
              type="date"
              value={from}
              onChange={e => {
                const next = new URLSearchParams(params)
                const v = e.currentTarget.value
                if (v) next.set('from', v)
                else next.delete('from')
                setParams(next)
              }}
            />
            <Text as="span" variant="bodySm">
              To
            </Text>
            <input
              type="date"
              value={to}
              onChange={e => {
                const next = new URLSearchParams(params)
                const v = e.currentTarget.value
                if (v) next.set('to', v)
                else next.delete('to')
                setParams(next)
              }}
            />
          </InlineStack>
          <EmptyState
            heading="No import runs yet"
            action={{ content: 'Start Import', url: '/app/products' }}
            secondaryAction={{ content: 'Importer Settings', url: '/app/admin/import/settings' }}
            image="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images/empty-state.svg"
          >
            <p>Start an import from the Products page to ingest supplier products and review diffs here.</p>
          </EmptyState>
        </BlockStack>
      </Card>
    )
  }

  return (
    <Card>
      <BlockStack gap="300">
        <ImportNav current="runs" title="Import Runs" />
        <InlineStack align="space-between">
          <InlineStack>
            <Button variant="primary" onClick={() => navigate('/app/admin/import/new')}>
              New Import
            </Button>
          </InlineStack>
          <InlineStack>
            <Button onClick={() => navigate('/app/admin/import/settings')}>Settings</Button>
          </InlineStack>
        </InlineStack>
        <InlineStack align="space-between">
          <InlineStack gap="200" blockAlign="center">
            <Text as="h3" variant="headingMd">
              Filters
            </Text>
            <ButtonGroup>
              <Button
                variant={!status ? 'primary' : undefined}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  next.delete('status')
                  setParams(next)
                }}
              >
                All
              </Button>
              <Button
                variant={status === 'started' ? 'primary' : undefined}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  next.set('status', 'started')
                  setParams(next)
                }}
              >
                In progress
              </Button>
              <Button
                variant={status === 'success' ? 'primary' : undefined}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  next.set('status', 'success')
                  setParams(next)
                }}
              >
                Succeeded
              </Button>
              <Button
                variant={status === 'failed' ? 'primary' : undefined}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  next.set('status', 'failed')
                  setParams(next)
                }}
              >
                Failed
              </Button>
            </ButtonGroup>
          </InlineStack>
          <InlineStack gap="200">
            {/* Filters */}
            <ChoiceList
              title="Supplier"
              titleHidden
              choices={[
                { label: 'All', value: '' },
                { label: 'batson', value: 'batson' },
              ]}
              selected={[supplier]}
              onChange={values => {
                const next = new URLSearchParams(params)
                const v = values?.[0] || ''
                if (v) next.set('supplier', v)
                else next.delete('supplier')
                setParams(next)
              }}
            />
            <ChoiceList
              title="Status"
              titleHidden
              choices={[
                { label: 'All', value: '' },
                { label: 'started', value: 'started' },
                { label: 'success', value: 'success' },
                { label: 'failed', value: 'failed' },
              ]}
              selected={[status]}
              onChange={values => {
                const next = new URLSearchParams(params)
                const v = values?.[0] || ''
                if (v) next.set('status', v)
                else next.delete('status')
                setParams(next)
              }}
            />
          </InlineStack>
        </InlineStack>
        <IndexTable
          resourceName={{ singular: 'run', plural: 'runs' }}
          itemCount={runs.length}
          headings={headings}
          selectable={false}
        >
          {runs.map((r, idx) => {
            const canApply = r.unresolvedAdds === 0
            return (
              <IndexTable.Row id={r.id} key={r.id} position={idx}>
                <IndexTable.Cell>
                  <code className="text-xs">{r.id}</code>
                </IndexTable.Cell>
                <IndexTable.Cell>{r.supplierId}</IndexTable.Cell>
                <IndexTable.Cell>{prettyTime(r.startedAt)}</IndexTable.Cell>
                <IndexTable.Cell>{prettyTime(r.finishedAt)}</IndexTable.Cell>
                <IndexTable.Cell>
                  {(() => {
                    const s = prettyStatus(r)
                    return <Badge tone={s.tone}>{s.label}</Badge>
                  })()}
                </IndexTable.Cell>
                <IndexTable.Cell>{r.counts.add}</IndexTable.Cell>
                <IndexTable.Cell>{r.counts.change}</IndexTable.Cell>
                <IndexTable.Cell>{r.counts.delete}</IndexTable.Cell>
                <IndexTable.Cell>{r.counts.conflict}</IndexTable.Cell>
                <IndexTable.Cell>{r.unresolvedAdds}</IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="100">
                    <Button url={`/app/admin/import/runs/${r.id}`}>Review</Button>
                    <Button onClick={() => navigate(`/app/admin/import/${r.id}/edit`)}>Re-run</Button>
                    <fetcher.Form method="post" action="/app/admin/import/apply-run">
                      <input type="hidden" name="runId" value={r.id} />
                      <input type="hidden" name="shop" value={shop} />
                      <Button submit disabled={!canApply || fetcher.state === 'submitting'}>
                        Apply
                      </Button>
                    </fetcher.Form>
                  </InlineStack>
                </IndexTable.Cell>
              </IndexTable.Row>
            )
          })}
        </IndexTable>
      </BlockStack>
    </Card>
  )
}
// <!-- END RBP GENERATED: hq-import-runs-list-v1 -->
