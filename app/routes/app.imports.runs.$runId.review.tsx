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
  Badge,
  Tooltip,
} from '@shopify/polaris'
import { prisma } from '../db.server'
import { isHqShop } from '../lib/access.server'
import { smokesEnabled, extractSmokeToken } from '../lib/smokes.server'
import ReviewFilters from 'app/components/importer/review/ReviewFilters'
import ReviewIndexTable from 'app/components/importer/review/ReviewIndexTable'
import RunLogList from 'app/components/importer/review/RunLogList'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  // E2E stub mode: allow tests to render the Review page without HQ/session or DB
  if (url.searchParams.get('e2e') === '1') {
    const runId = String(params.runId || '')
    const now = new Date().toISOString()
    return json({ run: { id: runId || 'run-e2e', supplierId: 'test-supplier', startedAt: now }, smokeMode: false })
  }
  // Optional smoke-friendly mode: allow bypassing HQ if ENABLE_SMOKES and a valid token is provided
  const smokeParam = url.searchParams.get('smoke') === '1'
  let smokeMode = false
  if (smokeParam && smokesEnabled()) {
    const tok = extractSmokeToken(request)
    const expected = process.env.SMOKE_TOKEN || 'smoke-ok'
    if (tok && tok === expected) smokeMode = true
  }
  if (!smokeMode) {
    if (!(await isHqShop(request))) throw new Response('Not Found', { status: 404 })
  }

  const runId = String(params.runId || '')

  // In smoke mode, avoid hitting the DB entirely to prevent 500s if migrations lag
  if (smokeMode) {
    const now = new Date().toISOString()
    return json({ run: { id: runId, supplierId: 'smoke', startedAt: now }, smokeMode: true })
  }

  const run = await prisma.importRun.findUnique({
    where: { id: runId },
    select: { id: true, supplierId: true, startedAt: true },
  })
  if (!run) throw new Response('Not Found', { status: 404 })
  return json({ run, smokeMode })
}

type LoaderData = Awaited<ReturnType<typeof loader>> extends { json(): infer U } ? U : never

export default function ReviewRunRoute() {
  const { run, smokeMode } = useLoaderData<LoaderData>() as unknown as {
    run: { id: string; supplierId: string; startedAt: string }
    smokeMode: boolean
  }
  // Avoid SSR/CSR mismatches inside Polaris IndexTable by rendering it after mount
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const [params, setParams] = useSearchParams()
  const smokeToken = useMemo(() => (smokeMode ? params.get('token') || '' : ''), [smokeMode, params])
  const tab = (params.get('tab') as 'unlinked' | 'linked' | 'conflicts' | 'all') || 'all'
  const page = Math.max(1, Number(params.get('page') || '1') || 1)
  const pageSize = [25, 50].includes(Number(params.get('pageSize'))) ? Number(params.get('pageSize')) : 25

  const fetcher = useFetcher()
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [approveAddsLoading, setApproveAddsLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [publishTotals, setPublishTotals] = useState<{
    created: number
    updated: number
    skipped: number
    failed: number
  } | null>(null)
  const [bypassDryRunLoading, setBypassDryRunLoading] = useState(false)
  const [bypassDryRunResult, setBypassDryRunResult] = useState<null | {
    created: number
    updated: number
    skipped: number
    failed: number
  }>(null)
  const [dryRun, setDryRun] = useState(false)
  const [publishProgress, setPublishProgress] = useState<number>(0)
  const [publishEtaMs, setPublishEtaMs] = useState<number | null>(null)
  const [publishPhase, setPublishPhase] = useState<string | null>(null)
  const [publishFilterTag, setPublishFilterTag] = useState<string | null>(null)
  // Sticky summary bar metrics
  const summaryCounts = useMemo(() => {
    const created = publishTotals?.created ?? 0
    const updated = publishTotals?.updated ?? 0
    const skipped = publishTotals?.skipped ?? 0
    const failed = publishTotals?.failed ?? 0
    const selected = selectedIds.length
    return { created, updated, skipped, failed, selected }
  }, [publishTotals, selectedIds])
  type DebugLog = { id: string; type: string; at: string; payload: unknown }
  const debugFetcher = useFetcher<{ run?: unknown; logs?: DebugLog[] }>()
  const [showDebug, setShowDebug] = useState(false)
  // Auto-poll logs while debug panel is visible
  useEffect(() => {
    if (!showDebug) return
    let active = true
    const tick = async () => {
      try {
        debugFetcher.load(`/api/importer/runs/${run.id}/debug?nocache=${Date.now()}`)
      } catch {
        /* ignore */
      }
      if (active) setTimeout(tick, 2000)
    }
    // prime immediately
    tick()
    return () => {
      active = false
    }
  }, [showDebug, run.id])
  // const navigate = useNavigate()
  // const location = useLocation()

  // Fetch table data
  const listUrl = useMemo(() => {
    const usp = new URLSearchParams(params)
    usp.set('tab', tab)
    usp.set('page', String(page))
    usp.set('pageSize', String(pageSize))
    if (smokeMode) {
      const usp2 = new URLSearchParams()
      usp2.set('runId', run.id)
      usp2.set('tab', tab)
      usp2.set('page', String(page))
      usp2.set('pageSize', String(pageSize))
      if (smokeToken) usp2.set('token', smokeToken)
      return `/resources/smoke/importer/run-list?${usp2.toString()}`
    }
    return `/api/importer/runs/${run.id}/staged?${usp.toString()}`
  }, [params, tab, page, pageSize, run.id, smokeMode, smokeToken])
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

  // Helper: extract images array from a row (present in either attributes.images or core.images when available)
  function getRowImages(row: UIRow | undefined): unknown[] {
    if (!row) return []
    const attrImages = (row.attributes as { images?: unknown })?.images
    if (Array.isArray(attrImages)) return attrImages
    const coreImages = (row.core as unknown as { images?: unknown })?.images
    if (Array.isArray(coreImages)) return coreImages
    return []
  }

  const tabs = [
    { id: 'unlinked', content: `New (${data?.totals?.unlinked || 0})` },
    { id: 'linked', content: `Modified (${data?.totals?.linked || 0})` },
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
    // Smart approve-all heuristic: when approving and every selected new diff has images, include note
    const includeImagesNote =
      kind === 'approve' && selectedIds.length > 3 && data.rows?.length
        ? (() => {
            try {
              const byId = new Map((data.rows || []).map(r => [r.core.id, r]))
              let withImages = 0
              for (const id of selectedIds) {
                const row = byId.get(id)
                const imgs = getRowImages(row)
                if (imgs.length > 0) withImages += 1
              }
              return withImages === selectedIds.length
            } catch {
              return false
            }
          })()
        : false
    const resp = await fetch(`/api/importer/runs/${run.id}/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds }),
    })
    if (resp.ok) {
      if (kind === 'approve') {
        setToast(
          includeImagesNote ? `Approved ${selectedIds.length} (all with images)` : `Approved ${selectedIds.length}`,
        )
      } else {
        setToast(`Rejected ${selectedIds.length}`)
      }
      fetcher.load(listUrl)
      setSelectedIds([])
    }
  }

  async function singleAction(id: string, kind: 'approve' | 'reject') {
    if (!id) return
    const resp = await fetch(`/api/importer/runs/${run.id}/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    if (resp.ok) {
      if (kind === 'approve') {
        try {
          const row = (data.rows || []).find(r => r.core.id === id)
          const imgs = getRowImages(row)
          if (imgs.length > 0) {
            setToast('Approved (images present)')
          } else {
            setToast('Approved')
          }
        } catch {
          setToast('Approved')
        }
      } else {
        setToast('Rejected')
      }
      fetcher.load(listUrl)
      // keep current selection as-is
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
  // BEGIN RBP ADDED: publish + verify shop badges
  const [publishShop, setPublishShop] = useState<string | null>(null)
  const [verifyStats, setVerifyStats] = useState<{ shop: string | null; found: number; notFound: number } | null>(null)
  useEffect(() => {
    const url = `/api/importer/runs/${run.id}/debug?hq=1&nocache=${Date.now()}`
    fetch(url)
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!j) return
        try {
          const pubShop = j?.run?.summary?.publish?.shop || null
          setPublishShop(typeof pubShop === 'string' && pubShop ? pubShop : null)
          const v = j?.run?.summary?.verify || null
          if (v && typeof v === 'object') {
            const shop = typeof v.shop === 'string' ? v.shop : null
            const found = typeof v.found === 'number' ? v.found : 0
            const notFound = typeof v.notFound === 'number' ? v.notFound : 0
            setVerifyStats({ shop, found, notFound })
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {})
  }, [run.id])
  // END RBP ADDED
  return (
    <Page title={title} subtitle={subtitle} backAction={{ content: 'Back to Imports', url: '/app/imports' }}>
      <BlockStack gap="400">
        {/* aria-live region for announce of publish progress & totals */}
        <div
          aria-live="polite"
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
        >
          {publishing
            ? `Publishing progress ${publishProgress}%` +
              (publishTotals
                ? ` Created ${publishTotals.created} Updated ${publishTotals.updated} Skipped ${publishTotals.skipped} Failed ${publishTotals.failed}`
                : '')
            : publishTotals
              ? `Publish complete: Created ${publishTotals.created} Updated ${publishTotals.updated} Skipped ${publishTotals.skipped} Failed ${publishTotals.failed}`
              : ''}
        </div>
        {smokeMode ? (
          <Banner tone="warning" title="Read-only smoke mode">
            Actions like Approve/Reject and Publish are disabled in smoke mode. Use a normal session to make changes.
          </Banner>
        ) : null}
        {/* BEGIN RBP ADDED: Transparency + metrics badges */}
        {publishShop || verifyStats || publishTotals ? (
          <InlineStack gap="200" blockAlign="center" wrap>
            {publishShop ? <Badge tone="info">{`Published: ${publishShop}`}</Badge> : null}
            {verifyStats ? (
              <Badge tone={verifyStats.found > 0 ? 'success' : 'warning'}>
                {`Verified ${verifyStats.found}/${verifyStats.found + verifyStats.notFound}`}
              </Badge>
            ) : null}
            {publishTotals ? (
              <Badge tone="info">{`Metrics C:${publishTotals.created} U:${publishTotals.updated} S:${publishTotals.skipped} F:${publishTotals.failed}`}</Badge>
            ) : null}
            {publishShop && publishFilterTag ? (
              <Button
                size="slim"
                url={`https://${publishShop.replace(/^https?:\/\//, '')}/admin/products?query=${encodeURIComponent(
                  'tag:' + publishFilterTag,
                )}`}
                target="_blank"
              >
                Verify on Shopify
              </Button>
            ) : null}
          </InlineStack>
        ) : null}
        {/* END RBP ADDED */}
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
          <Banner tone="critical" title="Resolve conflicts before publishing to Shopify.">
            <BlockStack gap="150">
              <Text as="p" variant="bodySm" tone="subdued">
                Publishing is disabled while conflicts exist. Approve or reject conflicting items on the Conflicts tab.
              </Text>
              <InlineStack gap="150">
                <Button
                  size="slim"
                  onClick={() => {
                    const idx = tabs.findIndex(t => t.id === 'conflicts')
                    if (idx >= 0) setTab(idx)
                  }}
                >
                  View Conflicts
                </Button>
              </InlineStack>
            </BlockStack>
          </Banner>
        ) : null}
        {showDebug ? (
          <div style={{ padding: 4 }}>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Activity
              </Text>
              <RunLogList logs={(debugFetcher.data?.logs as DebugLog[]) || []} />
            </BlockStack>
          </div>
        ) : null}
        <InlineStack align="space-between">
          <InlineStack gap="200" blockAlign="center">
            <Tabs
              tabs={tabs as unknown as { id: string; content: string }[]}
              selected={selectedTab}
              onSelect={setTab}
            />
            {!smokeMode && (data?.totals?.unlinked || 0) > 0 ? (
              <Button
                disabled={approveAddsLoading}
                loading={approveAddsLoading}
                onClick={async () => {
                  try {
                    setApproveAddsLoading(true)
                    const r = await fetch(`/api/importer/runs/${run.id}/approve/adds`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                    })
                    const j = (await r.json()) as {
                      ok?: boolean
                      updated?: number
                      error?: string
                      totals?: { totalAdds?: number; unresolvedAdds?: number }
                      all?: boolean
                    }
                    if (!r.ok || !j?.ok) throw new Error(j?.error || 'Approve new items failed')
                    const totalAdds = j.totals?.totalAdds ?? undefined
                    const unresolved = j.totals?.unresolvedAdds ?? undefined
                    const parts: string[] = [`Approved ${j.updated || 0}`]
                    if (typeof totalAdds === 'number') parts.push(`of ${totalAdds}`)
                    if (j.all) parts.push('(all mode)')
                    if (typeof unresolved === 'number' && !j.all) parts.push(`(${unresolved} were unresolved)`)
                    setToast(parts.join(' '))
                    // Refresh list and totals
                    fetcher.load(listUrl)
                  } catch (e) {
                    setToast((e as Error)?.message || 'Approve new items failed')
                  } finally {
                    setApproveAddsLoading(false)
                  }
                }}
              >
                Approve All New
              </Button>
            ) : null}
          </InlineStack>
          {!smokeMode ? (
            <Tooltip
              content={
                hasConflicts
                  ? 'Resolve conflicts before publishing.'
                  : approvedCount === 0
                    ? 'Approve at least one item to enable publish.'
                    : 'Publish to Shopify'
              }
            >
              <span>
                <Button
                  variant="primary"
                  tone="success"
                  disabled={hasConflicts || approvedCount === 0}
                  aria-disabled={hasConflicts || approvedCount === 0}
                  aria-describedby={hasConflicts || approvedCount === 0 ? 'publish-disabled-reason' : undefined}
                  onClick={async () => {
                    setPublishEtaMs(null)
                    setPublishTotals(null)
                    if (dryRun) {
                      // One-shot dry run: show totals, no polling
                      setPublishing(true)
                      try {
                        const resp = await fetch(`/api/importer/runs/${run.id}/publish/shopify`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ dryRun: true }),
                        })
                        if (!resp.ok) throw new Error('Dry run failed')
                        const jr = (await resp.json()) as {
                          ok: boolean
                          runId: string
                          totals: { created: number; updated: number; skipped: number; failed: number }
                          filter?: { tag: string }
                        }
                        if (jr?.ok) {
                          setPublishTotals(jr.totals)
                          setPublishProgress(95)
                          if (jr?.filter?.tag) setPublishFilterTag(jr.filter.tag)
                          setToast(
                            `Dry run — Created ${jr.totals.created}, Updated ${jr.totals.updated}, Skipped ${jr.totals.skipped}, Failed ${jr.totals.failed}`,
                          )
                        } else {
                          setToast('Dry run failed')
                        }
                      } catch (e) {
                        setToast((e as Error)?.message || 'Dry run failed')
                      } finally {
                        setPublishing(false)
                      }
                      return
                    }
                    // Real publish with polling
                    setPublishing(true)
                    setPolling(true)
                    setPublishProgress(0)
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
                            etaMs?: number | null
                            phase?: string | null
                          }
                          if (s?.ok) {
                            setPublishProgress(s.progress || 0)
                            if (s.totals) setPublishTotals(s.totals)
                            setPublishEtaMs(typeof s.etaMs === 'number' ? s.etaMs : null)
                            setPublishPhase(s.phase || null)
                            if (s.state === 'published') {
                              const t = s.totals || { created: 0, updated: 0, skipped: 0, failed: 0 }
                              setToast(
                                `Published to Shopify — Created ${t.created}, Updated ${t.updated}, Skipped ${t.skipped}, Failed ${t.failed}`,
                              )
                              setPolling(false)
                              setPublishing(false)
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
                        body: JSON.stringify({ dryRun: false }),
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
                        if (jr?.filter?.tag) setPublishFilterTag(jr.filter.tag)
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
              </span>
            </Tooltip>
          ) : null}
        </InlineStack>
        {/* Disabled reason tooltip anchor */}
        {(hasConflicts || approvedCount === 0) && !smokeMode ? (
          <Text id="publish-disabled-reason" as="span" tone="subdued" variant="bodySm">
            {hasConflicts
              ? 'Publish disabled: resolve conflicts first.'
              : 'Publish disabled: approve at least one item.'}
          </Text>
        ) : null}
        {/* Diagnostic bypass dry-run publish: visible when diag=1 & token present in URL */}
        {(() => {
          const diag = params.get('diag') === '1'
          const token = params.get('token') || ''
          if (!diag || !token) return null
          return (
            <InlineStack gap="200" blockAlign="center">
              <Button
                disabled={bypassDryRunLoading || hasConflicts || approvedCount === 0}
                loading={bypassDryRunLoading}
                onClick={async () => {
                  setBypassDryRunLoading(true)
                  setBypassDryRunResult(null)
                  try {
                    const url = new URL(`/api/importer/runs/${run.id}/publish/shopify`, window.location.origin)
                    url.searchParams.set('diag', '1')
                    url.searchParams.set('token', token)
                    const resp = await fetch(url.toString(), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ dryRun: true }),
                    })
                    const jr = await resp.json()
                    if (!resp.ok || !jr?.ok) throw new Error(jr?.error || 'Bypass dry-run failed')
                    if (jr?.totals) setBypassDryRunResult(jr.totals)
                    setToast(
                      `Bypass dry-run — C:${jr?.totals?.created || 0} U:${jr?.totals?.updated || 0} S:${jr?.totals?.skipped || 0} F:${jr?.totals?.failed || 0}`,
                    )
                  } catch (e) {
                    setToast((e as Error)?.message || 'Bypass dry-run failed')
                  } finally {
                    setBypassDryRunLoading(false)
                  }
                }}
              >
                Diagnostic Dry Run (Bypass)
              </Button>
              {bypassDryRunResult ? (
                <Badge tone="success">
                  {`Diag Totals C:${bypassDryRunResult.created} U:${bypassDryRunResult.updated} S:${bypassDryRunResult.skipped} F:${bypassDryRunResult.failed}`}
                </Badge>
              ) : null}
            </InlineStack>
          )
        })()}
        {!smokeMode ? (
          <InlineStack gap="200" blockAlign="center">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={e => setDryRun(e.currentTarget.checked)}
                aria-label="Dry run"
              />
              <Text as="span" tone="subdued" variant="bodySm">
                Dry run first
              </Text>
            </label>
            {publishTotals ? (
              <Badge tone="info">{`Totals — C:${publishTotals.created} U:${publishTotals.updated} S:${publishTotals.skipped} F:${publishTotals.failed}`}</Badge>
            ) : null}
          </InlineStack>
        ) : null}
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
              {publishPhase ? (
                <Text as="p" tone="subdued">
                  Phase: {publishPhase}
                </Text>
              ) : null}
              <ProgressBar progress={publishProgress || 10} size="small" />
              {publishEtaMs != null ? <Text as="p">ETA: ~{Math.max(0, Math.ceil(publishEtaMs / 1000))}s</Text> : null}
              {publishTotals ? (
                <Text as="p">
                  Created {publishTotals.created}, Updated {publishTotals.updated}, Skipped {publishTotals.skipped},
                  Failed {publishTotals.failed}
                </Text>
              ) : null}
            </BlockStack>
          </Modal.Section>
        </Modal>
        {hydrated ? (
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
            onApproveSelected={
              smokeMode
                ? () => setToast('Disabled in smoke mode')
                : () => {
                    const count = selectedIds.length
                    bulkAction('approve')
                    if (count > 0) setToast(`Approved ${count} item${count === 1 ? '' : 's'}`)
                  }
            }
            onRejectSelected={
              smokeMode
                ? () => setToast('Disabled in smoke mode')
                : () => {
                    const count = selectedIds.length
                    bulkAction('reject')
                    if (count > 0) setToast(`Rejected ${count} item${count === 1 ? '' : 's'}`)
                  }
            }
            onApproveRow={
              smokeMode
                ? () => setToast('Disabled in smoke mode')
                : (id: string) => {
                    singleAction(id, 'approve')
                    setToast('Approved 1 item')
                  }
            }
            onRejectRow={
              smokeMode
                ? () => setToast('Disabled in smoke mode')
                : (id: string) => {
                    singleAction(id, 'reject')
                    setToast('Rejected 1 item')
                  }
            }
            detailsBase={
              smokeMode
                ? (_runId: string, rowId: string) => {
                    const usp = new URLSearchParams()
                    usp.set('id', rowId)
                    if (smokeToken) usp.set('token', smokeToken)
                    return `/resources/smoke/importer/get-diff?${usp.toString()}`
                  }
                : undefined
            }
          />
        ) : null}
        {!hydrated ? (
          <div style={{ padding: '8px 12px' }}>
            <Text as="span" tone="subdued">
              Loading review…
            </Text>
            <ProgressBar progress={15} size="small" />
          </div>
        ) : null}
        {/* Sticky summary bar */}
        <div
          data-review-summary
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'var(--p-color-bg)',
            borderTop: '1px solid var(--p-color-border-subdued)',
            padding: '6px 12px',
            zIndex: 10,
          }}
        >
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" tone="subdued" variant="bodySm">
              Selected: {summaryCounts.selected} • Created: {summaryCounts.created} • Updated: {summaryCounts.updated} •
              Skipped: {summaryCounts.skipped} • Failed: {summaryCounts.failed}
            </Text>
            {publishing ? (
              <Badge tone="attention">Publishing…</Badge>
            ) : publishTotals ? (
              <Badge tone="success">Publish done</Badge>
            ) : null}
          </InlineStack>
        </div>
      </BlockStack>
    </Page>
  )
}
// <!-- END RBP GENERATED: importer-review-inline-v1 -->
