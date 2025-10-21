// <!-- BEGIN RBP GENERATED: hq-run-detail-tabs-v1 -->
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import { useEffect, useMemo, useState } from 'react'
import { useLoaderData, useFetcher } from '@remix-run/react'
import { requireHQAccess } from '../services/auth/guards.server'
import { prisma } from '../db.server'
import { authenticate } from '../shopify.server'
import { Card, BlockStack, InlineStack, Text, Badge, Button, IndexTable, Tabs, Tooltip } from '@shopify/polaris'
import { ImportNav } from '../components/importer/ImportNav'

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

type PartLike = {
  title?: string
  name?: string
  partType?: string
  productType?: string
  images?: unknown
  normSpecs?: Record<string, unknown>
  rawSpecs?: Record<string, unknown>
  priceMsrp?: unknown
  priceWh?: unknown
}

type LoaderData = {
  runId: string
  shop: string
  supplierId?: string
  counts: { add: number; change: number; delete: number; conflict: number; unresolvedAdds: number }
  adds: DiffRow[]
  changes: DiffRow[]
  deletes: DiffRow[]
  conflicts: DiffRow[]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  const { session } = await authenticate.admin(request)
  const shop = (session as unknown as { shop?: string }).shop || ''
  const runId = String(params.runId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const run = (await db.importRun.findUnique({ where: { id: runId }, select: { supplierId: true } })) as {
    supplierId: string
  } | null
  const diffs = (await db.importDiff.findMany({
    where: { importRunId: runId },
    select: { id: true, externalId: true, diffType: true, before: true, after: true, resolution: true },
    orderBy: { id: 'asc' },
  })) as Array<{
    id: string
    externalId: string
    diffType: DiffRow['diffType']
    before: unknown
    after: unknown
    resolution: string | null
  }>

  const rows: DiffRow[] = diffs.map(d => {
    const disp: PartLike = ((d.after ?? d.before) as PartLike) || {}
    const title: string = disp.title || disp.name || d.externalId || '—'
    const partType: string | null = disp.partType ?? disp.productType ?? null
    const toNumber = (v: unknown): number | null =>
      typeof v === 'number' ? v : v && typeof v === 'string' ? Number(v) || null : null
    const priceMsrp = toNumber(disp.priceMsrp)
    const priceWh = toNumber(disp.priceWh)

    // Extract first image url
    let thumb: string | null = null
    const imgs = disp.images as unknown
    if (Array.isArray(imgs) && imgs.length) {
      const first = imgs[0]
      if (typeof first === 'string') thumb = first
      else if (first && typeof first === 'object') thumb = (first.src || first.url || first.href) ?? null
    }

    // Build a small specs preview (up to 3 entries)
    const specs = (disp.normSpecs || disp.rawSpecs || {}) as Record<string, unknown>
    const specsPreview: Array<{ key: string; value: string }> = []
    for (const [k, v] of Object.entries(specs)) {
      if (specsPreview.length >= 3) break
      if (v == null) continue
      const val = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : JSON.stringify(v)
      specsPreview.push({ key: k, value: val.slice(0, 60) })
    }

    return {
      id: d.id,
      externalId: d.externalId,
      diffType: d.diffType,
      resolution: d.resolution,
      title,
      partType,
      priceMsrp,
      priceWh,
      thumb,
      specsPreview,
    }
  })

  const chunk = (t: DiffRow['diffType']) => rows.filter(r => r.diffType === t)
  const adds = chunk('add')
  const changes = chunk('change')
  const deletes = chunk('delete')
  const conflicts = chunk('conflict')
  const unresolvedAdds = adds.filter(a => !a.resolution).length

  return json<LoaderData>({
    runId,
    shop,
    supplierId: run?.supplierId,
    counts: {
      add: adds.length,
      change: changes.length,
      delete: deletes.length,
      conflict: conflicts.length,
      unresolvedAdds,
    },
    adds,
    changes,
    deletes,
    conflicts,
  })
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
    await db.importDiff.update({ where: { id: diffId }, data: { resolution, resolvedAt: new Date() } })
    return json({ ok: true })
  }
  return json({ ok: false }, { status: 400 })
}

export default function RunDetailPage() {
  const data = useLoaderData<typeof loader>() as LoaderData
  const { runId, shop, counts, supplierId } = data
  const canApply = counts.unresolvedAdds === 0

  const resolveFetcher = useFetcher<{ ok?: boolean; error?: string }>()
  const bulkFetcher = useFetcher<{ ok?: boolean; error?: string }>()
  const applyFetcher = useFetcher<{ ok?: boolean; error?: string }>()

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
      if (ok) toast.success('Apply started')
      else toast.error('Apply failed')
    }
  }, [applyFetcher.state])

  const [selectedTab, setSelectedTab] = useState(0)
  const tabs = [
    { id: 'adds', content: `Adds (${counts.add})`, panelID: 'tab-adds' },
    { id: 'changes', content: `Changes (${counts.change})`, panelID: 'tab-changes' },
    { id: 'conflicts', content: `Conflicts (${counts.conflict})`, panelID: 'tab-conflicts' },
    { id: 'deletes', content: `Deletes (${counts.delete})`, panelID: 'tab-deletes' },
  ]

  const currentRows: DiffRow[] = useMemo(() => {
    if (selectedTab === 0) return data.adds
    if (selectedTab === 1) return data.changes
    if (selectedTab === 2) return data.conflicts
    return data.deletes
  }, [selectedTab, data])

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
    const badgeTone: 'success' | 'info' | 'critical' | 'warning' =
      r.diffType === 'add'
        ? 'success'
        : r.diffType === 'delete'
          ? 'critical'
          : r.diffType === 'conflict'
            ? 'warning'
            : 'info'
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
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {r.title}
            </Text>
            {r.partType && (
              <Text as="span" variant="bodySm" tone="subdued">
                {r.partType}
              </Text>
            )}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <code className="text-xs">{r.externalId}</code>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={badgeTone}>{r.diffType}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100">
            {r.specsPreview.map(s => (
              <div key={s.key} className="text-xs">
                <span className="font-medium">{s.key}:</span> {s.value}
              </div>
            ))}
          </InlineStack>
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
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  }

  return (
    <Card>
      <BlockStack gap="300">
        <ImportNav current="runs" title={`Run ${runId.slice(0, 8)}…${supplierId ? ` — ${supplierId}` : ''}`} />
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
        {!canApply && (
          <div role="alert" className="mb-3 rounded-lg border border-amber-400 bg-amber-50 p-3">
            <strong>{counts.unresolvedAdds}</strong> of <strong>{counts.add}</strong> new products need review before
            applying.
            <a href="#tab-adds" className="ml-2 underline">
              Go to Adds
            </a>
          </div>
        )}

        <InlineStack align="space-between">
          <InlineStack gap="200">
            <bulkFetcher.Form method="post">
              <input type="hidden" name="intent" value="bulk-approve-adds" />
              <Button submit id="tab-adds" disabled={counts.add === 0 || bulkFetcher.state === 'submitting'}>
                Approve All Adds
              </Button>
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

        <Tabs tabs={tabs} selected={selectedTab} onSelect={(i: number) => setSelectedTab(i)} fitted>
          <div style={{ paddingTop: 8 }}>
            <IndexTable
              resourceName={{ singular: 'diff', plural: 'diffs' }}
              itemCount={currentRows.length}
              headings={headings}
              selectable={false}
            >
              {currentRows.map((r, idx) => renderRow(r, idx))}
            </IndexTable>
          </div>
        </Tabs>
      </BlockStack>
    </Card>
  )
}
// <!-- END RBP GENERATED: hq-run-detail-tabs-v1 -->
