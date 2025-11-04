// redirect shim only; do not expand.
// <!-- BEGIN RBP GENERATED: hq-run-detail-tabs-v1 -->
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import { useEffect, useMemo, useState } from 'react'
import { useLoaderData, useFetcher, useSearchParams, useNavigation, Link, useLocation } from '@remix-run/react'
import { requireHQAccess } from '../services/auth/guards.server'
import { prisma } from '../db.server'
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  IndexTable,
  Tabs,
  Tooltip,
  Modal,
  Pagination,
  TextField,
} from '@shopify/polaris'
import { ImportNav } from '../components/importer/ImportNav'
// <!-- BEGIN RBP GENERATED: admin-link-manifest-selftest-v1 -->
import { TEST_IDS } from '../../src/config/testIds'
// <!-- END RBP GENERATED: admin-link-manifest-selftest-v1 -->

type DiffRow = {
  id: string
  externalId: string
  diffType: 'add' | 'change' | 'delete' | 'conflict'
  resolution: string | null
  title: string
  partType?: string | null
  priceMsrp?: number | null
  priceWh?: number | null
  thumb?: string | null
  specsPreview: Array<{ key: string; value: string }>
}

// legacy types and imports pruned; route now redirects

type LoaderData = {
  runId: string
  shop: string
  supplierId?: string
  counts: { add: number; change: number; delete: number; conflict: number; unresolvedAdds: number }
  rows: DiffRow[]
  selectedTab: 'adds' | 'changes' | 'deletes' | 'conflicts'
  page: number
  pageSize: number
  missingImagesOnPage: number
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  const url = new URL(request.url)
  const search = url.search
  const runId = String(params.runId)
  return redirect(`/app/imports/runs/${runId}/review${search}`)
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireHQAccess(request)
  const runId = String(params.runId)
  const fd = await request.formData()
  const intent = String(fd.get('intent') || '')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  if (intent === 'bulk-approve-adds') {
    await db.importDiff.updateMany({
      where: { importRunId: runId, diffType: 'add', OR: [{ resolution: null }, { resolution: 'pending' }] },
      data: { resolution: 'approve', resolvedAt: new Date() },
    })
    return json({ ok: true })
  }
  if (intent === 'resolve-diff') {
    const diffId = String(fd.get('diffId') || '')
    const resolution = String(fd.get('resolution') || '')
    if (!diffId || !resolution) return json({ ok: false, error: 'Missing diffId/resolution' }, { status: 400 })
    // Optional inline edits payload as JSON to merge into `after`
    const editsRaw = fd.get('edits')?.toString()
    if (editsRaw) {
      try {
        const edits = JSON.parse(editsRaw) as Record<string, unknown>
        const current = (await db.importDiff.findUnique({ where: { id: diffId }, select: { after: true } })) as {
          after: unknown
        } | null
        const afterObj = (current?.after || {}) as Record<string, unknown>
        // Shallow merge at top-level; also support nested normSpecs merge if provided
        const nextAfter: Record<string, unknown> = { ...afterObj }
        for (const [k, v] of Object.entries(edits)) {
          if (k === 'normSpecs' && typeof v === 'object' && v) {
            const ns = (nextAfter.normSpecs as Record<string, unknown>) || {}
            nextAfter.normSpecs = { ...ns, ...(v as Record<string, unknown>) }
          } else {
            nextAfter[k] = v
          }
        }
        await db.importDiff.update({
          where: { id: diffId },
          data: { after: nextAfter, resolution, resolvedAt: new Date() },
        })
      } catch {
        return json({ ok: false, error: 'Invalid edits payload' }, { status: 400 })
      }
    } else {
      await db.importDiff.update({ where: { id: diffId }, data: { resolution, resolvedAt: new Date() } })
    }
    return json({ ok: true })
  }
  return json({ ok: false }, { status: 400 })
}

export default function RunDetailPage() {
  const data = useLoaderData<typeof loader>() as LoaderData
  const { runId, shop, counts, supplierId } = data
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigation = useNavigation()
  const canApply = counts.unresolvedAdds === 0

  const resolveFetcher = useFetcher<{ ok?: boolean; error?: string }>()
  const bulkFetcher = useFetcher<{ ok?: boolean; error?: string }>()
  const applyFetcher = useFetcher<{
    ok?: boolean
    error?: string
    results?: Array<{ externalId: string; productId: number; handle: string; action: 'created' | 'updated' }>
  }>()

  // Minimal toast helper with safe access
  const toast = useMemo(
    () => ({
      success: (msg: string) => {
        try {
          const w = window as unknown as { shopifyToast?: { success?: (m: string) => void } }
          w.shopifyToast?.success?.(msg)
        } catch {
          // no-op
        }
      },
      error: (msg: string) => {
        try {
          const w = window as unknown as { shopifyToast?: { error?: (m: string) => void } }
          w.shopifyToast?.error?.(msg)
        } catch {
          // no-op
        }
      },
    }),
    [],
  )

  // Success/error feedback for actions
  useEffect(() => {
    if (resolveFetcher.state === 'idle') {
      const ok = resolveFetcher.data?.ok
      if (ok) toast.success('Resolved')
      else toast.error('Failed to resolve')
      // Refresh to update counts and rows
      if (ok) {
        try {
          window.location.reload()
        } catch {
          // ignore
        }
      }
    }
  }, [resolveFetcher.state])

  useEffect(() => {
    if (bulkFetcher.state === 'idle') {
      const ok = bulkFetcher.data?.ok
      if (ok) toast.success('Approved all Adds')
      else toast.error('Failed to bulk approve')
      if (ok) {
        try {
          window.location.reload()
        } catch {
          // ignore
        }
      }
    }
  }, [bulkFetcher.state])

  useEffect(() => {
    if (applyFetcher.state === 'idle') {
      const ok = applyFetcher.data?.ok ?? true
      if (ok) {
        const count = applyFetcher.data?.results?.length || 0
        toast.success(count ? `Applied ${count} changes` : 'Apply completed')
      } else {
        toast.error('Apply failed')
      }
    }
  }, [applyFetcher.state])

  const tabsList = ['adds', 'changes', 'conflicts', 'deletes'] as const
  const selectedTabIndex = Math.max(0, tabsList.indexOf(data.selectedTab))
  const [inspecting, setInspecting] = useState<null | { id: string; title: string }>(null)
  const [editPower, setEditPower] = useState('')
  const [editAction, setEditAction] = useState('')
  const [editTipSize, setEditTipSize] = useState('')
  const [deleteOverride, setDeleteOverride] = useState(false)
  const detailFetcher = useFetcher<{
    ok?: boolean
    diff?: {
      id: string
      before: unknown
      after: unknown
      externalId: string
      diffType: DiffRow['diffType']
      resolution: string | null
    }
  }>()
  useEffect(() => {
    if (detailFetcher.data?.ok && detailFetcher.data.diff?.after) {
      const after = detailFetcher.data.diff.after as Record<string, unknown>
      const ns = ((after['normSpecs'] as Record<string, unknown>) || {}) as Record<string, unknown>
      setEditPower(typeof ns.power === 'string' || typeof ns.power === 'number' ? String(ns.power) : '')
      setEditAction(typeof ns.action === 'string' ? (ns.action as string) : '')
      setEditTipSize(typeof ns.tip_size === 'string' || typeof ns.tip_size === 'number' ? String(ns.tip_size) : '')
    } else {
      setEditPower('')
      setEditAction('')
      setEditTipSize('')
    }
  }, [detailFetcher.data?.ok, detailFetcher.data?.diff?.id])
  // Inline edit fields will be introduced later; keeping read-only inspector for now
  const tabs = [
    { id: 'adds', content: `Adds (${counts.add})`, panelID: 'tab-adds' },
    { id: 'changes', content: `Changes (${counts.change})`, panelID: 'tab-changes' },
    { id: 'conflicts', content: `Conflicts (${counts.conflict})`, panelID: 'tab-conflicts' },
    { id: 'deletes', content: `Deletes (${counts.delete})`, panelID: 'tab-deletes' },
  ]

  const currentRows: DiffRow[] = data.rows
  const page = data.page
  const pageSize = data.pageSize
  const totalsByTab = { adds: counts.add, changes: counts.change, conflicts: counts.conflict, deletes: counts.delete }
  const total = totalsByTab[data.selectedTab]
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const isLoading = navigation.state !== 'idle'
  const hasAny = counts.add + counts.change + counts.delete + counts.conflict > 0

  const headings = useMemo(
    () => [
      { title: '' },
      { title: 'Title' },
      { title: 'External ID' },
      { title: 'Type' },
      { title: 'Specs' },
      { title: 'Prices' },
      { title: 'Actions' },
    ],
    [],
  ) as unknown as [{ title: string }, ...{ title: string }[]]

  const renderRow = (r: DiffRow, idx: number) => {
    return (
      <IndexTable.Row id={r.id} key={r.id} position={idx}>
        <IndexTable.Cell>
          {r.thumb ? (
            <img src={r.thumb} alt="thumb" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
          ) : (
            <div style={{ width: 40, height: 40, background: '#eee', borderRadius: 4 }} />
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">
            {r.priceMsrp != null ? `$${r.priceMsrp}` : '-'}
          </Text>
          <Text as="span" variant="bodySm" tone="subdued">
            {r.priceWh != null ? ` / $${r.priceWh}` : ''}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100">
            <resolveFetcher.Form method="post">
              <input type="hidden" name="intent" value="resolve-diff" />
              <input type="hidden" name="diffId" value={r.id} />
              <input type="hidden" name="resolution" value="approve" />
              <Button
                submit
                size="slim"
                variant="primary"
                tone="success"
                disabled={resolveFetcher.state === 'submitting'}
              >
                Approve
              </Button>
            </resolveFetcher.Form>
            <resolveFetcher.Form method="post">
              <input type="hidden" name="intent" value="resolve-diff" />
              <input type="hidden" name="diffId" value={r.id} />
              <input type="hidden" name="resolution" value="reject" />
              <Button submit size="slim" tone="critical" disabled={resolveFetcher.state === 'submitting'}>
                Reject
              </Button>
            </resolveFetcher.Form>
            <Button
              size="slim"
              onClick={() => {
                setInspecting({ id: r.id, title: r.title })
                detailFetcher.load(`/app/admin/import/diff/${r.id}`)
              }}
            >
              Inspect
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  }

  if (!hasAny) {
    return (
      <Card>
        <BlockStack gap="300">
          <ImportNav current="runs" title={`Run ${runId.slice(0, 8)}…${supplierId ? ` — ${supplierId}` : ''}`} />
          {/* BEGIN RBP GENERATED: admin-link-integrity-v1 */}
          {/* <!-- BEGIN RBP GENERATED: admin-link-manifest-selftest-v1 --> */}
          <Link to={`/app/admin/import/runs${location.search}`} data-testid={TEST_IDS.crumbBackToRuns}>
            ← Back to Import Runs
          </Link>
          {/* <!-- END RBP GENERATED: admin-link-manifest-selftest-v1 --> */}
          {/* END RBP GENERATED: admin-link-integrity-v1 */}
          <div className="flex flex-col items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 p-8 text-center">
            <div style={{ fontSize: 36 }}>🎉</div>
            <Text as="h2" variant="headingLg">
              No diffs to review
            </Text>
            <Text as="p" tone="subdued" variant="bodyMd">
              This run has no adds, changes, conflicts, or deletes.
            </Text>
            <InlineStack gap="300" align="center">
              {/* BEGIN RBP GENERATED: admin-link-integrity-v1 */}
              {/* <!-- BEGIN RBP GENERATED: admin-link-manifest-selftest-v1 --> */}
              <a
                className="underline"
                href={`/app/admin/import/runs${location.search}`}
                data-testid={TEST_IDS.crumbBackToRuns}
              >
                Back to Runs
              </a>
              {/* <!-- END RBP GENERATED: admin-link-manifest-selftest-v1 --> */}
              {/* END RBP GENERATED: admin-link-integrity-v1 */}
              <a className="underline" href="/app/products">
                Go to Products
              </a>
            </InlineStack>
          </div>
        </BlockStack>
      </Card>
    )
  }

  return (
    <Card>
      <BlockStack gap="300">
        <ImportNav current="runs" title={`Run ${runId.slice(0, 8)}…${supplierId ? ` — ${supplierId}` : ''}`} />
        {/* BEGIN RBP GENERATED: admin-link-integrity-v1 */}
        {/* <!-- BEGIN RBP GENERATED: admin-link-manifest-selftest-v1 --> */}
        <Link to={`/app/admin/import/runs${location.search}`} data-testid={TEST_IDS.crumbBackToRuns}>
          ← Back to Import Runs
        </Link>
        {/* <!-- END RBP GENERATED: admin-link-manifest-selftest-v1 --> */}
        {/* END RBP GENERATED: admin-link-integrity-v1 */}
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Badge tone="success">{`Adds ${counts.add}`}</Badge>
            <Badge tone="info">{`Changes ${counts.change}`}</Badge>
            <Badge tone="warning">{`Conflicts ${counts.conflict}`}</Badge>
            <Badge tone="critical">{`Deletes ${counts.delete}`}</Badge>
          </InlineStack>
          <InlineStack gap="200" blockAlign="center">
            <Text as="span" tone="subdued">
              Run {runId.slice(0, 8)}…
            </Text>
          </InlineStack>
        </InlineStack>
        {applyFetcher.data?.ok && applyFetcher.data?.results && applyFetcher.data.results.length > 0 && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <Text as="p" variant="bodySm" fontWeight="semibold">
              Shopify changes
            </Text>
            <ul className="mt-2 list-disc pl-5">
              {applyFetcher.data.results.slice(0, 10).map(r => (
                <li key={`${r.handle}-${r.productId}`}>
                  {r.action} —{' '}
                  <a href={`https://${shop}/admin/products/${r.productId}`} target="_blank" rel="noreferrer">
                    {r.handle}
                  </a>
                </li>
              ))}
            </ul>
            {applyFetcher.data.results.length > 10 && (
              <Text as="p" tone="subdued" variant="bodySm">
                …and {applyFetcher.data.results.length - 10} more
              </Text>
            )}
          </div>
        )}
        {!canApply && (
          <div role="alert" className="mb-3 rounded-lg border border-amber-400 bg-amber-50 p-3">
            <strong>{counts.unresolvedAdds}</strong> of <strong>{counts.add}</strong> new products need review before
            applying.
            <a href="#tab-adds" className="ml-2 underline">
              Go to Adds
            </a>
          </div>
        )}

        {data.selectedTab === 'adds' && data.missingImagesOnPage > 0 && (
          <div role="alert" className="mb-3 rounded-lg border border-amber-400 bg-amber-50 p-3">
            <strong>{data.missingImagesOnPage}</strong> item{data.missingImagesOnPage === 1 ? '' : 's'} on this page{' '}
            have no images. Images are required for product adds.
          </div>
        )}

        <InlineStack align="space-between">
          <InlineStack gap="200">
            <bulkFetcher.Form method="post">
              <input type="hidden" name="intent" value="bulk-approve-adds" />
              {data.selectedTab === 'adds' && data.missingImagesOnPage > 0 ? (
                <Tooltip content="Cannot approve all: some items on this page have no images">
                  <div>
                    <Button disabled id="tab-adds">
                      Approve All Adds
                    </Button>
                  </div>
                </Tooltip>
              ) : (
                <Button submit id="tab-adds" disabled={counts.add === 0 || bulkFetcher.state === 'submitting'}>
                  Approve All Adds
                </Button>
              )}
            </bulkFetcher.Form>
          </InlineStack>
          <InlineStack gap="200">
            <applyFetcher.Form method="post" action="/app/admin/import/apply-run">
              <input type="hidden" name="runId" value={runId} />
              <input type="hidden" name="shop" value={shop} />
              {/* Future: wire this to backend to apply only approved diffs */}
              <label className="mr-2 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="approvedOnly" defaultChecked />
                Apply approved only
              </label>
              {data.selectedTab === 'deletes' && (
                <label className="mr-2 ml-4 inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="deleteOverride"
                    checked={deleteOverride}
                    onChange={e => setDeleteOverride(e.currentTarget.checked)}
                  />
                  Override delete policy for this run
                </label>
              )}
              {canApply ? (
                <Button submit loading={applyFetcher.state === 'submitting'}>
                  Apply Run
                </Button>
              ) : (
                <Tooltip content={`You must review all Adds (${counts.unresolvedAdds} remaining)`}>
                  <div>
                    <Button disabled>Apply Run</Button>
                  </div>
                </Tooltip>
              )}
            </applyFetcher.Form>
          </InlineStack>
        </InlineStack>

        <Tabs
          tabs={tabs}
          selected={selectedTabIndex}
          onSelect={(i: number) => {
            const next = new URLSearchParams(params)
            next.set('tab', tabsList[i])
            next.set('page', '1')
            setParams(next)
          }}
          fitted
        >
          <div style={{ paddingTop: 8 }}>
            <InlineStack align="space-between" blockAlign="center" gap="200">
              <Text as="span" tone="subdued">
                Page {page} of {totalPages} — {total} items
              </Text>
              <Pagination
                hasPrevious={page > 1}
                hasNext={page < totalPages}
                onPrevious={() => {
                  const next = new URLSearchParams(params)
                  next.set('page', String(Math.max(1, page - 1)))
                  setParams(next)
                }}
                onNext={() => {
                  const next = new URLSearchParams(params)
                  next.set('page', String(Math.min(totalPages, page + 1)))
                  setParams(next)
                }}
              />
            </InlineStack>
            <IndexTable
              resourceName={{ singular: 'diff', plural: 'diffs' }}
              itemCount={currentRows.length}
              headings={headings}
              selectable={false}
            >
              {isLoading
                ? Array.from({ length: Math.min(10, pageSize) }).map((_, idx) => (
                    <IndexTable.Row id={`sk-${idx}`} key={`sk-${idx}`} position={idx}>
                      <IndexTable.Cell>
                        <div style={{ width: 40, height: 40, background: '#f0f0f0', borderRadius: 4 }} />
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <div style={{ width: 180, height: 12, background: '#f0f0f0', borderRadius: 4 }} />
                        <div style={{ width: 120, height: 10, background: '#f0f0f0', borderRadius: 4, marginTop: 6 }} />
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <div style={{ width: 100, height: 10, background: '#f0f0f0', borderRadius: 4 }} />
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <div style={{ width: 60, height: 20, background: '#f0f0f0', borderRadius: 10 }} />
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <div style={{ width: 220, height: 10, background: '#f0f0f0', borderRadius: 4 }} />
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <div style={{ width: 80, height: 10, background: '#f0f0f0', borderRadius: 4 }} />
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <div style={{ width: 160, height: 28, background: '#f0f0f0', borderRadius: 4 }} />
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))
                : currentRows.map((r, idx) => renderRow(r, idx))}
            </IndexTable>
            <InlineStack align="end">
              <Pagination
                hasPrevious={page > 1}
                hasNext={page < totalPages}
                onPrevious={() => {
                  const next = new URLSearchParams(params)
                  next.set('page', String(Math.max(1, page - 1)))
                  setParams(next)
                }}
                onNext={() => {
                  const next = new URLSearchParams(params)
                  next.set('page', String(Math.min(totalPages, page + 1)))
                  setParams(next)
                }}
              />
            </InlineStack>
          </div>
        </Tabs>

        {/* Diff Inspector Modal */}
        {inspecting && (
          <Modal
            open
            onClose={() => setInspecting(null)}
            title={`Inspect — ${inspecting.title}`}
            primaryAction={{
              content: 'Save & Approve',
              onAction: () => {
                const form = new FormData()
                form.set('intent', 'resolve-diff')
                form.set('diffId', inspecting.id)
                form.set('resolution', 'approve')
                const edits: Record<string, unknown> = {}
                const ns: Record<string, unknown> = {}
                if (editPower) ns.power = editPower
                if (editAction) ns.action = editAction
                if (editTipSize) ns.tip_size = editTipSize
                if (Object.keys(ns).length > 0) {
                  // Ensure edits write back string fields if present from series parser
                  edits['normSpecs'] = ns
                  form.set('edits', JSON.stringify(edits))
                }
                resolveFetcher.submit(form, { method: 'post' })
                setInspecting(null)
              },
            }}
            secondaryActions={[
              {
                content: 'Reject',
                destructive: true,
                onAction: () => {
                  const form = new FormData()
                  form.set('intent', 'resolve-diff')
                  form.set('diffId', inspecting.id)
                  form.set('resolution', 'reject')
                  resolveFetcher.submit(form, { method: 'post' })
                  setInspecting(null)
                },
              },
            ]}
          >
            <Modal.Section>
              {detailFetcher.state !== 'idle' && !detailFetcher.data ? (
                <Text as="p">Loading…</Text>
              ) : !detailFetcher.data?.ok || !detailFetcher.data?.diff ? (
                <Text as="p" tone="critical">
                  Failed to load diff details.
                </Text>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Text as="h3" variant="headingSm">
                      Before
                    </Text>
                    <pre
                      style={{
                        background: '#f6f6f7',
                        padding: 12,
                        borderRadius: 6,
                        maxHeight: 360,
                        overflow: 'auto',
                        fontSize: 12,
                      }}
                    >
                      {detailFetcher.data.diff.before ? JSON.stringify(detailFetcher.data.diff.before, null, 2) : '—'}
                    </pre>
                  </div>
                  <div>
                    <Text as="h3" variant="headingSm">
                      After
                    </Text>
                    <pre
                      style={{
                        background: '#f6f6f7',
                        padding: 12,
                        borderRadius: 6,
                        maxHeight: 360,
                        overflow: 'auto',
                        fontSize: 12,
                      }}
                    >
                      {detailFetcher.data.diff.after ? JSON.stringify(detailFetcher.data.diff.after, null, 2) : '—'}
                    </pre>
                    <div style={{ marginTop: 12 }}>
                      <Text as="h3" variant="headingSm">
                        Quick edits
                      </Text>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                        <TextField label="Power" value={editPower} onChange={setEditPower} autoComplete="off" />
                        <TextField label="Action" value={editAction} onChange={setEditAction} autoComplete="off" />
                        <TextField label="Tip size" value={editTipSize} onChange={setEditTipSize} autoComplete="off" />
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <Text as="p" tone="subdued" variant="bodySm">
                          These edits update normSpecs and approve the diff.
                        </Text>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Modal.Section>
          </Modal>
        )}
        {data.selectedTab === 'deletes' && (
          <div role="note" className="mt-3 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm">
            <strong>Deletes policy</strong> — We retire products after 2 consecutive missing detections. Use the
            override toggle near the Apply button to mark deletions immediately for this run.
          </div>
        )}
      </BlockStack>
    </Card>
  )
}
// <!-- END RBP GENERATED: hq-run-detail-tabs-v1 -->
