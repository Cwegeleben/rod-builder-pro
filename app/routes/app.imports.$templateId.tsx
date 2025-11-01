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
  DataTable,
  Badge,
  Divider,
  InlineCode,
  SkeletonBodyText,
  Tooltip,
  Toast,
  Frame,
} from '@shopify/polaris'
// <!-- END RBP GENERATED: importer-crawlB-polaris-v1 -->
// <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
import { useSearchParams, useFetcher, useLocation, useLoaderData, useParams } from '@remix-run/react'
// <!-- END RBP GENERATED: importer-save-settings-v1 -->
// <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 -->
import { KNOWN_IMPORT_TARGETS, getTargetById } from '../server/importer/sites/targets'
import { requireHqShopOr404 } from '../lib/access.server'
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
  // <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 -->
  // Import Settings UI state: target selection auto-fills source URL
  // <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 -->
  const fetcher = useFetcher<{ urls?: string[]; debug?: Record<string, unknown>; preview?: unknown }>()
  // <!-- BEGIN RBP GENERATED: importer-crawlB-polaris-v1 -->
  const previewFetcher = useFetcher<{
    rows?: Array<{ raw?: Record<string, unknown>; spec?: Record<string, unknown> }>
    preview?: {
      product?: { variants?: unknown[]; options?: Array<{ name?: string }>; metafields?: unknown[]; tags?: unknown[] }
    }
    debug?: Record<string, unknown>
  }>()
  const seedsFetched = Array.isArray(fetcher.data?.urls) ? (fetcher.data!.urls as string[]) : []
  const [seedsOverride, setSeedsOverride] = React.useState<string[] | null>(null)
  const [seedsText, setSeedsText] = React.useState<string>('')
  const [showAppliedToast, setShowAppliedToast] = React.useState<boolean>(false)
  const [showSavedToast, setShowSavedToast] = React.useState<boolean>(false)
  const [showPublishedToast, setShowPublishedToast] = React.useState<boolean>(false)
  // <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
  const [saveLoading, setSaveLoading] = React.useState<boolean>(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  // <!-- END RBP GENERATED: importer-save-settings-v1 -->
  const seeds = (seedsOverride ?? seedsFetched) as string[]
  const [importName, setImportName] = React.useState<string>('')
  React.useEffect(() => {
    // Initialize editor with fetched seeds only if user hasn't applied an override yet
    if (!seedsOverride) setSeedsText(seedsFetched.join('\n'))
    /* no-op: preview selection removed */
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
    if (saved.length) {
      setSeedsOverride(saved)
      setSeedsText(saved.join('\n'))
    }
  }, [loaderData?.settings?.discoverSeedUrls])
  // <!-- END RBP GENERATED: importer-save-settings-v1 -->
  function parseSeeds(input: string): string[] {
    return input
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
  }
  // Prefer preview from explicit preview request; fall back to discover's preview if present
  const previewExplicit = (previewFetcher.data || null) as null | {
    rows?: Array<{ raw?: Record<string, unknown>; spec?: Record<string, unknown> }>
    preview?: {
      product?: { variants?: unknown[]; options?: Array<{ name?: string }>; metafields?: unknown[]; tags?: unknown[] }
    }
  }
  const previewFromDiscover = (
    fetcher.data && (fetcher.data as { preview?: unknown }).preview
      ? ((fetcher.data as { preview?: unknown }).preview as {
          preview?: {
            product?: {
              variants?: unknown[]
              options?: Array<{ name?: string }>
              metafields?: unknown[]
              tags?: unknown[]
            }
          }
        })
      : null
  ) as null | {
    rows?: Array<{ raw?: Record<string, unknown>; spec?: Record<string, unknown> }>
    preview?: {
      product?: { variants?: unknown[]; options?: Array<{ name?: string }>; metafields?: unknown[]; tags?: unknown[] }
    }
  }
  const preview = (previewExplicit || previewFromDiscover) as typeof previewExplicit
  const previewRows =
    (preview?.rows as Array<{ raw?: Record<string, unknown>; spec?: Record<string, unknown> }> | undefined) ?? []
  const previewLoading = previewFetcher.state !== 'idle'
  const headlessAvailable = true
  // <!-- END RBP GENERATED: importer-crawlB-polaris-v1 -->
  const [targetId, setTargetId] = React.useState<string>('batson-rod-blanks')
  const [sourceUrl, setSourceUrl] = React.useState<string>('https://batsonenterprises.com/rod-blanks')
  const [siteId, setSiteId] = React.useState<string>('batson-rod-blanks')

  function onTargetChange(id: string) {
    setTargetId(id)
    const t = getTargetById(id)
    if (t) {
      setSourceUrl(t.url)
      setSiteId(t.siteId)
    }
  }
  const data = (fetcher.data || {}) as { urls?: string[]; debug?: Record<string, unknown> }
  const dbg = data.debug || {}
  type DebugSafe = {
    siteId: string
    status: string | number
    usedMode: string
    pageTitle: string
    contentLength: number
    textLength: number
    strategyUsed: string
    sample: string[]
    htmlExcerpt: string
    headless: { attempted: boolean; available: boolean; error?: string }
    notes: string[]
  }
  const asString = (v: unknown, fb: string) => (typeof v === 'string' ? v : fb)
  const asNumber = (v: unknown, fb: number) =>
    typeof v === 'number' ? v : Number.isFinite(v as number) ? Number(v) : fb
  const asBool = (v: unknown, fb: boolean) => (typeof v === 'boolean' ? v : fb)
  const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : [])
  const d = (dbg ?? {}) as Record<string, unknown>
  const head = (d.headless ?? {}) as Record<string, unknown>
  const safe: DebugSafe = {
    siteId: asString(d.siteId, 'unknown'),
    status: typeof d.status === 'number' || typeof d.status === 'string' ? (d.status as number | string) : 'n/a',
    usedMode: asString(d.usedMode, 'unknown'),
    pageTitle: asString(d.pageTitle, 'n/a'),
    contentLength: asNumber(d.contentLength, 0),
    textLength: asNumber(d.textLength, 0),
    strategyUsed: asString(d.strategyUsed, 'n/a'),
    sample: asStringArray(d.sample),
    htmlExcerpt: asString(d.htmlExcerpt, '(no excerpt)'),
    headless: {
      attempted: asBool(head.attempted, false),
      available: asBool(head.available, false),
      error: typeof head.error === 'string' ? head.error : undefined,
    },
    notes: asStringArray(d.notes).length ? asStringArray(d.notes) : ['(synthesized) No server diagnostics.'],
  }
  // <!-- END RBP GENERATED: importer-discover-unified-v1 -->
  // <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
  async function onSave() {
    setSaveError(null)
    setSaveLoading(true)
    try {
      const res = await fetch(`/api/importer/targets/${templateId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: importName, target: targetId, discoverSeedUrls: seeds }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(String(data?.error || 'Failed to save settings'))
      }
      setShowSavedToast(true)
    } catch (err) {
      setSaveError((err as Error)?.message || 'Failed to save settings')
    } finally {
      setSaveLoading(false)
    }
  }
  // <!-- END RBP GENERATED: importer-save-settings-v1 -->
  function onPublish() {
    // Trigger publish action when available; for now, show a Polaris toast
    setShowPublishedToast(true)
  }
  return (
    // <!-- BEGIN RBP GENERATED: importer-crawlB-polaris-v1 -->
    <Page
      title="Import Settings"
      subtitle="Target → Seeds → Preview → Debug"
      primaryAction={{ content: 'Save settings', onAction: onSave, loading: saveLoading, disabled: saveLoading }}
      secondaryActions={[{ content: 'Publish', onAction: onPublish }]}
      backAction={{ content: 'Back to Imports', url: `/app/imports${location.search}` }}
    >
      <BlockStack gap="400">
        {/* Toasts */}
        {showAppliedToast ? (
          <Frame>
            <Toast content="Applied edited seeds" onDismiss={() => setShowAppliedToast(false)} duration={2000} />
          </Frame>
        ) : null}
        {showSavedToast ? (
          <Frame>
            <Toast content="Settings saved" onDismiss={() => setShowSavedToast(false)} duration={2000} />
          </Frame>
        ) : null}
        {/* <!-- BEGIN RBP GENERATED: importer-save-settings-v1 --> */}
        {saveError ? (
          <Banner tone="critical" title="Save failed">
            <p>{saveError}</p>
          </Banner>
        ) : null}
        {/* <!-- END RBP GENERATED: importer-save-settings-v1 --> */}
        {showPublishedToast ? (
          <Frame>
            <Toast content="Import published" onDismiss={() => setShowPublishedToast(false)} duration={2000} />
          </Frame>
        ) : null}

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
                helpText="Give this import a descriptive name."
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
            <InlineStack gap="200">
              <Button
                variant="primary"
                disabled={!siteId || !sourceUrl}
                onClick={() => {
                  const data = new FormData()
                  data.set('siteId', siteId)
                  data.set('sourceUrl', sourceUrl)
                  fetcher.submit(data, { method: 'post', action: '/api/importer/crawl/discover' })
                }}
              >
                Discover series
              </Button>
              <Button
                disabled={!siteId || !sourceUrl}
                onClick={() => {
                  const data = new FormData()
                  data.set('siteId', siteId)
                  data.set('sourceUrl', sourceUrl)
                  data.set('alsoPreview', '1')
                  fetcher.submit(data, { method: 'post', action: '/api/importer/crawl/discover' })
                }}
              >
                Discover + preview first
              </Button>
              <Tooltip content="Static fetch; fallback to headless if empty">
                <Badge tone={headlessAvailable ? 'success' : 'attention'}>
                  {headlessAvailable ? 'Headless available' : 'Headless not available'}
                </Badge>
              </Tooltip>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Seeds */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">
                Discovered series (seeds)
              </Text>
              <Text variant="bodySm" as="span">
                {seeds.length} in use
              </Text>
            </InlineStack>
            <BlockStack gap="200">
              <TextField
                label="Series URLs (editable)"
                value={seedsText}
                onChange={val => setSeedsText(val)}
                autoComplete="off"
                multiline={16}
                placeholder={seedsFetched.length ? '' : 'Paste one URL per line'}
                helpText="Edit the discovered list or paste your own. Click Apply to use these for preview/import."
              />
              {seedsText ? (
                <details>
                  <summary>View all seeds (scroll)</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '40vh', overflow: 'auto' }}>{seedsText}</pre>
                </details>
              ) : null}
              <InlineStack gap="200">
                <Button
                  onClick={() => {
                    const next = parseSeeds(seedsText)
                    setSeedsOverride(next)
                    setShowAppliedToast(true)
                  }}
                >{`Apply edits (${parseSeeds(seedsText).length})`}</Button>
                <Button
                  onClick={() => {
                    setSeedsOverride(null)
                    setSeedsText(seedsFetched.join('\n'))
                  }}
                  disabled={!seedsFetched.length}
                >{`Reset to discovered (${seedsFetched.length})`}</Button>
              </InlineStack>
              {!seedsFetched.length && !seeds.length ? (
                <Banner tone="warning" title="No seeds yet">
                  <p>Click Discover to fetch seeds, or paste URLs above and click Apply.</p>
                </Banner>
              ) : null}
              {/* Preview URL selector and Open button removed */}
            </BlockStack>
          </BlockStack>
        </Card>

        {/* Preview */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">
                Preview
              </Text>
              <InlineStack gap="200"></InlineStack>
            </InlineStack>

            {previewLoading && <SkeletonBodyText lines={3} />}
            {/* No explicit build button; preview will show when available from Discover or background load */}
            {preview && (preview as unknown as { error?: unknown })?.error ? (
              <Banner tone="critical" title="Preview failed">
                <p>{String((preview as unknown as { error?: unknown })?.error)}</p>
              </Banner>
            ) : null}
            {preview && !('preview' in (preview as Record<string, unknown>)) ? (
              <details>
                <summary>Server response (debug)</summary>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(preview, null, 2)}</pre>
              </details>
            ) : null}
            {preview && preview.preview ? (
              <BlockStack gap="200">
                <Text as="p">
                  <InlineCode>usedMode</InlineCode>:{' '}
                  {String((previewFetcher.data?.debug as { usedMode?: string } | undefined)?.usedMode ?? 'n/a')}
                </Text>
                <InlineStack gap="400" align="start">
                  <Text as="p">
                    <InlineCode>variants</InlineCode>: {preview.preview.product?.variants?.length ?? 0}
                  </Text>
                  <Text as="p">
                    <InlineCode>options</InlineCode>:{' '}
                    {((preview.preview.product?.options ?? []) as Array<{ name?: string }>)
                      .map(o => o.name || '')
                      .join(', ')}
                  </Text>
                  <Text as="p">
                    <InlineCode>metafields</InlineCode>: {preview.preview.product?.metafields?.length ?? 0}
                  </Text>
                  <Text as="p">
                    <InlineCode>tags</InlineCode>: {(preview.preview.product?.tags ?? []).length}
                  </Text>
                </InlineStack>
                <Divider />
                <Text as="h3" variant="headingSm">
                  Variants
                </Text>
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                  headings={['SKU', 'Length', 'Power', 'Action', 'Price']}
                  rows={(
                    (preview.preview.product?.variants ?? []) as Array<{
                      sku?: string
                      option1?: string
                      option2?: string
                      option3?: string
                      price?: string
                    }>
                  )
                    .slice(0, 25)
                    .map(v => [v.sku || '', v.option1 || '', v.option2 || '', v.option3 || '', v.price || ''])}
                />
                {/* Attributes table from parsed rows */}
                {previewRows.length ? (
                  <>
                    <Divider />
                    <Text as="h3" variant="headingSm">
                      Attributes (parsed)
                    </Text>
                    <DataTable
                      columnContentTypes={[
                        'text',
                        'text',
                        'text',
                        'text',
                        'text',
                        'text',
                        'text',
                        'text',
                        'text',
                        'text',
                        'text',
                        'text',
                      ]}
                      headings={[
                        'Code',
                        'Model',
                        'Length',
                        'Power',
                        'Action',
                        'Line (lb)',
                        'Lure (oz)',
                        'Weight (oz)',
                        'Butt dia (in)',
                        'Tip top',
                        'Availability',
                        'Price',
                      ]}
                      rows={previewRows.slice(0, 25).map(r => {
                        const spec = (r.spec as Record<string, unknown>) || {}
                        const raw = (r.raw as Record<string, unknown>) || {}
                        const length =
                          (spec['length_label'] as string) || (spec['length_in'] ? `${spec['length_in']}"` : '')
                        const line =
                          spec['line_lb_min'] || spec['line_lb_max']
                            ? `${spec['line_lb_min'] ?? ''}-${spec['line_lb_max'] ?? ''}`
                            : ''
                        const lure =
                          spec['lure_oz_min'] || spec['lure_oz_max']
                            ? `${spec['lure_oz_min'] ?? ''}-${spec['lure_oz_max'] ?? ''}`
                            : ''
                        return [
                          String((raw['code'] as string) || ''),
                          String((raw['model'] as string) || ''),
                          String(length || ''),
                          String((spec['power'] as string) || ''),
                          String((spec['action'] as string) || ''),
                          String(line || ''),
                          String(lure || ''),
                          String((spec['weight_oz'] as number | string | undefined) ?? ''),
                          String((spec['butt_dia_in'] as number | string | undefined) ?? ''),
                          String((spec['tip_top_size'] as string) || ''),
                          String((raw['availability'] as string) || ''),
                          String((raw['price'] as number | string | undefined) ?? ''),
                        ]
                      })}
                    />
                  </>
                ) : null}
              </BlockStack>
            ) : null}
          </BlockStack>
        </Card>

        {/* Debug */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Debug details
            </Text>
            <InlineStack gap="400">
              <Text as="p">
                <InlineCode>siteId</InlineCode>: {safe.siteId ?? 'unknown'}
              </Text>
              <Text as="p">
                <InlineCode>usedMode</InlineCode>: {safe.usedMode ?? 'unknown'}
              </Text>
              <Text as="p">
                <InlineCode>status</InlineCode>: {String(safe.status ?? 'n/a')}
              </Text>
              <Text as="p">
                <InlineCode>contentLength</InlineCode>: {String(safe.contentLength ?? 0)}
              </Text>
              <Text as="p">
                <InlineCode>textLength</InlineCode>: {String(safe.textLength ?? 0)}
              </Text>
            </InlineStack>
            <Text as="p">
              <InlineCode>pageTitle</InlineCode>: {safe.pageTitle ?? 'n/a'}
            </Text>
            <Text as="p">
              <InlineCode>strategyUsed</InlineCode>: {safe.strategyUsed ?? 'n/a'}
            </Text>
            <Text as="p">
              <InlineCode>sample</InlineCode>: {safe.sample.slice(0, 5).join('\n')}
            </Text>
            <Divider />
            <details>
              <summary>HTML excerpt (first ~600 chars)</summary>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{safe.htmlExcerpt ?? '(no excerpt)'}</pre>
            </details>
          </BlockStack>
        </Card>

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
