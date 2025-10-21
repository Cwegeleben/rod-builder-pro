// <!-- BEGIN RBP GENERATED: hq-import-runs-list-v1 -->
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, useSearchParams, useFetcher } from '@remix-run/react'
import { requireHQAccess } from '../services/auth/guards.server'
import { prisma } from '../db.server'
import { authenticate } from '../shopify.server'
import { useMemo } from 'react'
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const runs = (await db.importRun.findMany({
    where: {
      ...(supplier ? { supplierId: supplier } : {}),
      ...(status ? { status } : {}),
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

  return json({ runs: rows, supplier: supplier || '', status: status || '', shop })
}

export default function ImportRunsIndex() {
  const { runs, supplier, status, shop } = useLoaderData<typeof loader>() as {
    runs: RunRow[]
    supplier: string
    status: string
    shop: string
  }
  const [params, setParams] = useSearchParams()
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

  return (
    <Card>
      <BlockStack gap="300">
        <ImportNav current="runs" title="Import Runs" />
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
                <IndexTable.Cell>{new Date(r.startedAt).toLocaleString()}</IndexTable.Cell>
                <IndexTable.Cell>{r.finishedAt ? new Date(r.finishedAt).toLocaleString() : '-'}</IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={r.status === 'success' ? 'success' : r.status === 'failed' ? 'critical' : 'attention'}>
                    {r.status}
                  </Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>{r.counts.add}</IndexTable.Cell>
                <IndexTable.Cell>{r.counts.change}</IndexTable.Cell>
                <IndexTable.Cell>{r.counts.delete}</IndexTable.Cell>
                <IndexTable.Cell>{r.counts.conflict}</IndexTable.Cell>
                <IndexTable.Cell>{r.unresolvedAdds}</IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="100">
                    <Button url={`/app/admin/import/runs/${r.id}`}>Review</Button>
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
