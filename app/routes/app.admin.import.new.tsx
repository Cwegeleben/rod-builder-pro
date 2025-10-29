// hq-run-options-scrape-preview-v1
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import { useEffect, useState } from 'react'
import { useFetcher, useLoaderData } from '@remix-run/react'
import { requireHqShopOr404 } from '../lib/access.server'
import { ImportNav } from '../components/importer/ImportNav'
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Button,
  Checkbox,
  Badge,
  Select,
  DataTable,
} from '@shopify/polaris'
import {
  loadRunOptions,
  parseRunOptions,
  startImportFromOptions,
  type RunOptions,
} from '../services/importer/runOptions.server'
import { authenticate } from '../shopify.server'
// <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
import { listTemplatesSummary } from '../models/specTemplate.server'
import { listScrapers, type Scraper } from '../services/importer/scrapers.server'
import { shouldRunAutoSync, markAutoSyncRun, syncOrphanTemplates } from '../models/orphanSync.server'
// <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->

type LoaderData = {
  options: RunOptions
  variantTemplates: { id: string; name: string }[]
  scrapers: Scraper[]
  syncSummary?: { adopted: number; at: string }
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const options = await loadRunOptions(null)
  const { admin, session } = await authenticate.admin(request)
  // Optional auto-sync: keep template list fresh when user opens New Import
  let syncSummary: { adopted: number; at: string } | undefined
  try {
    const shop = (session as unknown as { shop?: string }).shop || ''
    if (shouldRunAutoSync(shop)) {
      const { adopted } = await syncOrphanTemplates(
        admin as unknown as {
          graphql: (q: string, init?: { variables?: Record<string, unknown> }) => Promise<Response>
        },
      )
      markAutoSyncRun(shop)
      if (adopted > 0) syncSummary = { adopted, at: new Date().toISOString() }
    }
  } catch {
    // ignore auto-sync errors; non-blocking
  }
  // <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
  const vtpls = await listTemplatesSummary()
  const scrapers = await listScrapers()
  return json<LoaderData>({
    options,
    variantTemplates: vtpls.map(t => ({ id: t.id, name: t.name })),
    scrapers,
    syncSummary,
  })
  // <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->
}

export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const fd = await request.formData()
  const intent = String(fd.get('intent') || '')
  if (intent !== 'save') return json({ ok: false, error: 'Unsupported intent' }, { status: 400 })
  const options = parseRunOptions(fd)
  const { admin } = await authenticate.admin(request)
  const runId = await startImportFromOptions(options, undefined, admin)
  return redirect(`/app/admin/import/runs/${runId}`)
}

export default function NewImportPage() {
  const { options: initial, variantTemplates, scrapers, syncSummary } = useLoaderData<typeof loader>() as LoaderData
  const [includeSeeds, setIncludeSeeds] = useState(initial.includeSeeds)
  const [manualUrls, setManualUrls] = useState((initial.manualUrls || []).join('\n'))
  const [skipSuccessful, setSkipSuccessful] = useState(initial.skipSuccessful)
  const [notes, setNotes] = useState(initial.notes || '')
  // hq-importer-new-import-v2
  const [variantTemplateId, setVariantTemplateId] = useState<string | undefined>(initial.variantTemplateId)
  const [scraperId, setScraperId] = useState<string | undefined>(initial.scraperId || scrapers[0]?.id)
  const previewFetcher = useFetcher<{
    items?: Array<{
      title?: string | null
      sku?: string | null
      price?: number | null
      currency?: string | null
      msrp?: number | null
      availability?: string | null
      options?: { o1?: string | null; o2?: string | null; o3?: string | null }
      images?: string[]
      attributes?: Record<string, string | string[]>
      externalId?: string | null
      url: string
      status: 'ok' | 'partial' | 'error'
      diagnostics: {
        strategy: string
        sources?: Record<string, string>
        missing?: string[]
        notes?: string[]
        mappedKeys?: Record<string, string>
      }
      raw?: { jsonld?: unknown; microdata?: unknown; domSample?: string }
      fieldValues?: Record<string, string | number | null>
    }>
    errors?: Array<{ url: string; message: string }>
    templateFields?: Array<{ id: string; label: string; required: boolean }>
  }>()

  useEffect(() => {
    if (syncSummary && syncSummary.adopted > 0) {
      try {
        const w = window as unknown as { shopifyToast?: { info?: (m: string) => void } }
        w.shopifyToast?.info?.(`Adopted ${syncSummary.adopted} orphan template${syncSummary.adopted === 1 ? '' : 's'}.`)
      } catch {
        // ignore toast errors
      }
    }
  }, [syncSummary])

  return (
    <Card>
      <BlockStack gap="300">
        <ImportNav current="runs" title="New Import" />
        <div className="grid grid-cols-2 gap-6">
          {/* Left: selectors */}
          <div>
            <BlockStack gap="200">
              {/* hq-importer-new-import-v2: Selectors */}
              <Select
                label="Variant Template"
                placeholder="Select a variant template"
                options={variantTemplates.map(t => ({ label: t.name, value: t.id }))}
                value={variantTemplateId || ''}
                onChange={v => setVariantTemplateId(v || undefined)}
              />
              <Select
                label="Scraper"
                placeholder="Select a scraper"
                options={scrapers.map(s => ({ label: s.name, value: s.id }))}
                value={scraperId || ''}
                onChange={v => setScraperId(v || undefined)}
              />
              <Text as="p" tone="subdued" variant="bodySm">
                Preview different scrapers to compare parsed results before creating a run.
              </Text>
              <Checkbox
                label="Include saved seeds"
                checked={includeSeeds}
                onChange={setIncludeSeeds}
                helpText="Include discovered and manually saved product URLs"
              />
              <TextField
                label="Manual URLs"
                value={manualUrls}
                onChange={setManualUrls}
                multiline={6}
                autoComplete="off"
                helpText="Paste product URLs (one per line or comma-separated)"
              />
              <Checkbox
                label="Skip previously successful items"
                checked={skipSuccessful}
                onChange={setSkipSuccessful}
              />
              <TextField label="Notes" value={notes} onChange={setNotes} autoComplete="off" />
              <InlineStack gap="200">
                <Button
                  onClick={() => {
                    const urls = manualUrls
                      .split(/\r?\n|,/) // CSV or newline
                      .map(s => s.trim())
                      .filter(Boolean)
                    const form = new FormData()
                    form.set('urls', JSON.stringify(urls))
                    form.set('includeDiscovered', includeSeeds ? 'on' : '')
                    if (variantTemplateId) form.set('variantTemplateId', variantTemplateId)
                    if (scraperId) form.set('scraperId', scraperId)
                    previewFetcher.submit(form, { method: 'post', action: '/api/importer/preview' })
                  }}
                >
                  Preview Scrape
                </Button>
                <previewFetcher.Form method="post">
                  <input type="hidden" name="intent" value="save" />
                  <input type="hidden" name="includeSeeds" value={includeSeeds ? 'on' : ''} />
                  <input type="hidden" name="skipSuccessful" value={skipSuccessful ? 'on' : ''} />
                  <input type="hidden" name="manualUrls" value={manualUrls} />
                  <input type="hidden" name="notes" value={notes} />
                  {/* hq-importer-new-import-v2: carry through selected ids */}
                  <input type="hidden" name="variantTemplateId" value={variantTemplateId || ''} />
                  <input type="hidden" name="scraperId" value={scraperId || ''} />
                  {/* Primary action ID for test automation */}
                  <Button variant="primary" submit data-testid="btn-new-import">
                    Save & Continue to Review
                  </Button>
                </previewFetcher.Form>
              </InlineStack>
            </BlockStack>
          </div>
          {/* Right: preview table */}
          <div>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h3" variant="headingMd">
                  Preview
                </Text>
                {variantTemplateId ? <Badge>{`Variant Template: ${variantTemplateId.slice(0, 8)}…`}</Badge> : null}
                {scraperId ? <Badge>{`Scraper: ${scraperId}`}</Badge> : null}
                {previewFetcher.state === 'submitting' && <Badge tone="attention">Fetching…</Badge>}
              </InlineStack>
              <div className="rounded-md border border-slate-200 p-3 text-sm">
                {!previewFetcher.data?.items?.length ? (
                  <BlockStack gap="150">
                    <Text as="p" tone="subdued">
                      Enter some URLs and click Preview Scrape to see parsed products. If you get zero results, try a
                      different scraper or view raw signals.
                    </Text>
                    <InlineStack gap="150">
                      <Button
                        onClick={() => {
                          setScraperId('dom-selectors-v1')
                          const urls = manualUrls
                            .split(/\r?\n|,/)
                            .map(s => s.trim())
                            .filter(Boolean)
                          const form = new FormData()
                          form.set('urls', JSON.stringify(urls))
                          form.set('includeDiscovered', includeSeeds ? 'on' : '')
                          if (variantTemplateId) form.set('variantTemplateId', variantTemplateId)
                          form.set('scraperId', 'dom-selectors-v1')
                          previewFetcher.submit(form, { method: 'post', action: '/api/importer/preview' })
                        }}
                      >
                        Try DOM selectors
                      </Button>
                      <Button
                        onClick={() => {
                          setScraperId('list-page-follow-v1')
                          const urls = manualUrls
                            .split(/\r?\n|,/)
                            .map(s => s.trim())
                            .filter(Boolean)
                          const form = new FormData()
                          form.set('urls', JSON.stringify(urls))
                          form.set('includeDiscovered', includeSeeds ? 'on' : '')
                          if (variantTemplateId) form.set('variantTemplateId', variantTemplateId)
                          form.set('scraperId', 'list-page-follow-v1')
                          previewFetcher.submit(form, { method: 'post', action: '/api/importer/preview' })
                        }}
                      >
                        Try List-page
                      </Button>
                    </InlineStack>
                  </BlockStack>
                ) : (
                  <>
                    <div className="mb-2 text-xs text-slate-600">
                      Parsed {previewFetcher.data.items.length} products using {scraperId}.
                    </div>
                    {(() => {
                      const dynamic = previewFetcher.data?.templateFields || []
                      const baseHeadings = ['Product Title', 'SKU', 'Price']
                      const dynamicHeadings = dynamic.map(f => f.label + (f.required ? ' *' : ''))
                      const tailHeadings = ['Status', 'Source URL', 'Info']
                      const headings = [...baseHeadings, ...dynamicHeadings, ...tailHeadings]

                      const columnContentTypes: ('text' | 'numeric')[] = [
                        'text', // title
                        'text', // sku
                        'numeric', // price
                        ...(dynamic.map(() => 'text') as Array<'text'>),
                        'text', // status
                        'text', // url
                        'text', // info
                      ]

                      const rows = (previewFetcher.data?.items || []).map(it => {
                        const dynVals = dynamic.map(df => {
                          const v = it.fieldValues?.[df.id]
                          if (v == null || v === '') return '—'
                          return typeof v === 'number' ? v : String(v)
                        })
                        const info = it.diagnostics
                          ? `${it.diagnostics.strategy}; missing: ${(it.diagnostics.missing || []).join(', ') || '—'}${it.availability ? `; availability: ${it.availability}` : ''}`
                          : '—'
                        const priceCell = it.price == null ? <span className="text-red-600">—</span> : it.price
                        return [it.title || '—', it.sku || '—', priceCell, ...dynVals, it.status || '—', it.url, info]
                      }) as unknown as (string | number | JSX.Element)[][]

                      return (
                        <DataTable
                          stickyHeader
                          columnContentTypes={columnContentTypes}
                          headings={headings}
                          rows={rows}
                        />
                      )
                    })()}
                  </>
                )}
              </div>
            </BlockStack>
          </div>
        </div>
      </BlockStack>
    </Card>
  )
}
