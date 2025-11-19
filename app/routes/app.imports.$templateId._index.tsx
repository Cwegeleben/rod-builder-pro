// <!-- BEGIN RBP GENERATED: importer-v2-3 (settings-index) -->
// This file holds the Import Settings page content as the index child of the template route.
import React from 'react'
import type { LoaderFunctionArgs, ActionFunctionArgs, HeadersFunction } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
// <!-- BEGIN RBP GENERATED: importer-crawlB-polaris-v1 -->
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Select,
  TextField,
  Banner,
  Badge,
  SkeletonBodyText,
  Spinner,
  Loading,
  Toast,
  Frame,
  Modal,
  Tooltip,
  Link,
} from '@shopify/polaris'
// <!-- END RBP GENERATED: importer-crawlB-polaris-v1 -->
// <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
import { useSearchParams, useFetcher, useLocation, useLoaderData, useParams } from '@remix-run/react'
// <!-- END RBP GENERATED: importer-save-settings-v1 -->
// <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 -->
import { KNOWN_IMPORT_TARGETS, getTargetById } from '../server/importer/sites/targets'
import { requireHqShopOr404 } from '../lib/access.server'
import { useFetcher as useMFDefsFetcher } from '@remix-run/react'

export default function ImportSettingsIndex() {
  // <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
  const loaderData = useLoaderData<typeof loader>() as {
    name?: string
    settings?: { target?: string; discoverSeedUrls?: string[] }
    preparingRunId?: string | null
    state?: string
    pipeline?: 'simple' | 'full'
  }
  const { templateId } = useParams()
  // <!-- END RBP GENERATED: importer-save-settings-v1 -->
  const location = useLocation()
  const [params] = useSearchParams()
  const justCreated = params.get('created') === '1'
  // reviewError removed with review feature
  const runIdQuery = params.get('runId') || ''
  // <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 -->
  const fetcher = useFetcher<{ urls?: string[]; debug?: Record<string, unknown>; preview?: unknown }>()
  const discovering = fetcher.state !== 'idle'
  // <!-- BEGIN RBP GENERATED: importer-crawlB-polaris-v1 -->
  const seedsFetched = Array.isArray(fetcher.data?.urls) ? (fetcher.data!.urls as string[]) : []
  const [seedsText, setSeedsText] = React.useState<string>('')
  // Track if the user (or a discover action) has modified the seeds so we don't overwrite with loader-saved values
  const [hasUserEditedSeeds, setHasUserEditedSeeds] = React.useState<boolean>(false)
  const [showSavedToast, setShowSavedToast] = React.useState<boolean>(false)
  // Recrawl + Publish removed: toast/loading/goal/confirm state eliminated
  // <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
  const [saveLoading, setSaveLoading] = React.useState<boolean>(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [crawlLoading, setCrawlLoading] = React.useState<boolean>(false)
  const [activeRunId, setActiveRunId] = React.useState<string>(runIdQuery)
  const [progressPollMs] = React.useState<number>(3000)
  // Using extended progress shape; legacy state removed.
  type RunProgressExtended = {
    status?: string
    progress?: Record<string, unknown>
    summary?: Record<string, unknown>
    finished?: boolean
    seedIndex?: number
    seedsTotal?: number
    etaSeconds?: number
    stuck?: boolean
    lastUpdated?: string
    startedAt?: string
  }
  const [runProgressExtended, setRunProgressExtended] = React.useState<RunProgressExtended | null>(null)
  React.useEffect(() => {
    if (!activeRunId && loaderData?.preparingRunId) setActiveRunId(loaderData.preparingRunId)
  }, [activeRunId, loaderData?.preparingRunId])
  const [cancelLoading, setCancelLoading] = React.useState<boolean>(false)
  const [showCancelToast, setShowCancelToast] = React.useState<string | null>(null)
  const [healLoading, setHealLoading] = React.useState<boolean>(false)
  const [kickLoading, setKickLoading] = React.useState<boolean>(false)
  // Shared SSE-driven logs and connection state
  const [runLogs, setRunLogs] = React.useState<
    Array<{ id: string; at: string; type: string; payload?: string | null }>
  >([])
  const [streamConn, setStreamConn] = React.useState<'connecting' | 'open' | 'closed' | 'fallback'>('connecting')
  // Overwrite confirmation (replace window.confirm)
  // Overwrite modal removed
  const [runGuardDiscoverOpen, setRunGuardDiscoverOpen] = React.useState<boolean>(false)
  // runGuardSaveOpen removed with legacy guard modal
  // Overwrite workflow removed with legacy review/prepare flow
  // Clear staging modal state
  const [clearModalOpen, setClearModalOpen] = React.useState<boolean>(false)
  const [clearLoading, setClearLoading] = React.useState<boolean>(false)
  const [clearCount, setClearCount] = React.useState<number | null>(null)
  const [clearError, setClearError] = React.useState<string | null>(null)
  const [showClearedToast, setShowClearedToast] = React.useState<boolean>(false)
  // Delete import modal state
  const [deleteModalOpen, setDeleteModalOpen] = React.useState<boolean>(false)
  const [deleteLoading, setDeleteLoading] = React.useState<boolean>(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [deleteCounts, setDeleteCounts] = React.useState<{
    templates?: number
    logs?: number
    staging?: number
    sources?: number
    runs?: number
    diffs?: number
  } | null>(null)
  const [forceDelete, setForceDelete] = React.useState<boolean>(false)
  const [blockerCodes, setBlockerCodes] = React.useState<string[] | null>(null)
  // Mount diagnostics marker
  const debug = typeof location.search === 'string' && /[?&]debugRoute=1(&|$)/.test(location.search)
  React.useEffect(() => {
    if (debug || process.env.NODE_ENV !== 'production') {
      try {
        console.info('[ImportSettings] mounted')
      } catch {
        // noop
      }
    }
  }, [debug])
  // <!-- END RBP GENERATED: importer-save-settings-v1 -->
  const seeds = React.useMemo(() => parseSeeds(seedsText), [seedsText])
  function unionSeeds(a: string[], b: string[]): string[] {
    const seen = new Set<string>()
    const push = (arr: string[]) =>
      arr.forEach(s => {
        try {
          const u = new URL(s)
          const key = u.toString()
          if (!seen.has(key)) seen.add(key)
        } catch {
          const t = s.trim()
          if (t && !seen.has(t)) seen.add(t)
        }
      })
    push(a)
    push(b)
    return Array.from(seen)
  }
  const [importName, setImportName] = React.useState<string>('')
  // Discover behavior control: when true we will REPLACE existing seeds with newly discovered ones
  const [discoverModeReplace, setDiscoverModeReplace] = React.useState<boolean>(false)
  // Modal prompt to confirm replacing vs merging existing seeds on Discover
  const [discoverReplaceModalOpen, setDiscoverReplaceModalOpen] = React.useState<boolean>(false)
  React.useEffect(() => {
    if (!seedsFetched.length) return
    const current = parseSeeds(seedsText)
    const nextList = discoverModeReplace ? seedsFetched : unionSeeds(current, seedsFetched)
    setSeedsText(nextList.join('\n'))
    // Treat discover merge as an edit so loader won't clobber it afterwards
    setHasUserEditedSeeds(true)
    // Reset replace mode after applying discovery result
    setDiscoverModeReplace(false)
  }, [seedsFetched])
  // <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
  React.useEffect(() => {
    if (typeof loaderData?.name === 'string') setImportName(loaderData.name)
  }, [loaderData?.name])
  React.useEffect(() => {
    const tId = loaderData?.settings?.target
    if (tId) {
      const t = getTargetById(tId)
      if (t) {
        setTargetId(t.id)
        setSiteId(t.siteId)
        setSourceUrl(t.url)
      }
    }
  }, [loaderData?.settings?.target])
  React.useEffect(() => {
    const saved = loaderData?.settings?.discoverSeedUrls || []
    // Only apply loader-saved seeds if we have no current seeds OR current seeds exactly equal saved.
    // If the user has edited or we have a superset (e.g., after Discover union), preserve current.
    if (!saved.length) return
    setSeedsText(prev => {
      if (!prev.trim()) return saved.join('\n')
      const prevArr = parseSeeds(prev)
      const savedSet = new Set(saved)
      const prevAllInSaved = prevArr.every(s => savedSet.has(s))
      const sameLength = prevArr.length === saved.length
      // Normalize ordering if identical
      if (!hasUserEditedSeeds && prevAllInSaved && sameLength) return saved.join('\n')
      // If user edited or we have extra seeds beyond saved, keep existing.
      return prev
    })
  }, [loaderData?.settings?.discoverSeedUrls, hasUserEditedSeeds])
  // <!-- END RBP GENERATED: importer-save-settings-v1 -->
  function parseSeeds(input: string): string[] {
    return input
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
  }
  const [targetId, setTargetId] = React.useState<string>('batson-rod-blanks')
  const [sourceUrl, setSourceUrl] = React.useState<string>('https://batsonenterprises.com/rod-blanks')
  const [siteId, setSiteId] = React.useState<string>('batson-rod-blanks')
  const defsFetcher = useMFDefsFetcher<{
    report?: { total: number; missing: string[]; present: string[] }
    error?: string
    created?: string[]
  }>()
  const defsLoading = defsFetcher.state !== 'idle'
  const defsReport = defsFetcher.data?.report
  const defsMissing = defsReport?.missing || []
  const defsPresent = defsReport?.present || []
  const [defsCheckedAt, setDefsCheckedAt] = React.useState<string | null>(null)
  const canCreateDefs = targetId === 'batson-rod-blanks' && defsMissing.length > 0 && !defsLoading
  React.useEffect(() => {
    if (targetId === 'batson-rod-blanks') {
      defsFetcher.load(`/api/importer/metafields/report?target=batson-rod-blanks`)
    }
  }, [targetId])
  React.useEffect(() => {
    if (defsFetcher.data?.report) setDefsCheckedAt(new Date().toISOString())
  }, [defsFetcher.data?.report])
  function onCreateMetafieldDefs() {
    if (defsLoading) return
    defsFetcher.submit(
      { intent: 'create', target: 'batson-rod-blanks' },
      { method: 'post', action: '/api/importer/metafields/create' },
    )
  }

  function onTargetChange(id: string) {
    setTargetId(id)
    const t = getTargetById(id)
    if (t) {
      setSourceUrl(t.url)
      setSiteId(t.siteId)
    }
  }

  function isBenignPatternError(msg: unknown): boolean {
    try {
      const s = String(msg || '').toLowerCase()
      return s.includes('the string did not match the expected pattern')
    } catch {
      return false
    }
  }
  // Removed legacy onSaveAndCrawl combined handler
  function navigateToImports(qs: URLSearchParams) {
    const rel = `/app/imports?${qs.toString()}`
    try {
      const ref = document.referrer || ''
      const m = ref.match(/^https:\/\/admin\.shopify\.com\/store\/[^/]+/)
      if (m && m[0]) {
        const base = m[0]
        const abs = `${base}/apps/rbp-app${rel}`
        try {
          if (window.top) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(window.top as any).location.assign(abs)
            return
          }
        } catch {
          // noop
        }
        window.location.assign(abs)
        return
      }
    } catch {
      // noop
    }
    window.location.assign(rel)
  }

  return (
    <Page
      title="Import Settings"
      data-testid="settings-page"
      subtitle={debug ? 'Route: imports-settings' : 'Guided flow: 1) Setup → 2) Seeds → 3) Save / Crawl'}
      backAction={{ content: 'Back to Imports', url: `/app/imports${location.search}` }}
    >
      <BlockStack gap="400">
        {discovering ? (
          <Frame>
            <Loading />
          </Frame>
        ) : null}
        {/* Review functionality removed */}
        {showSavedToast ? (
          <Frame>
            <Toast content="Settings saved" onDismiss={() => setShowSavedToast(false)} duration={2000} />
          </Frame>
        ) : null}
        {/* Recrawl toast removed */}
        {showClearedToast ? (
          <Frame>
            <Toast content="Cleared staged rows" onDismiss={() => setShowClearedToast(false)} duration={3000} />
          </Frame>
        ) : null}
        {showCancelToast ? (
          <Frame>
            <Toast content={showCancelToast} onDismiss={() => setShowCancelToast(null)} duration={2500} />
          </Frame>
        ) : null}
        {saveError && !isBenignPatternError(saveError) ? (
          <Banner tone="critical" title="Save failed">
            <p>{saveError}</p>
          </Banner>
        ) : null}

        <Card>
          <BlockStack gap="200">
            <InlineStack gap="300" blockAlign="center">
              <Badge tone="success">1. Setup target</Badge>
              <Badge tone={seeds.length ? 'success' : 'attention'}>2. Seeds</Badge>
              <Badge tone="attention">3. Save / Crawl</Badge>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Details
            </Text>
            <div style={{ maxWidth: 560 }}>
              <TextField
                label="Import name"
                value={importName}
                onChange={val => setImportName(val)}
                autoComplete="off"
                placeholder="e.g., Batson Rod Blanks Crawl"
              />
            </div>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            {justCreated ? (
              <Banner tone="success" title="Import created">
                <p>You can configure settings below.</p>
              </Banner>
            ) : null}
            <Text as="h2" variant="headingMd">
              Target
            </Text>
            <InlineStack gap="300" align="start">
              <div style={{ minWidth: 320 }}>
                <Select
                  label="Target"
                  options={KNOWN_IMPORT_TARGETS.map((t: { id: string; label: string }) => ({
                    label: t.label,
                    value: t.id,
                  }))}
                  onChange={onTargetChange}
                  value={targetId}
                  placeholder="Select a source target"
                />
              </div>
              <div style={{ minWidth: 480 }}>
                <TextField label="Source URL" value={sourceUrl} disabled autoComplete="off" />
              </div>
              {siteId ? <Badge tone="info">{`siteId: ${siteId}`}</Badge> : null}
            </InlineStack>
            {targetId === 'batson-rod-blanks' ? (
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm">
                  Batson Rod Blank Metafield Definitions
                </Text>
                {!defsReport && defsLoading ? <SkeletonBodyText /> : null}
                {defsReport ? (
                  <InlineStack gap="300" wrap>
                    <Text as="span" variant="bodyMd">
                      Defined: {defsPresent.length}/{defsReport.total}
                    </Text>
                    {defsMissing.length ? (
                      <Badge tone="attention">{`Missing: ${defsMissing.length}`}</Badge>
                    ) : (
                      <Badge tone="success">All present</Badge>
                    )}
                    {defsCheckedAt ? (
                      <Text as="span" variant="bodySm" tone="subdued">
                        Checked {new Date(defsCheckedAt).toLocaleTimeString()}
                      </Text>
                    ) : null}
                  </InlineStack>
                ) : null}
                {defsMissing.length ? (
                  <Text as="p" variant="bodySm">
                    Missing keys: {defsMissing.join(', ')}
                  </Text>
                ) : null}
                {defsFetcher.data?.created?.length ? (
                  <Banner tone="success" title="Metafields created">
                    <p>{defsFetcher.data.created.join(', ')}</p>
                  </Banner>
                ) : null}
                {defsFetcher.data?.error ? (
                  <Banner tone="critical" title="Metafield creation failed">
                    <p>{defsFetcher.data.error}</p>
                  </Banner>
                ) : null}
                <InlineStack gap="200">
                  <Button
                    disabled={defsLoading}
                    loading={defsLoading && !defsReport}
                    onClick={() => defsFetcher.load(`/api/importer/metafields/report?target=batson-rod-blanks`)}
                  >
                    Re-test
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!canCreateDefs}
                    loading={defsLoading && !!defsReport}
                    onClick={onCreateMetafieldDefs}
                  >
                    Create Missing
                  </Button>
                </InlineStack>
              </BlockStack>
            ) : null}
            <InlineStack gap="200" align="start">
              <Button
                variant="primary"
                disabled={discovering || !siteId || !sourceUrl}
                onClick={() => {
                  // If seeds already exist, prompt user to Replace or Merge
                  if (seedsText.trim()) {
                    setDiscoverReplaceModalOpen(true)
                    return
                  }
                  if (loaderData.preparingRunId) {
                    setRunGuardDiscoverOpen(true)
                    return
                  }
                  const data = new FormData()
                  data.set('siteId', siteId)
                  data.set('sourceUrl', sourceUrl)
                  data.set('alsoPreview', '1')
                  fetcher.submit(data, { method: 'post', action: '/api/importer/crawl/discover' })
                }}
              >
                Discover
              </Button>
              {discovering ? <Spinner accessibilityLabel="Discovering series" size="small" /> : null}
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">
                Seeds
              </Text>
              <Text variant="bodySm" as="span">
                {seeds.length} total
              </Text>
            </InlineStack>
            <BlockStack gap="200">
              {discovering && seeds.length === 0 ? <SkeletonBodyText lines={4} /> : null}
              <TextField
                label="Series URLs"
                value={seedsText}
                onChange={val => {
                  setSeedsText(val)
                  setHasUserEditedSeeds(true)
                }}
                autoComplete="off"
                multiline={16}
                placeholder={seedsFetched.length ? '' : 'Paste one URL per line'}
                helpText="Edit the discovered list or paste your own. These will be saved when you click Save."
              />
              {seedsText ? (
                <details>
                  <summary>View all seeds (scroll)</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '40vh', overflow: 'auto' }}>{seedsText}</pre>
                </details>
              ) : null}
              {!seedsFetched.length && !seeds.length ? (
                <Banner tone="warning" title="No seeds yet">
                  <p>Click Discover to fetch seeds, or paste URLs above and then click Save.</p>
                </Banner>
              ) : null}
            </BlockStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Save Settings
            </Text>
            <Text as="p" tone="subdued">
              Persist name, target, and seeds without starting a crawl.
            </Text>
            <InlineStack gap="200" align="start">
              <Button
                variant="primary"
                onClick={async () => {
                  if (!templateId) return
                  if (!targetId) {
                    setSaveError('Select a target before saving.')
                    return
                  }
                  const validSeeds = seeds.filter(s => {
                    try {
                      const u = new URL(s)
                      return ['http:', 'https:'].includes(u.protocol)
                    } catch {
                      return false
                    }
                  })
                  setSaveLoading(true)
                  setSaveError(null)
                  try {
                    const resp = await fetch(`/api/importer/targets/${templateId}/settings`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: importName, target: targetId, discoverSeedUrls: validSeeds }),
                    })
                    const jr = await resp.json()
                    if (!resp.ok || !jr?.ok) throw new Error(jr?.error || 'Failed to save settings')
                    setShowSavedToast(true)
                  } catch (e) {
                    setSaveError((e as Error)?.message || 'Failed to save settings')
                  } finally {
                    setSaveLoading(false)
                  }
                }}
                loading={saveLoading}
                disabled={saveLoading}
              >
                Save
              </Button>
              <Button
                variant="secondary"
                tone="success"
                onClick={async () => {
                  if (!templateId) return
                  if (loaderData.preparingRunId && !activeRunId) {
                    setSaveError(
                      'A crawl run is already in progress. Please wait or cancel it before starting another.',
                    )
                    return
                  }
                  setCrawlLoading(true)
                  setSaveError(null)
                  try {
                    let runIdStr: string | null = null
                    if (loaderData?.pipeline === 'simple') {
                      // Token-gated simple runner that does not require Shopify admin session
                      const resp = await fetch(`/resources/importer/simpleRun/${templateId}?token=smoke-ok`, {
                        method: 'GET',
                        headers: { Accept: 'application/json' },
                      })
                      const jr = await resp.json()
                      if (!resp.ok || !jr?.ok) throw new Error(jr?.error || 'Failed to start crawl')
                      runIdStr = String(jr.runId)
                    } else {
                      const resp = await fetch('/api/importer/run', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ templateId }),
                      })
                      const jr = await resp.json()
                      if (!resp.ok || !jr?.ok) throw new Error(jr?.error || 'Failed to start crawl')
                      runIdStr = String(jr.runId)
                    }
                    const qs = new URLSearchParams(location.search)
                    qs.set('started', '1')
                    qs.set('tpl', templateId)
                    if (runIdStr) qs.set('runId', runIdStr)
                    navigateToImports(qs)
                    if (runIdStr) setActiveRunId(runIdStr)
                  } catch (e) {
                    setSaveError((e as Error)?.message || 'Failed to start crawl')
                  } finally {
                    setCrawlLoading(false)
                  }
                }}
                loading={crawlLoading}
                disabled={Boolean(
                  crawlLoading || saveLoading || !templateId || (loaderData.preparingRunId && !activeRunId),
                )}
              >
                {loaderData?.pipeline === 'simple' ? 'Crawl & Update (Simple)' : 'Crawl & Update'}
              </Button>
              {loaderData?.pipeline ? (
                <Badge tone={loaderData.pipeline === 'simple' ? 'success' : 'info'}>
                  {`Pipeline: ${loaderData.pipeline === 'simple' ? 'Simple' : 'Full'}`}
                </Badge>
              ) : null}
              {/* Recrawl + Publish button removed */}
              {loaderData.preparingRunId && !activeRunId ? (
                <Badge tone="attention">{`Run active ${loaderData.preparingRunId.slice(0, 8)} — crawl disabled`}</Badge>
              ) : null}
              {/* Recrawl goal badge removed */}
              {/* Review button removed */}
              <Button
                tone="critical"
                variant="secondary"
                disabled={!templateId}
                onClick={async () => {
                  if (!templateId) return
                  setDeleteError(null)
                  setDeleteLoading(true)
                  try {
                    const previewUrl = forceDelete ? '/api/importer/delete?dry=1&force=1' : '/api/importer/delete?dry=1'
                    const resp = await fetch(previewUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                      body: JSON.stringify({ templateIds: [templateId] }),
                    })
                    const jr = (await resp.json()) as {
                      ok?: boolean
                      counts?: {
                        templates?: number
                        logs?: number
                        staging?: number
                        sources?: number
                        runs?: number
                        diffs?: number
                      }
                      error?: string
                      code?: string
                      hint?: string
                      blockers?: Array<{ code: string; templateIds: string[] }>
                      forced?: boolean
                      blockersForced?: string[]
                    }
                    if (!resp.ok || jr?.ok === false) {
                      const msg = (jr?.error || 'Failed to preview delete') + (jr?.hint ? ` — ${jr.hint}` : '')
                      throw new Error(msg)
                    }
                    setDeleteCounts(jr.counts || null)
                    setBlockerCodes(jr.blockersForced || jr.blockers?.map(b => b.code) || null)
                    setDeleteModalOpen(true)
                  } catch (e) {
                    setDeleteError((e as Error)?.message || 'Failed to preview delete')
                    // Open the modal to surface the error banner to the user
                    setDeleteModalOpen(true)
                  } finally {
                    setDeleteLoading(false)
                  }
                }}
                loading={deleteLoading}
              >
                Delete import…
              </Button>
              {/* Clear staging button removed */}
              <Text as="span" tone="subdued">
                {seeds.length === 0
                  ? 'Add or discover seeds, then Save.'
                  : `${seeds.length} local seed(s) (saved when you click Save).`}
              </Text>
            </InlineStack>
            {activeRunId ? (
              <div style={{ marginTop: 16 }}>
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center" wrap>
                    <Badge tone="info">{`Run: ${activeRunId.slice(0, 8)}`}</Badge>
                    {runProgressExtended?.status ? (
                      <Badge
                        tone={
                          runProgressExtended?.finished
                            ? 'success'
                            : runProgressExtended?.stuck
                              ? 'critical'
                              : 'attention'
                        }
                      >
                        {runProgressExtended.stuck ? 'Stuck' : runProgressExtended.status}
                      </Badge>
                    ) : null}
                    {typeof runProgressExtended?.progress?.['percent'] === 'number' ? (
                      <Text as="span" variant="bodySm">{`Progress: ${runProgressExtended.progress!['percent']}%`}</Text>
                    ) : null}
                    {(() => {
                      const seedIndex = runProgressExtended?.seedIndex
                      const seedsTotal = runProgressExtended?.seedsTotal
                      if (typeof seedIndex === 'number' && typeof seedsTotal === 'number') {
                        return <Text as="span" variant="bodySm">{`Seed ${seedIndex} / ${seedsTotal}`}</Text>
                      }
                      return null
                    })()}
                    {(() => {
                      const etaSeconds = runProgressExtended?.etaSeconds
                      if (typeof etaSeconds === 'number') {
                        return (
                          <Text as="span" variant="bodySm" tone="subdued">{`ETA ~${Math.max(0, etaSeconds)}s`}</Text>
                        )
                      }
                      return null
                    })()}
                    {(() => {
                      // Smoothed seeds/min using last N poll samples (client-side ring buffer)
                      const N = 6
                      // Attach ring buffer to window to persist across re-renders without state churn
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const w: any = typeof window !== 'undefined' ? window : {}
                      if (!w.__rbpSeedSamples) w.__rbpSeedSamples = []
                      const startedAt = runProgressExtended?.startedAt
                      const seedIndex = runProgressExtended?.seedIndex
                      if (startedAt && typeof seedIndex === 'number') {
                        try {
                          const now = Date.now()
                          // Push new sample
                          w.__rbpSeedSamples.push({ t: now, i: seedIndex })
                          // Trim
                          if (w.__rbpSeedSamples.length > N) w.__rbpSeedSamples.splice(0, w.__rbpSeedSamples.length - N)
                          if (w.__rbpSeedSamples.length >= 2) {
                            const first = w.__rbpSeedSamples[0]
                            const last = w.__rbpSeedSamples[w.__rbpSeedSamples.length - 1]
                            const deltaSeeds = last.i - first.i
                            const deltaMinutes = (last.t - first.t) / 60000
                            if (deltaSeeds > 0 && deltaMinutes > 0) {
                              const rate = (deltaSeeds / deltaMinutes).toFixed(2)
                              return (
                                <Text as="span" variant="bodySm" tone="subdued">{`${rate} seeds/min (smoothed)`}</Text>
                              )
                            }
                          }
                          // Fallback to whole-run average if insufficient samples
                          const elapsedMs = now - new Date(startedAt).getTime()
                          if (elapsedMs > 5000) {
                            const seedsPerMin = (seedIndex / (elapsedMs / 60000)).toFixed(2)
                            return <Text as="span" variant="bodySm" tone="subdued">{`${seedsPerMin} seeds/min`}</Text>
                          }
                        } catch {
                          /* ignore */
                        }
                      }
                      return null
                    })()}
                    {(() => {
                      const lastUpdated = runProgressExtended?.lastUpdated
                      if (lastUpdated) {
                        try {
                          const ageSec = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000)
                          const stale = ageSec > 30 && !runProgressExtended?.finished && !runProgressExtended?.stuck
                          return (
                            <Text as="span" variant="bodySm" tone={stale ? 'critical' : 'subdued'}>
                              {stale ? `Heartbeat ${ageSec}s ago` : `Updated ${ageSec}s ago`}
                            </Text>
                          )
                        } catch {
                          /* ignore */
                        }
                      }
                      return null
                    })()}
                    {(() => {
                      const det = runProgressExtended?.progress?.['details']
                      const rawMs =
                        det && typeof (det as Record<string, unknown>)['lastSeedDurationMs'] === 'number'
                          ? ((det as Record<string, unknown>)['lastSeedDurationMs'] as number)
                          : undefined
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const w: any = typeof window !== 'undefined' ? window : {}
                      if (!w.__rbpSeedDurSamples) w.__rbpSeedDurSamples = []
                      if (typeof rawMs === 'number' && rawMs > 0 && rawMs < 600000) {
                        w.__rbpSeedDurSamples.push(rawMs)
                        if (w.__rbpSeedDurSamples.length > 10)
                          w.__rbpSeedDurSamples.splice(0, w.__rbpSeedDurSamples.length - 10)
                        const avgMs =
                          w.__rbpSeedDurSamples.reduce((a: number, b: number) => a + b, 0) /
                          w.__rbpSeedDurSamples.length
                        const lastSec = (rawMs / 1000).toFixed(1)
                        const avgSec = (avgMs / 1000).toFixed(1)
                        // Sparkline generation (mini polyline of last samples scaled to 0-1 range within viewBox heights)
                        const samples: number[] = w.__rbpSeedDurSamples.slice()
                        const max = Math.max(...samples)
                        const min = Math.min(...samples)
                        const range = Math.max(1, max - min)
                        const points = samples
                          .map((v, idx) => {
                            const x = (idx / Math.max(1, samples.length - 1)) * 60 // width 60
                            const norm = (v - min) / range
                            const y = 16 - norm * 14 // top padding 2, bottom 2
                            return `${x.toFixed(1)},${y.toFixed(1)}`
                          })
                          .join(' ')
                        return (
                          <InlineStack gap="100" blockAlign="center">
                            <Text as="span" variant="bodySm" tone="subdued">{`Last seed: ${lastSec}s`}</Text>
                            <Text
                              as="span"
                              variant="bodySm"
                              tone="subdued"
                            >{`Avg (${w.__rbpSeedDurSamples.length}): ${avgSec}s`}</Text>
                            {samples.length >= 2 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <svg
                                  width={64}
                                  height={18}
                                  viewBox="0 0 64 18"
                                  role="img"
                                  aria-label="Seed duration sparkline"
                                  style={{ overflow: 'visible' }}
                                >
                                  <polyline
                                    points={points}
                                    fill="none"
                                    stroke="var(--p-color-border-critical)"
                                    strokeWidth={1.4}
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                  />
                                  {samples.length ? (
                                    <circle
                                      cx={(() => {
                                        const lastIdx = samples.length - 1
                                        return (lastIdx / Math.max(1, samples.length - 1)) * 60
                                      })()}
                                      cy={(() => {
                                        const lastV = samples[samples.length - 1]
                                        const norm = (lastV - min) / range
                                        return 16 - norm * 14
                                      })()}
                                      r={2.2}
                                      fill="var(--p-color-bg-critical-subdued)"
                                      stroke="var(--p-color-border-critical)"
                                      strokeWidth={1}
                                    />
                                  ) : null}
                                </svg>
                              </span>
                            ) : null}
                          </InlineStack>
                        )
                      }
                      return null
                    })()}
                    <Button
                      tone="critical"
                      variant="secondary"
                      disabled={cancelLoading || runProgressExtended?.finished}
                      loading={cancelLoading}
                      onClick={async () => {
                        if (!activeRunId) return
                        setCancelLoading(true)
                        try {
                          const resp = await fetch(`/api/importer/runs/${activeRunId}/cancel`, { method: 'POST' })
                          const jr = await resp.json()
                          if (!resp.ok || !jr?.ok) throw new Error(jr?.error || 'Cancel failed')
                          const msg = `Cancel requested${jr.alreadyTerminal ? ' (already terminal)' : ''}${
                            jr.clearedSlot ? '; slot cleared' : ''
                          }`
                          setShowCancelToast(msg)
                        } catch (e) {
                          setSaveError((e as Error)?.message || 'Cancel failed')
                        } finally {
                          setCancelLoading(false)
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={healLoading}
                      loading={healLoading}
                      onClick={async () => {
                        setHealLoading(true)
                        try {
                          const resp = await fetch('/api/importer/maintenance/cleanup', { method: 'POST' })
                          const jr = await resp.json()
                          if (!resp.ok || !jr?.ok) throw new Error(jr?.error || 'Heal failed')
                          const inspected = typeof jr?.inspected === 'number' ? jr.inspected : 0
                          const cleared = typeof jr?.cleared === 'number' ? jr.cleared : 0
                          setShowCancelToast(`Healed slots: cleared ${cleared} / inspected ${inspected}`)
                        } catch (e) {
                          setSaveError((e as Error)?.message || 'Heal failed')
                        } finally {
                          setHealLoading(false)
                        }
                      }}
                    >
                      Heal Slot
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={kickLoading || !templateId}
                      loading={kickLoading}
                      onClick={async () => {
                        if (!templateId) return
                        setKickLoading(true)
                        try {
                          const resp = await fetch('/api/importer/maintenance/kick', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ templateId }),
                          })
                          const jr = await resp.json()
                          if (!resp.ok || !jr?.ok) throw new Error(jr?.error || 'Kick failed')
                          setShowCancelToast('Kick sent to promote next queued run')
                        } catch (e) {
                          setSaveError((e as Error)?.message || 'Kick failed')
                        } finally {
                          setKickLoading(false)
                        }
                      }}
                    >
                      Kick Queue
                    </Button>
                  </InlineStack>
                  {/* Phase label rendered below with segmented bar */}
                  {typeof runProgressExtended?.progress?.['percent'] === 'number'
                    ? (() => {
                        const pct = Math.max(0, Math.min(100, Number(runProgressExtended.progress!['percent'])))
                        const phase = String(runProgressExtended.progress?.['phase'] || '')
                        const last = runProgressExtended?.lastUpdated
                        const isStale = last
                          ? !runProgressExtended?.finished && Date.now() - new Date(last).getTime() > 30_000
                          : false
                        const isStuck = !!runProgressExtended?.stuck
                        const segments = [
                          { key: 'discover', start: 0, end: 10, label: 'Discover', tone: 'info' },
                          { key: 'direct-detail', start: 10, end: 30, label: 'Detail', tone: 'attention' },
                          { key: 'series-parse', start: 30, end: 55, label: 'Series', tone: 'warning' },
                          { key: 'crawl', start: 55, end: 60, label: 'Expand', tone: 'info' },
                          { key: 'stage', start: 60, end: 70, label: 'Stage', tone: 'success' },
                          { key: 'canonical-write', start: 70, end: 78, label: 'Write', tone: 'attention' },
                          { key: 'diff', start: 78, end: 96, label: 'Diff', tone: 'critical' },
                          { key: 'ready', start: 96, end: 100, label: 'Finalize', tone: 'success' },
                        ] as const
                        const activeIdx = segments.findIndex(s => s.key === phase)
                        return (
                          <div style={{ maxWidth: 520 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  width: '100%',
                                  height: 14,
                                  borderRadius: 6,
                                  overflow: 'hidden',
                                  border: '1px solid var(--p-color-border-subdued)',
                                  position: 'relative',
                                }}
                              >
                                {segments.map((s, i) => {
                                  const widthPct = s.end - s.start
                                  const filled =
                                    pct >= s.end ? 1 : pct <= s.start ? 0 : (pct - s.start) / (s.end - s.start)
                                  const bgBase = 'var(--p-color-bg-subdued)'
                                  const toneColor = (() => {
                                    switch (s.tone) {
                                      case 'success':
                                        return 'var(--p-color-bg-success-subdued)'
                                      case 'critical':
                                        return 'var(--p-color-bg-critical-subdued)'
                                      case 'warning':
                                        return 'var(--p-color-bg-warning-subdued)'
                                      case 'attention':
                                        return 'var(--p-color-bg-caution-subdued)'
                                      case 'info':
                                        return 'var(--p-color-bg-info-subdued)'
                                      default:
                                        return bgBase
                                    }
                                  })()
                                  const active = i === activeIdx
                                  return (
                                    <div
                                      key={s.key}
                                      style={{ position: 'relative', flex: `${widthPct} 0 auto`, background: bgBase }}
                                    >
                                      <div
                                        style={{
                                          position: 'absolute',
                                          inset: 0,
                                          background: toneColor,
                                          opacity: Math.max(0.15, filled * 0.85),
                                          transition: 'opacity 0.3s linear',
                                        }}
                                      />
                                      {active ? (
                                        <div
                                          style={{
                                            position: 'absolute',
                                            inset: 0,
                                            boxShadow: '0 0 0 1px var(--p-color-border)',
                                            borderRadius: 0,
                                          }}
                                        />
                                      ) : null}
                                    </div>
                                  )
                                })}
                                {isStuck || isStale ? (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      inset: 0,
                                      pointerEvents: 'none',
                                      background:
                                        'repeating-linear-gradient(45deg, rgba(220,53,69,0.18), rgba(220,53,69,0.18) 6px, rgba(220,53,69,0.1) 6px, rgba(220,53,69,0.1) 12px)',
                                    }}
                                  />
                                ) : null}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' }}>
                                {segments.map(s => {
                                  const current = s.key === phase
                                  const windowTip =
                                    `${s.label} ${s.start}–${s.end}%` +
                                    (current ? ` (in progress ${pct.toFixed(1)}%)` : '')
                                  return (
                                    <Tooltip key={s.key} content={windowTip} dismissOnMouseOut>
                                      <span
                                        style={{
                                          fontSize: 11,
                                          opacity: current ? 0.95 : 0.55,
                                          fontWeight: current ? 600 : 400,
                                        }}
                                      >
                                        {s.label}
                                      </span>
                                    </Tooltip>
                                  )
                                })}
                                <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>{pct}%</span>
                              </div>
                              <InlineStack gap="200" blockAlign="center">
                                {phase ? (
                                  <Text as="p" tone="subdued">
                                    Phase: {phase}
                                  </Text>
                                ) : null}
                                {isStuck || isStale
                                  ? (() => {
                                      const last = runProgressExtended?.lastUpdated
                                      let ageSec: number | null = null
                                      if (last) {
                                        try {
                                          ageSec = Math.floor((Date.now() - new Date(last).getTime()) / 1000)
                                        } catch {
                                          ageSec = null
                                        }
                                      }
                                      const stuckMsg = isStuck ? 'Watchdog marked run as stuck.' : 'Heartbeat stale.'
                                      const phaseMsg = phase ? `Phase: ${phase}` : ''
                                      const ageMsg = ageSec != null ? `Last update ${ageSec}s ago.` : 'No timestamp.'
                                      const tip = [stuckMsg, ageMsg, phaseMsg].filter(Boolean).join(' ')
                                      return (
                                        <div style={{ display: 'inline-flex', gap: 8 }}>
                                          <Tooltip content={tip} dismissOnMouseOut>
                                            <Badge tone="critical">{isStuck ? 'Stuck detected' : 'No heartbeat'}</Badge>
                                          </Tooltip>
                                          {activeRunId ? (
                                            <Link
                                              url={`/api/importer/runs/${activeRunId}/debug.raw`}
                                              target="_blank"
                                              removeUnderline
                                            >
                                              Diagnostics
                                            </Link>
                                          ) : null}
                                        </div>
                                      )
                                    })()
                                  : null}
                              </InlineStack>
                            </div>
                          </div>
                        )
                      })()
                    : null}
                  {runProgressExtended?.progress?.['details'] ? (
                    <details>
                      <summary style={{ cursor: 'pointer' }}>Details</summary>
                      <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                        {JSON.stringify(runProgressExtended.progress!['details'], null, 2)}
                      </pre>
                    </details>
                  ) : null}
                  {(() => {
                    const runId = activeRunId
                    if (!runId) return null
                    return (
                      <div style={{ maxWidth: 520 }}>
                        <InlineStack gap="100" blockAlign="center">
                          <Text as="p" tone="subdued" variant="bodySm">
                            Recent log tail
                          </Text>
                          <Badge
                            tone={
                              streamConn === 'open'
                                ? 'success'
                                : streamConn === 'connecting'
                                  ? 'attention'
                                  : streamConn === 'fallback'
                                    ? 'warning'
                                    : 'critical'
                            }
                          >
                            {streamConn === 'open'
                              ? 'live'
                              : streamConn === 'connecting'
                                ? 'connecting…'
                                : streamConn === 'fallback'
                                  ? 'fallback'
                                  : 'closed'}
                          </Badge>
                        </InlineStack>
                        <div
                          style={{
                            fontFamily: 'monospace',
                            fontSize: 12,
                            maxHeight: 160,
                            overflow: 'auto',
                            border: '1px solid var(--p-color-border-subdued)',
                            padding: 8,
                            borderRadius: 4,
                          }}
                        >
                          {runLogs.length === 0 ? (
                            <div style={{ opacity: 0.6 }}>
                              {streamConn === 'open' ? 'No logs yet…' : 'Waiting for stream…'}
                            </div>
                          ) : (
                            runLogs.map(l => {
                              const t = new Date(l.at).toLocaleTimeString(undefined, { hour12: false })
                              return (
                                <div key={l.id} style={{ display: 'flex', gap: 8 }}>
                                  <span style={{ opacity: 0.6 }}>{t}</span>
                                  <span>{l.type}</span>
                                  {l.payload ? (
                                    <span
                                      style={{
                                        opacity: 0.6,
                                        whiteSpace: 'nowrap',
                                        textOverflow: 'ellipsis',
                                        overflow: 'hidden',
                                        maxWidth: 240,
                                      }}
                                    >
                                      {l.payload}
                                    </span>
                                  ) : null}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  })()}
                  {(() => {
                    const d = runProgressExtended?.progress?.['details'] as Record<string, unknown> | undefined
                    const agg = (d?.['aggregate'] as Record<string, number> | undefined) || undefined
                    const counts = (d?.['counts'] as Record<string, number> | undefined) || undefined
                    const badges: Array<React.ReactNode> = []
                    if (agg) {
                      if (typeof agg.staged === 'number')
                        badges.push(<Badge key="agg-staged" tone="success">{`Staged: ${agg.staged}`}</Badge>)
                      if (typeof agg.errors === 'number' && agg.errors > 0)
                        badges.push(<Badge key="agg-errors" tone="critical">{`Errors: ${agg.errors}`}</Badge>)
                    }
                    if (counts) {
                      if (typeof counts.add === 'number')
                        badges.push(<Badge key="cnt-add" tone="success">{`Adds: ${counts.add}`}</Badge>)
                      if (typeof counts.change === 'number')
                        badges.push(<Badge key="cnt-change" tone="attention">{`Changes: ${counts.change}`}</Badge>)
                      if (typeof counts.delete === 'number')
                        badges.push(<Badge key="cnt-delete" tone="warning">{`Deletes: ${counts.delete}`}</Badge>)
                      if (typeof counts.conflict === 'number' && counts.conflict > 0)
                        badges.push(<Badge key="cnt-conflict" tone="critical">{`Conflicts: ${counts.conflict}`}</Badge>)
                    }
                    if (badges.length)
                      return (
                        <InlineStack gap="300" align="start">
                          {badges}
                        </InlineStack>
                      )
                    return null
                  })()}
                </BlockStack>
              </div>
            ) : null}
          </BlockStack>
        </Card>

        {/* Overwrite modal removed */}

        {runGuardDiscoverOpen ? (
          <Frame>
            <Modal
              open
              title="Discover new URLs during active prepare?"
              onClose={() => setRunGuardDiscoverOpen(false)}
              primaryAction={{
                content: 'Continue & Discover',
                onAction: () => {
                  setRunGuardDiscoverOpen(false)
                  // If we arrived here via replace prompt, ensure it is closed
                  if (discoverReplaceModalOpen) setDiscoverReplaceModalOpen(false)
                  const data = new FormData()
                  data.set('siteId', siteId)
                  data.set('sourceUrl', sourceUrl)
                  data.set('alsoPreview', '1')
                  fetcher.submit(data, { method: 'post', action: '/api/importer/crawl/discover' })
                },
              }}
              secondaryActions={[{ content: 'Cancel', onAction: () => setRunGuardDiscoverOpen(false) }]}
            >
              <Modal.Section>
                <Text as="p">
                  A prepare run (<code>{loaderData.preparingRunId}</code>) is currently in progress. Starting a new
                  discovery may queue additional work and extend total processing time. Continue?
                </Text>
                {seedsText.trim() ? (
                  <Text as="p" tone="subdued">
                    Existing seeds will be {discoverModeReplace ? 'replaced' : 'merged'} after discovery.
                  </Text>
                ) : null}
              </Modal.Section>
            </Modal>
          </Frame>
        ) : null}

        {/* Save & Crawl guard modal removed */}

        {discoverReplaceModalOpen ? (
          <Frame>
            <Modal
              open
              title="Replace existing seeds with new discovery?"
              onClose={() => setDiscoverReplaceModalOpen(false)}
              primaryAction={{
                content: 'Replace & Discover',
                destructive: true,
                onAction: () => {
                  setDiscoverModeReplace(true)
                  setDiscoverReplaceModalOpen(false)
                  if (loaderData.preparingRunId) {
                    setRunGuardDiscoverOpen(true)
                    return
                  }
                  const data = new FormData()
                  data.set('siteId', siteId)
                  data.set('sourceUrl', sourceUrl)
                  data.set('alsoPreview', '1')
                  fetcher.submit(data, { method: 'post', action: '/api/importer/crawl/discover' })
                },
              }}
              secondaryActions={[
                {
                  content: 'Merge Instead',
                  onAction: () => {
                    setDiscoverModeReplace(false)
                    setDiscoverReplaceModalOpen(false)
                    if (loaderData.preparingRunId) {
                      setRunGuardDiscoverOpen(true)
                      return
                    }
                    const data = new FormData()
                    data.set('siteId', siteId)
                    data.set('sourceUrl', sourceUrl)
                    data.set('alsoPreview', '1')
                    fetcher.submit(data, { method: 'post', action: '/api/importer/crawl/discover' })
                  },
                },
                { content: 'Cancel', onAction: () => setDiscoverReplaceModalOpen(false) },
              ]}
            >
              <Modal.Section>
                <Text as="p">
                  You already have {seeds.length} seed URL{seeds.length === 1 ? '' : 's'}. Choose whether to replace
                  them entirely with the newly discovered list or merge the new URLs in.
                </Text>
                <Text as="p" tone="subdued">
                  Replace discards all existing lines. Merge keeps existing lines and adds new unique URLs.
                </Text>
              </Modal.Section>
            </Modal>
          </Frame>
        ) : null}

        {process.env.PRODUCT_DB_ENABLED === '1' ? null : clearModalOpen ? (
          <Frame>
            <Modal
              open
              title="Clear staged rows?"
              onClose={() => {
                setClearModalOpen(false)
                setClearError(null)
                setClearCount(null)
              }}
              primaryAction={{
                content: clearCount ? `Delete ${clearCount} row(s)` : 'Delete',
                destructive: true,
                onAction: async () => {
                  if (!templateId) return
                  setClearLoading(true)
                  try {
                    const r = await fetch('/api/importer/staging/clear', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ templateId, alsoSeeds: true }),
                    })
                    const d = (await r.json()) as {
                      ok?: boolean
                      deleted?: number
                      seedsDeleted?: number
                      error?: string
                    }
                    if (!r.ok || !d?.ok) throw new Error(d?.error || 'Failed to clear staged rows')
                    try {
                      const res = await fetch(`/api/importer/targets/${templateId}/settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: importName, target: targetId, discoverSeedUrls: [] }),
                      })
                      if (res.ok) setSeedsText('')
                    } catch {
                      // noop
                    }
                    setShowClearedToast(true)
                  } catch (err) {
                    setClearError((err as Error)?.message || 'Failed to clear staged rows')
                  } finally {
                    setClearLoading(false)
                    setClearModalOpen(false)
                    setClearCount(null)
                  }
                },
                loading: clearLoading,
              }}
              secondaryActions={[{ content: 'Cancel', onAction: () => setClearModalOpen(false) }]}
            >
              <Modal.Section>
                {clearError ? (
                  <Banner tone="critical" title="Clear failed">
                    <p>{clearError}</p>
                  </Banner>
                ) : null}
                <Text as="p">
                  This will remove all staged rows for this template's supplier
                  {siteId ? (
                    <>
                      {' '}
                      (<code>{siteId}</code>)
                    </>
                  ) : null}
                  . It will also clear the saved seed URLs for this template.
                </Text>
                {typeof clearCount === 'number' ? (
                  <Text as="p" tone="subdued">
                    {clearCount} row(s) currently staged.
                  </Text>
                ) : null}
              </Modal.Section>
            </Modal>
          </Frame>
        ) : null}

        {/* Recrawl confirm modal removed */}

        {deleteModalOpen ? (
          <Frame>
            <Modal
              open
              title="Delete this import and related data?"
              onClose={() => {
                setDeleteModalOpen(false)
                setDeleteCounts(null)
                setDeleteError(null)
              }}
              primaryAction={{
                content: forceDelete ? 'Force delete import' : 'Delete import',
                destructive: true,
                loading: deleteLoading,
                onAction: async () => {
                  if (!templateId) return
                  setDeleteLoading(true)
                  try {
                    const commitUrl = forceDelete ? '/api/importer/delete?force=1' : '/api/importer/delete'
                    const resp = await fetch(commitUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                      body: JSON.stringify({ templateIds: [templateId] }),
                    })
                    const jr = (await resp.json()) as { ok?: boolean; error?: string; code?: string; hint?: string }
                    if (!resp.ok || jr?.ok === false) {
                      const msg = (jr?.error || 'Delete failed') + (jr?.hint ? ` — ${jr.hint}` : '')
                      throw new Error(msg)
                    }
                    // Close modal immediately on success to avoid lingering UI when navigation is delayed/blocked
                    setDeleteModalOpen(false)
                    setDeleteCounts(null)
                    // Navigate to imports list with toast param
                    try {
                      const qs = new URLSearchParams(location.search)
                      qs.set('deleted', '1')
                      if (forceDelete) qs.set('forced', '1')
                      window.location.assign(`/app/imports?${qs.toString()}`)
                    } catch {
                      window.location.assign('/app/imports?deleted=1')
                    }
                  } catch (e) {
                    setDeleteError((e as Error)?.message || 'Delete failed')
                  } finally {
                    setDeleteLoading(false)
                    // Keep the modal open on error to display the banner. It will close on success via navigation.
                  }
                },
              }}
              secondaryActions={[{ content: 'Cancel', onAction: () => setDeleteModalOpen(false) }]}
            >
              <Modal.Section>
                {deleteError ? (
                  <Banner tone="critical" title="Delete failed">
                    <p>{deleteError}</p>
                  </Banner>
                ) : null}
                <Text as="p">
                  This will permanently remove the template, logs, staged items, sources, and runs associated with this
                  import. This cannot be undone.
                </Text>
                {blockerCodes && blockerCodes.length && !forceDelete ? (
                  <Banner tone="warning" title="Blockers detected">
                    <p>
                      {`Blockers: ${blockerCodes.join(', ')}. You may force delete to override if you're sure it's safe.`}
                    </p>
                  </Banner>
                ) : null}
                {deleteCounts ? (
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={forceDelete}
                        onChange={e => setForceDelete(e.currentTarget.checked)}
                        disabled={deleteLoading}
                      />
                      <span>Force delete (override active blockers)</span>
                    </label>
                  </div>
                ) : null}
                {deleteCounts ? (
                  <BlockStack gap="050">
                    <Text as="p" tone="subdued">{`Templates: ${deleteCounts.templates ?? 1}`}</Text>
                    <Text as="p" tone="subdued">{`Logs: ${deleteCounts.logs ?? 0}`}</Text>
                    <Text as="p" tone="subdued">{`Staged items: ${deleteCounts.staging ?? 0}`}</Text>
                    <Text as="p" tone="subdued">{`Sources: ${deleteCounts.sources ?? 0}`}</Text>
                    <Text as="p" tone="subdued">{`Runs: ${deleteCounts.runs ?? 0}`}</Text>
                    <Text as="p" tone="subdued">{`Diffs: ${deleteCounts.diffs ?? 0}`}</Text>
                  </BlockStack>
                ) : null}
              </Modal.Section>
            </Modal>
          </Frame>
        ) : null}
      </BlockStack>
      {/** Stream run progress + logs via unified SSE (falls back to polling) */}
      {activeRunId ? (
        <RunProgressSSE
          runId={activeRunId}
          fallbackIntervalMs={progressPollMs}
          onUpdate={(p: RunProgressPayloadExtended) => {
            setRunProgressExtended(p)
          }}
          onLog={batch => {
            if (!Array.isArray(batch) || batch.length === 0) return
            setRunLogs(prev => {
              const existing = new Set(prev.map(l => l.id))
              const fresh = batch.filter(l => !existing.has(l.id))
              return [...fresh, ...prev].slice(0, 50)
            })
          }}
          onConnStateChange={s => setStreamConn(s)}
        />
      ) : null}
    </Page>
  )
}

// Lightweight inline component for polling without introducing external dependencies
interface RunProgressPayloadExtended {
  ok?: boolean
  runId?: string
  status?: string
  progress?: Record<string, unknown>
  summary?: Record<string, unknown>
  finished?: boolean
  seedIndex?: number
  seedsTotal?: number
  etaSeconds?: number
  stuck?: boolean
  lastUpdated?: string
  startedAt?: string
}
// Legacy polling component removed after SSE adoption

// SSE-based progress updater with polling fallback (unified /stream)
function RunProgressSSE({
  runId,
  fallbackIntervalMs,
  onUpdate,
  onLog,
  onConnStateChange,
}: {
  runId: string
  fallbackIntervalMs: number
  onUpdate: (p: RunProgressPayloadExtended) => void
  onLog?: (logs: Array<{ id: string; at: string; type: string; payload?: string | null }>) => void
  onConnStateChange?: (state: 'connecting' | 'open' | 'closed' | 'fallback') => void
}) {
  React.useEffect(() => {
    let es: EventSource | null = null
    let stopped = false

    const setConn = (s: 'connecting' | 'open' | 'closed' | 'fallback') => {
      try {
        if (onConnStateChange) onConnStateChange(s)
      } catch {
        /* ignore */
      }
    }

    const startFallback = () => {
      if (stopped) return
      setConn('fallback')
      ;(async function poll() {
        if (stopped) return
        try {
          const resp = await fetch(`/api/importer/runs/${runId}/progress`)
          const jr = await resp.json()
          if (resp.ok && jr?.ok && !stopped) onUpdate(jr)
        } catch {
          /* ignore */
        } finally {
          if (!stopped) setTimeout(poll, fallbackIntervalMs)
        }
      })()
    }

    try {
      if (
        typeof window === 'undefined' ||
        typeof (window as unknown as { EventSource?: unknown }).EventSource === 'undefined'
      ) {
        startFallback()
        return () => {
          stopped = true
        }
      }
      setConn('connecting')
      es = new EventSource(`/api/importer/runs/${runId}/stream`)
      es.addEventListener('progress', ev => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as {
            status?: string
            progress?: Record<string, unknown>
            seedIndex?: number
            seedsTotal?: number
            etaSeconds?: number
            stuck?: boolean
            lastUpdated?: string
            startedAt?: string
          }
          const finished = data.status === 'staged' || data.status === 'failed' || data.status === 'cancelled'
          onUpdate({
            ok: true,
            runId,
            status: data.status,
            progress: (data.progress || {}) as Record<string, unknown>,
            seedIndex: data.seedIndex,
            seedsTotal: data.seedsTotal,
            etaSeconds: data.etaSeconds,
            stuck: data.stuck,
            lastUpdated: data.lastUpdated,
            startedAt: data.startedAt,
            finished,
          })
        } catch {
          /* ignore */
        }
      })
      es.addEventListener('log', ev => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as {
            logs?: Array<{ id: string; at: string; type: string; payload?: string | null }>
            nextCursor?: string
          }
          if (onLog && data.logs && data.logs.length) onLog(data.logs)
        } catch {
          /* ignore */
        }
      })
      es.addEventListener('ping', () => setConn('open'))
      es.addEventListener('end', () => {
        setConn('closed')
        try {
          es?.close()
        } catch {
          /* noop */
        }
      })
      es.addEventListener('error', () => {
        try {
          es?.close()
        } catch {
          /* noop */
        }
        startFallback()
      })
    } catch {
      startFallback()
    }
    return () => {
      stopped = true
      try {
        if (es) es.close()
      } catch {
        /* noop */
      }
    }
  }, [runId, fallbackIntervalMs, onUpdate, onLog, onConnStateChange])
  return null
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const id = params.templateId || ''
  if (!id) return json({ name: '' }, { headers: { 'X-RBP-Route': 'imports-settings', 'X-RBP-Template': '' } })
  try {
    const { prisma } = await import('../db.server')
    const row = await prisma.importTemplate.findUnique({
      where: { id },
      select: { name: true, importConfig: true, preparingRunId: true, state: true },
    })
    const cfg = (row?.importConfig as Record<string, unknown> | null) || {}
    const settings = (cfg['settings'] as Record<string, unknown> | null) || null
    const target = typeof settings?.['target'] === 'string' ? (settings?.['target'] as string) : undefined
    const discoverSeedUrls = Array.isArray(settings?.['discoverSeedUrls'])
      ? (settings?.['discoverSeedUrls'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined
    // Show Simple to reflect the enforced pipeline used by /api/importer/run
    const pipeline: 'simple' | 'full' = 'simple'
    return json(
      {
        name: row?.name || '',
        settings: { target, discoverSeedUrls },
        preparingRunId: typeof row?.preparingRunId === 'string' ? row!.preparingRunId : null,
        state: typeof row?.state === 'string' ? row!.state : null,
        pipeline,
      },
      { headers: { 'X-RBP-Route': 'imports-settings', 'X-RBP-Template': id } },
    )
  } catch {
    return json({ name: '' }, { headers: { 'X-RBP-Route': 'imports-settings', 'X-RBP-Template': id } })
  }
}

// Propagate diagnostic headers from the loader to the document response
export const headers: HeadersFunction = ({ loaderHeaders }) => {
  const h = new Headers()
  const route = loaderHeaders.get('X-RBP-Route')
  const tpl = loaderHeaders.get('X-RBP-Template')
  if (route) h.set('X-RBP-Route', route)
  if (tpl) h.set('X-RBP-Template', tpl)
  return h
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const id = params.templateId || ''
  if (!id) return json({ error: 'Missing template id' }, { status: 400 })
  const form = await request.formData()
  const intent = String(form.get('intent') || '')
  // If no intent provided, treat as an unexpected POST (likely a redirect carrying POST method) and convert to GET.
  if (!intent) {
    return redirect(`/app/imports/${id}?created=1`, 303)
  }
  if (intent !== 'save') return json({ error: 'Unsupported intent' }, { status: 400 })
  const name = String(form.get('name') || '').trim()
  if (!name) return json({ error: 'Name is required' }, { status: 400 })

  try {
    const { prisma } = await import('../db.server')
    const { renameTemplate } = await import('../models/specTemplate.server')
    await renameTemplate(id, name)
    await prisma.importTemplate.update({ where: { id }, data: { name } })
    return json({ ok: true })
  } catch (err) {
    const message = (err as Error)?.message || 'Failed to save settings'
    return json({ error: message }, { status: 500 })
  }
}
// <!-- END RBP GENERATED: importer-v2-3 (settings-index) -->
