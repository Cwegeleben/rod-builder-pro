// <!-- BEGIN RBP GENERATED: importer-v2-3 (re-inlined) -->
// Revert composition: inline Import Settings UI back into app routes
import React from 'react'
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
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
  Checkbox,
} from '@shopify/polaris'
// <!-- END RBP GENERATED: importer-crawlB-polaris-v1 -->
// <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
import { useSearchParams, useFetcher, useLocation, useLoaderData, useParams } from '@remix-run/react'
// <!-- END RBP GENERATED: importer-save-settings-v1 -->
// <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 -->
import { KNOWN_IMPORT_TARGETS, getTargetById } from '../server/importer/sites/targets'
import { requireHqShopOr404 } from '../lib/access.server'
import { useFetcher as useMFDefsFetcher } from '@remix-run/react'
// Batson metafield definitions helpers (server-side import via action/loader)
// Keys are created only when Batson Rod Blanks target is selected.
// <!-- END RBP GENERATED: importer-discover-unified-v1 -->

export default function ImportSettings() {
  // <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
  const loaderData = useLoaderData<typeof loader>() as {
    name?: string
    settings?: { target?: string; discoverSeedUrls?: string[] }
  }
  const { templateId } = useParams()
  // <!-- END RBP GENERATED: importer-save-settings-v1 -->
  const location = useLocation()
  const [params] = useSearchParams()
  const justCreated = params.get('created') === '1'
  const reviewError = params.get('reviewError') === '1'
  // <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 -->
  // Import Settings UI state: target selection auto-fills source URL
  // <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 -->
  const fetcher = useFetcher<{ urls?: string[]; debug?: Record<string, unknown>; preview?: unknown }>()
  const discovering = fetcher.state !== 'idle'
  // <!-- BEGIN RBP GENERATED: importer-crawlB-polaris-v1 -->
  const seedsFetched = Array.isArray(fetcher.data?.urls) ? (fetcher.data!.urls as string[]) : []
  const [seedsText, setSeedsText] = React.useState<string>('')
  const [showSavedToast, setShowSavedToast] = React.useState<boolean>(false)
  // <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
  const [saveLoading, setSaveLoading] = React.useState<boolean>(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [crawlLoading, setCrawlLoading] = React.useState<boolean>(false)
  // Overwrite confirmation (replace window.confirm)
  const [overwriteModalOpen, setOverwriteModalOpen] = React.useState<boolean>(false)
  const [overwriteStagedCount, setOverwriteStagedCount] = React.useState<number>(0)
  const [overwriteConfirmLoading, setOverwriteConfirmLoading] = React.useState<boolean>(false)
  const [overwriteForceClear, setOverwriteForceClear] = React.useState<boolean>(false)
  const overwriteContinueRef = React.useRef<null | (() => Promise<void>)>(null)
  // Clear staging modal state
  const [clearModalOpen, setClearModalOpen] = React.useState<boolean>(false)
  const [clearLoading, setClearLoading] = React.useState<boolean>(false)
  const [clearCount, setClearCount] = React.useState<number | null>(null)
  const [clearError, setClearError] = React.useState<string | null>(null)
  const [showClearedToast, setShowClearedToast] = React.useState<boolean>(false)
  // <!-- END RBP GENERATED: importer-save-settings-v1 -->
  // Single source of truth: the editor text. We'll parse it as needed.
  const seeds = React.useMemo(() => parseSeeds(seedsText), [seedsText])
  const [importName, setImportName] = React.useState<string>('')
  React.useEffect(() => {
    // Initialize editor with fetched seeds if editor is empty
    if (!seedsText && seedsFetched.length) setSeedsText(seedsFetched.join('\n'))
  }, [seedsFetched])
  // <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
  React.useEffect(() => {
    // Initialize import name from server
    if (typeof loaderData?.name === 'string') setImportName(loaderData.name)
  }, [loaderData?.name])
  React.useEffect(() => {
    // Initialize saved target if present
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
    // Initialize saved seeds if present
    const saved = loaderData?.settings?.discoverSeedUrls || []
    if (saved.length) setSeedsText(saved.join('\n'))
  }, [loaderData?.settings?.discoverSeedUrls])
  // <!-- END RBP GENERATED: importer-save-settings-v1 -->
  function parseSeeds(input: string): string[] {
    return input
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
  }
  // removed: isValidHttpUrl helper and headless diagnostics
  // <!-- END RBP GENERATED: importer-crawlB-polaris-v1 -->
  const [targetId, setTargetId] = React.useState<string>('batson-rod-blanks')
  const [sourceUrl, setSourceUrl] = React.useState<string>('https://batsonenterprises.com/rod-blanks')
  const [siteId, setSiteId] = React.useState<string>('batson-rod-blanks')
  // Metafield definitions status fetcher
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
      // Auto-load report when target changes
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
  // removed: debug normalization for discovery/headless preview
  // <!-- END RBP GENERATED: importer-discover-unified-v1 -->
  // <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
  // removed: unused saveSettings helper (inlined into onSaveAndCrawl)
  // Treat certain browser-originated errors as benign noise (e.g., invalid URL pattern from embedded context)
  function isBenignPatternError(msg: unknown): boolean {
    try {
      const s = String(msg || '').toLowerCase()
      return s.includes('the string did not match the expected pattern')
    } catch {
      return false
    }
  }
  async function onSaveAndCrawl() {
    if (!templateId) return
    // Guard against invalid input and surface a friendly message instead of native popups
    if (!targetId) {
      setSaveError('Please select a target before saving.')
      return
    }
    const validSeeds = seeds.filter(s => {
      try {
        const u = new URL(s)
        return u.protocol === 'http:' || u.protocol === 'https:'
      } catch {
        return false
      }
    })
    if (validSeeds.length === 0) {
      setSaveError('Please provide at least one valid URL (https://…) in Seeds.')
      return
    }
    // Client-side Batson seed scope guard for faster feedback
    if (/^batson-/.test(targetId)) {
      const bad = validSeeds.filter(s => {
        try {
          const u = new URL(s)
          return !['batsonenterprises.com', 'www.batsonenterprises.com'].includes(u.hostname)
        } catch {
          return true
        }
      })
      if (bad.length) {
        setSaveError(
          `Seeds must be within batsonenterprises.com. Off-domain URLs: ${bad.slice(0, 3).join(', ')}${
            bad.length > 3 ? ` and ${bad.length - 3} more…` : ''
          }`,
        )
        return
      }
    }
    setCrawlLoading(true)
    try {
      // Persist edited seeds along with other settings
      const ok = await (async () => {
        setSaveError(null)
        setSaveLoading(true)
        try {
          const res = await fetch(`/api/importer/targets/${templateId}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: importName, target: targetId, discoverSeedUrls: validSeeds }),
          })
          const data = await res.json()
          if (!res.ok || !data?.ok) throw new Error(String(data?.error || 'Failed to save settings'))
          return true
        } catch (err) {
          const m = (err as Error)?.message || 'Failed to save settings'
          // Suppress known-benign URL pattern errors that can occur in embedded contexts
          if (!isBenignPatternError(m)) setSaveError(m)
          return false
        } finally {
          setSaveLoading(false)
        }
      })()
      if (!ok) return
      // Kick off background prepare to crawl and stage
      const startPrepare = async (confirmOverwrite?: boolean, forceClear?: boolean) => {
        const resp = await fetch('/api/importer/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            confirmOverwrite
              ? { templateId, confirmOverwrite: true, overwriteExisting: Boolean(forceClear) }
              : { templateId },
          ),
        })
        return { resp, data: (await resp.json()) as Record<string, unknown> }
      }
      const { resp, data } = await startPrepare(false)
      if (resp.status === 409 && (data as { code?: string }).code === 'confirm_overwrite') {
        // Open Polaris modal to confirm overwrite
        const staged = (data as { stagedCount?: number }).stagedCount || 0
        setOverwriteStagedCount(staged)
        setOverwriteForceClear(false)
        overwriteContinueRef.current = async () => {
          const res2 = await startPrepare(true, overwriteForceClear)
          const resp2 = res2.resp
          const data2 = res2.data
          if (!resp2.ok || !(data2 as { runId?: string }).runId) {
            const msg = (data2 as { error?: string })?.error || 'Save and Crawl failed'
            throw new Error(msg)
          }
          const c =
            typeof (data2 as { candidates?: number }).candidates === 'number'
              ? (data2 as { candidates?: number }).candidates
              : undefined
          const eta =
            typeof (data2 as { etaSeconds?: number }).etaSeconds === 'number'
              ? (data2 as { etaSeconds?: number }).etaSeconds
              : undefined
          const exp =
            typeof (data2 as { expectedItems?: number }).expectedItems === 'number'
              ? (data2 as { expectedItems?: number }).expectedItems
              : undefined
          const qs = new URLSearchParams(location.search)
          qs.set('started', '1')
          qs.set('tpl', templateId)
          if (typeof c === 'number') qs.set('c', String(c))
          if (typeof eta === 'number') qs.set('eta', String(eta))
          if (typeof exp === 'number') qs.set('exp', String(exp))
          // Fire a quick toast locally before redirect (visible if redirect blocked)
          try {
            setShowSavedToast(true)
          } catch {
            /* ignore toast errors */
          }
          navigateToImports(qs)
        }
        setOverwriteModalOpen(true)
        return
      }
      if (!resp.ok || !(data as { runId?: string }).runId) {
        const msg = (data as { error?: string })?.error || 'Save and Crawl failed'
        throw new Error(msg)
      }
      const c = typeof data.candidates === 'number' ? data.candidates : undefined
      const eta = typeof data.etaSeconds === 'number' ? data.etaSeconds : undefined
      const exp = typeof data.expectedItems === 'number' ? data.expectedItems : undefined
      const qs = new URLSearchParams(location.search)
      qs.set('started', '1')
      qs.set('tpl', templateId)
      if (typeof c === 'number') qs.set('c', String(c))
      if (typeof eta === 'number') qs.set('eta', String(eta))
      if (typeof exp === 'number') qs.set('exp', String(exp))
      // Fire a quick toast locally before redirect (visible if redirect blocked)
      try {
        setShowSavedToast(true)
      } catch {
        /* ignore toast errors */
      }
      // Navigate to Imports list (prefer absolute Admin URL when embedded)
      navigateToImports(qs)
    } catch (e) {
      const m = (e as Error)?.message || 'Save and Crawl failed'
      if (!isBenignPatternError(m)) setSaveError(m)
    } finally {
      setCrawlLoading(false)
    }
  }
  function navigateToImports(qs: URLSearchParams) {
    const rel = `/app/imports?${qs.toString()}`
    try {
      // Try to construct absolute Admin URL from document.referrer
      const ref = document.referrer || ''
      const m = ref.match(/^https:\/\/admin\.shopify\.com\/store\/[^/]+/)
      if (m && m[0]) {
        const base = m[0]
        const abs = `${base}/apps/rbp-app${rel}`
        // Prefer top-level redirect to escape iframe if possible
        try {
          if (window.top) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(window.top as any).location.assign(abs)
            return
          }
        } catch {
          /* cross-origin guard */
        }
        window.location.assign(abs)
        return
      }
    } catch {
      /* ignore and fall back to relative */
    }
    window.location.assign(rel)
  }
  // <!-- END RBP GENERATED: importer-save-settings-v1 -->
  return (
    // <!-- BEGIN RBP GENERATED: importer-crawlB-polaris-v1 -->
    <Page
      title="Import Settings"
      subtitle="Guided flow: 1) Setup → 2) Seeds → 3) Save & Crawl"
      backAction={{ content: 'Back to Imports', url: `/app/imports${location.search}` }}
    >
      <BlockStack gap="400">
        {/* Metafield definitions UI moved into Target card below */}
        {/* Global top bar loader while discovery runs */}
        {discovering ? (
          <Frame>
            <Loading />
          </Frame>
        ) : null}
        {/* Launcher failure banner */}
        {reviewError ? (
          <Banner tone="critical" title="Couldn’t prepare Review">
            <p>
              We couldn’t crawl and stage items for review just now. You can adjust settings and try again. If the
              problem persists, Review will still open using any existing staging data.
            </p>
            <InlineStack gap="200">
              <Button url={`/app/imports/${templateId}/review${location.search}`} variant="primary">
                Try Review again
              </Button>
            </InlineStack>
          </Banner>
        ) : null}
        {/* Toasts */}
        {showSavedToast ? (
          <Frame>
            <Toast content="Settings saved" onDismiss={() => setShowSavedToast(false)} duration={2000} />
          </Frame>
        ) : null}
        {showClearedToast ? (
          <Frame>
            <Toast content="Cleared staged rows" onDismiss={() => setShowClearedToast(false)} duration={3000} />
          </Frame>
        ) : null}
        {/* <!-- BEGIN RBP GENERATED: importer-save-settings-v1 --> */}
        {saveError && !isBenignPatternError(saveError) ? (
          <Banner tone="critical" title="Save failed">
            <p>{saveError}</p>
          </Banner>
        ) : null}
        {/* <!-- END RBP GENERATED: importer-save-settings-v1 --> */}
        {/* Publish removed; review is launched from the list and auto-stages */}

        {/* Stepper header */}
        <Card>
          <BlockStack gap="200">
            <InlineStack gap="300" blockAlign="center">
              <Badge tone="success">1. Setup target</Badge>
              <Badge tone={seeds.length ? 'success' : 'attention'}>2. Seeds</Badge>
              <Badge tone="attention">3. Save & Crawl</Badge>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Details */}
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
        {/* Target */}
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
                  options={KNOWN_IMPORT_TARGETS.map(t => ({ label: t.label, value: t.id }))}
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
                  const data = new FormData()
                  data.set('siteId', siteId)
                  data.set('sourceUrl', sourceUrl)
                  // Always fetch a quick preview as part of discovery to guide the next step
                  data.set('alsoPreview', '1')
                  fetcher.submit(data, { method: 'post', action: '/api/importer/crawl/discover' })
                }}
              >
                Discover
              </Button>
              {discovering ? <Spinner accessibilityLabel="Discovering series" size="small" /> : null}
              {/* Headless availability diagnostics removed for simplicity */}
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Seeds */}
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
              {/* Skeleton hint while discovering and no seeds yet */}
              {discovering && seeds.length === 0 ? <SkeletonBodyText lines={4} /> : null}
              <TextField
                label="Series URLs"
                value={seedsText}
                onChange={val => setSeedsText(val)}
                autoComplete="off"
                multiline={16}
                placeholder={seedsFetched.length ? '' : 'Paste one URL per line'}
                helpText="Edit the discovered list or paste your own. These will be saved when you click Save & Crawl."
              />
              {seedsText ? (
                <details>
                  <summary>View all seeds (scroll)</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '40vh', overflow: 'auto' }}>{seedsText}</pre>
                </details>
              ) : null}
              {/* Removed Use/Reset buttons: edits are saved automatically by Save & Crawl */}
              {!seedsFetched.length && !seeds.length ? (
                <Banner tone="warning" title="No seeds yet">
                  <p>Click Discover to fetch seeds, or paste URLs above and then click Save & Crawl.</p>
                </Banner>
              ) : null}
            </BlockStack>
          </BlockStack>
        </Card>

        {/* Preview removed for clarity; Save & Crawl is the single-path action */}

        {/* Step 4: Save & Crawl */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Save & Crawl
            </Text>
            <Text as="p" tone="subdued">
              This will save the settings (name, selected target, and current seeds) and start a background crawl to
              prepare a Review. You can track progress from the Imports list.
            </Text>
            <InlineStack gap="200" align="start">
              <Button
                variant="primary"
                onClick={() => {
                  // Keep clicks client-side; avoid any native form submission if present upstream
                  onSaveAndCrawl()
                }}
                loading={crawlLoading || saveLoading}
                disabled={crawlLoading || saveLoading || seeds.length === 0}
              >
                Save and Crawl
              </Button>
              <Button
                tone="critical"
                variant="secondary"
                disabled={!templateId}
                onClick={async () => {
                  if (!templateId) return
                  setClearError(null)
                  setClearLoading(true)
                  try {
                    // First, dry-run to get a count and then open confirm modal
                    const r = await fetch('/api/importer/staging/clear', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ templateId, dryRun: true }),
                    })
                    const d = (await r.json()) as { ok?: boolean; count?: number; error?: string }
                    if (!r.ok || !d?.ok) throw new Error(d?.error || 'Failed to estimate staged rows')
                    setClearCount(typeof d.count === 'number' ? d.count : 0)
                    setClearModalOpen(true)
                  } catch (err) {
                    setClearError((err as Error)?.message || 'Failed to estimate staged rows')
                  } finally {
                    setClearLoading(false)
                  }
                }}
                loading={clearLoading}
              >
                Clear staging…
              </Button>
              <Text as="span" tone="subdued">
                {seeds.length === 0 ? 'Add or discover seeds to enable.' : `${seeds.length} seed(s) will be used.`}
              </Text>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Overwrite confirmation modal */}
        {overwriteModalOpen ? (
          <Frame>
            <Modal
              open
              title="Overwrite staged items?"
              onClose={() => {
                setOverwriteModalOpen(false)
                overwriteContinueRef.current = null
                setSaveError('Cancelled by user. Existing staged items were left untouched.')
              }}
              primaryAction={{
                content: 'Overwrite and continue',
                destructive: true,
                loading: overwriteConfirmLoading,
                onAction: async () => {
                  if (!overwriteContinueRef.current) return
                  try {
                    setOverwriteConfirmLoading(true)
                    await overwriteContinueRef.current()
                  } catch (err) {
                    setSaveError((err as Error)?.message || 'Save and Crawl failed')
                  } finally {
                    setOverwriteConfirmLoading(false)
                    setOverwriteModalOpen(false)
                    overwriteContinueRef.current = null
                  }
                },
              }}
              secondaryActions={[
                {
                  content: 'Cancel',
                  onAction: () => {
                    setOverwriteModalOpen(false)
                    overwriteContinueRef.current = null
                    setSaveError('Cancelled by user. Existing staged items were left untouched.')
                  },
                },
              ]}
            >
              <Modal.Section>
                <Text as="p">This will overwrite {overwriteStagedCount} staged item(s). Continue?</Text>
                <div style={{ marginTop: 12 }}>
                  <Checkbox
                    label="Force fresh staging (delete all staged rows before running)"
                    checked={overwriteForceClear}
                    onChange={val => setOverwriteForceClear(Boolean(val))}
                    helpText="Best-effort wipe of existing staged rows for this supplier before the new run."
                  />
                </div>
              </Modal.Section>
            </Modal>
          </Frame>
        ) : null}

        {/* Clear staging confirmation modal */}
        {clearModalOpen ? (
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
                      body: JSON.stringify({ templateId }),
                    })
                    const d = (await r.json()) as { ok?: boolean; deleted?: number; error?: string }
                    if (!r.ok || !d?.ok) throw new Error(d?.error || 'Failed to clear staged rows')
                    // Also clear saved seeds (persist and update UI)
                    try {
                      const res = await fetch(`/api/importer/targets/${templateId}/settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: importName, target: targetId, discoverSeedUrls: [] }),
                      })
                      // Best-effort: don't block on a failure here
                      if (res.ok) setSeedsText('')
                    } catch {
                      /* ignore */
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
                  .
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

        {/* Debug details removed to reduce noise */}

        {/* Page primaryAction handles Save */}
      </BlockStack>
    </Page>
    // <!-- END RBP GENERATED: importer-crawlB-polaris-v1 -->
  )
}
// <!-- END RBP GENERATED: importer-v2-3 (re-inlined) -->

// Server-side loader to fetch current Import name
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const id = params.templateId || ''
  if (!id) return json({ name: '' })
  try {
    const { prisma } = await import('../db.server')
    const row = await prisma.importTemplate.findUnique({ where: { id }, select: { name: true, importConfig: true } })
    const cfg = (row?.importConfig as Record<string, unknown> | null) || {}
    const settings = (cfg['settings'] as Record<string, unknown> | null) || null
    const target = typeof settings?.['target'] === 'string' ? (settings?.['target'] as string) : undefined
    const discoverSeedUrls = Array.isArray(settings?.['discoverSeedUrls'])
      ? (settings?.['discoverSeedUrls'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined
    return json({ name: row?.name || '', settings: { target, discoverSeedUrls } })
  } catch {
    return json({ name: '' })
  }
}

// Server-side action to persist Import name (and keep SpecTemplate in sync)
export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const id = params.templateId || ''
  if (!id) return json({ error: 'Missing template id' }, { status: 400 })
  const form = await request.formData()
  const intent = String(form.get('intent') || '')
  if (intent !== 'save') return json({ error: 'Unsupported intent' }, { status: 400 })
  const name = String(form.get('name') || '').trim()
  if (!name) return json({ error: 'Name is required' }, { status: 400 })

  try {
    const { prisma } = await import('../db.server')
    const { renameTemplate } = await import('../models/specTemplate.server')
    // 1) Rename SpecTemplate (updates core field keys based on name)
    await renameTemplate(id, name)
    // 2) Keep ImportTemplate name in sync
    await prisma.importTemplate.update({ where: { id }, data: { name } })
    return json({ ok: true })
  } catch (err) {
    const message = (err as Error)?.message || 'Failed to save settings'
    return json({ error: message }, { status: 500 })
  }
}
