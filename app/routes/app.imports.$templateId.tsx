// <!-- BEGIN RBP GENERATED: importer-v2-3 (re-inlined) -->
// Revert composition: inline Import Settings UI back into app routes
import React from 'react'
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
import { useSearchParams, useFetcher } from '@remix-run/react'
// <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 -->
import { KNOWN_IMPORT_TARGETS, getTargetById } from '../server/importer/sites/targets'
// <!-- END RBP GENERATED: importer-discover-unified-v1 -->

export default function ImportSettings() {
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
  const [selectedSeed, setSelectedSeed] = React.useState<string>('')
  const [showAppliedToast, setShowAppliedToast] = React.useState<boolean>(false)
  const seeds = (seedsOverride ?? seedsFetched) as string[]
  React.useEffect(() => {
    // Initialize editor with fetched seeds only if user hasn't applied an override yet
    if (!seedsOverride) setSeedsText(seedsFetched.join('\n'))
    if (!selectedSeed && seedsFetched.length) setSelectedSeed(seedsFetched[0])
  }, [seedsFetched])
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
  async function onSave() {
    // <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 -->
    alert('Saved settings (demo).')
    // <!-- END RBP GENERATED: importer-discover-unified-v1 -->
  }
  return (
    // <!-- BEGIN RBP GENERATED: importer-crawlB-polaris-v1 -->
    <Page
      title="Import Settings"
      subtitle="Target → Seeds → Preview → Debug"
      primaryAction={{ content: 'Save settings', onAction: onSave }}
    >
      <BlockStack gap="400">
        {/* Toasts */}
        {showAppliedToast ? (
          <Frame>
            <Toast content="Applied edited seeds" onDismiss={() => setShowAppliedToast(false)} duration={2000} />
          </Frame>
        ) : null}
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
                    if (next.length) setSelectedSeed(next[0])
                    setShowAppliedToast(true)
                  }}
                >{`Apply edits (${parseSeeds(seedsText).length})`}</Button>
                <Button
                  onClick={() => {
                    setSeedsOverride(null)
                    setSeedsText(seedsFetched.join('\n'))
                    if (seedsFetched.length) setSelectedSeed(seedsFetched[0])
                  }}
                  disabled={!seedsFetched.length}
                >{`Reset to discovered (${seedsFetched.length})`}</Button>
              </InlineStack>
              {!seedsFetched.length && !seeds.length ? (
                <Banner tone="warning" title="No seeds yet">
                  <p>Click Discover to fetch seeds, or paste URLs above and click Apply.</p>
                </Banner>
              ) : null}
              {seeds.length ? (
                <InlineStack gap="300" align="start">
                  <div style={{ minWidth: 480 }}>
                    <Select
                      label="Preview URL"
                      options={seeds.map(u => ({ label: u.length > 80 ? u.slice(0, 77) + '…' : u, value: u }))}
                      value={selectedSeed || seeds[0]}
                      onChange={setSelectedSeed}
                    />
                  </div>
                  {selectedSeed ? (
                    <a href={selectedSeed} target="_blank" rel="noreferrer">
                      <Button>Open</Button>
                    </a>
                  ) : null}
                </InlineStack>
              ) : null}
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
