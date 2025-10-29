// hq-run-options-scrape-preview-v1
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import { useEffect, useState } from 'react'
import { useFetcher, useLoaderData } from '@remix-run/react'
import { requireHqShopOr404 } from '../lib/access.server'
import { ImportNav } from '../components/importer/ImportNav'
import { Card, BlockStack, InlineStack, Text, TextField, Button, Checkbox, Badge, Select } from '@shopify/polaris'
import {
  loadRunOptions,
  parseRunOptions,
  startImportFromOptions,
  type RunOptions,
  writeOptionsToRun,
} from '../services/importer/runOptions.server'
import { authenticate } from '../shopify.server'
// <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
import { listTemplates, type ImporterTemplate } from '../loaders/templates.server'
import { listTemplatesSummary } from '../models/specTemplate.server'
import { listScrapers, type Scraper } from '../services/importer/scrapers.server'
import { MatchFieldsPanel } from '../components/imports/MatchFieldsPanel'
import { saveRunMappingSnapshot, loadTemplateAliases } from '../models/importerMappingSnapshot.server'
// <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->

type LoaderData = {
  options: RunOptions
  runId: string
  templates: ImporterTemplate[]
  dbTemplates: Array<{ id: string; name: string }>
  scrapers: Scraper[]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId)
  const options = await loadRunOptions(runId)
  // <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
  const templates = await listTemplates()
  const dbTplSumm = await listTemplatesSummary()
  const dbTemplates = dbTplSumm.map(t => ({ id: t.id, name: t.name }))
  const scrapers = await listScrapers()
  return json<LoaderData>({ options, runId, templates, dbTemplates, scrapers })
  // <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId)
  const fd = await request.formData()
  const intent = String(fd.get('intent') || '')
  if (intent === 'save-options') {
    const options = parseRunOptions(fd)
    await writeOptionsToRun(runId, options)
    return json({ ok: true })
  }
  if (intent === 'save') {
    const options = parseRunOptions(fd)
    const { admin } = await authenticate.admin(request)
    if (options.variantTemplateId) {
      try {
        const aliases = await loadTemplateAliases(options.variantTemplateId)
        await saveRunMappingSnapshot({
          runId,
          templateId: options.variantTemplateId,
          scraperId: options.scraperId || 'jsonld-basic',
          aliases,
          axes: { o1: undefined, o2: undefined, o3: undefined },
        })
      } catch {
        // ignore snapshot errors on save
      }
    }
    const id = await startImportFromOptions(options, runId, admin)
    return redirect(`/app/admin/import/runs/${id}`)
  }
  return json({ ok: false, error: 'Unsupported intent' }, { status: 400 })
}

export default function EditImportRunPage() {
  const { options: initial, runId, templates, dbTemplates, scrapers } = useLoaderData<typeof loader>() as LoaderData
  const [includeSeeds, setIncludeSeeds] = useState(initial.includeSeeds)
  const [manualUrls, setManualUrls] = useState((initial.manualUrls || []).join('\n'))
  const [skipSuccessful, setSkipSuccessful] = useState(initial.skipSuccessful)
  const [notes, setNotes] = useState(initial.notes || '')
  // <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
  const defaultTpl = templates.find(t => t.isDefault) || templates[0]
  const [templateKey, setTemplateKey] = useState<string | undefined>(initial.templateKey || defaultTpl?.key)
  useEffect(() => {
    if (!templateKey && typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('importer.defaultTemplateKey') || ''
      if (saved) setTemplateKey(saved)
    }
  }, [])
  // Mapper + scraper selections (v2)
  const [variantTemplateId, setVariantTemplateId] = useState<string | undefined>(initial.variantTemplateId)
  const [scraperId, setScraperId] = useState<string>(initial.scraperId || 'table-grid-v1')
  // <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->
  const previewFetcher = useFetcher<{
    results: Array<{
      url: string
      externalId: string | null
      title: string | null
      images: string[]
      ok: boolean
      error?: string
    }>
  }>()
  // Mapping preview fetcher (new API)
  const mapFetcher = useFetcher<{
    items: Array<{
      title?: string | null
      sku?: string | null
      price?: number | null
      availability?: string | null
      options?: { o1?: string | null; o2?: string | null; o3?: string | null }
      attributes?: Record<string, string | string[]>
      fieldValues?: Record<string, string | number | null>
      unmatched?: Array<{ label: string; sample: string | null }>
      url: string
    }>
    templateFields?: Array<{ id: string; label: string; required: boolean }>
    errors?: Array<{ url: string; message: string }>
  }>()
  const saveFetcher = useFetcher<{ ok?: boolean }>()

  useEffect(() => {
    // no-op
  }, [])

  return (
    <Card>
      <BlockStack gap="300">
        <ImportNav current="runs" title={`Edit Run — ${runId.slice(0, 8)}…`} />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <BlockStack gap="200">
              {/* <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 --> */}
              <Select
                label="Template"
                placeholder="Select a template"
                options={templates.map(t => ({ label: `${t.name}${t.site ? ` (${t.site})` : ''}`, value: t.key }))}
                value={templateKey || ''}
                onChange={v => setTemplateKey(v || undefined)}
              />
              <Text as="p" tone="subdued" variant="bodySm">
                Templates define how fields are extracted (JSON-LD → DOM → slug → hash)
              </Text>
              {/* <!-- END RBP GENERATED: importer-templates-integration-v2-1 --> */}
              {/* Mapping Template (DB SpecTemplate) */}
              <Select
                label="Mapping Template (DB)"
                placeholder="Select a mapping template"
                options={[
                  { label: '— Select —', value: '' },
                  ...dbTemplates.map(t => ({ label: t.name, value: t.id })),
                ]}
                value={variantTemplateId || ''}
                onChange={v => setVariantTemplateId(v || undefined)}
              />
              {/* Scraper Strategy */}
              <Select
                label="Scraper Strategy"
                options={scrapers.map(s => ({ label: s.name, value: s.id }))}
                value={scraperId}
                onChange={v => setScraperId(v || 'table-grid-v1')}
              />
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
                {/* <!-- BEGIN RBP GENERATED: scrape-template-wiring-v2 --> */}
                <Button
                  onClick={() => {
                    const urls = manualUrls
                      .split(/\r?\n|,/) // CSV or newline
                      .map(s => s.trim())
                      .filter(Boolean)
                    const form = new FormData()
                    form.set('urls', JSON.stringify(urls))
                    // Ensure template is respected during preview
                    if (templateKey) form.set('templateKey', templateKey)
                    // BEGIN RBP GENERATED: admin-link-integrity-v1
                    previewFetcher.submit(form, { method: 'post', action: '/app/admin/import/preview' })
                    // END RBP GENERATED: admin-link-integrity-v1
                  }}
                >
                  Preview Scrape
                </Button>
                {/* New: Preview Mapping (v2) using zero-config mapper */}
                <Button
                  variant="primary"
                  onClick={() => {
                    const urls = manualUrls
                      .split(/\r?\n|,/) // CSV or newline
                      .map(s => s.trim())
                      .filter(Boolean)
                    const form = new FormData()
                    form.set('urls', JSON.stringify(urls))
                    form.set('scraperId', scraperId)
                    if (variantTemplateId) form.set('variantTemplateId', variantTemplateId)
                    if (includeSeeds) form.set('includeDiscovered', 'on')
                    form.set('skipSuccessful', skipSuccessful ? 'on' : '')
                    form.set('runId', runId)
                    mapFetcher.submit(form, { method: 'post', action: '/api/importer/preview' })
                  }}
                >
                  Preview Mapping (v2)
                </Button>
                {/* <!-- END RBP GENERATED: scrape-template-wiring-v2 --> */}
                <saveFetcher.Form method="post">
                  <input type="hidden" name="intent" value="save-options" />
                  <input type="hidden" name="includeSeeds" value={includeSeeds ? 'on' : ''} />
                  <input type="hidden" name="skipSuccessful" value={skipSuccessful ? 'on' : ''} />
                  <input type="hidden" name="manualUrls" value={manualUrls} />
                  <input type="hidden" name="notes" value={notes} />
                  {/* <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 --> */}
                  <input type="hidden" name="templateKey" value={templateKey || ''} />
                  {/* <!-- END RBP GENERATED: importer-templates-integration-v2-1 --> */}
                  <Button submit disabled={saveFetcher.state === 'submitting'}>
                    Save Draft
                  </Button>
                </saveFetcher.Form>
                <saveFetcher.Form method="post">
                  <input type="hidden" name="intent" value="save" />
                  <input type="hidden" name="includeSeeds" value={includeSeeds ? 'on' : ''} />
                  <input type="hidden" name="skipSuccessful" value={skipSuccessful ? 'on' : ''} />
                  <input type="hidden" name="manualUrls" value={manualUrls} />
                  <input type="hidden" name="notes" value={notes} />
                  {/* <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 --> */}
                  <input type="hidden" name="templateKey" value={templateKey || ''} />
                  {/* <!-- END RBP GENERATED: importer-templates-integration-v2-1 --> */}
                  <Button variant="primary" submit>
                    Save & Continue to Review
                  </Button>
                </saveFetcher.Form>
              </InlineStack>
            </BlockStack>
          </div>
          <div>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h3" variant="headingMd">
                  Preview
                </Text>
                {/* <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 --> */}
                {templateKey ? <Badge>{`Template: ${templateKey}`}</Badge> : null}
                {/* <!-- END RBP GENERATED: importer-templates-integration-v2-1 --> */}
                {previewFetcher.state === 'submitting' && <Badge tone="attention">Fetching…</Badge>}
              </InlineStack>
              <div className="rounded-md border border-slate-200 p-3 text-sm">
                {!previewFetcher.data?.results?.length ? (
                  <Text as="p" tone="subdued">
                    Enter some URLs and click Preview Scrape to see a quick summary.
                  </Text>
                ) : (
                  <ul className="space-y-2">
                    {previewFetcher.data.results.map(r => (
                      <li key={r.url} className="flex items-start gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded bg-slate-100">
                          {r.images?.[0] ? (
                            <img src={r.images[0]} alt="" className="h-10 w-10 object-cover" />
                          ) : (
                            <div className="h-10 w-10 bg-slate-100" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{r.title || '—'}</div>
                          <div className="text-xs text-slate-500">
                            {r.externalId || 'no id'} — {r.ok ? 'ok' : 'failed'}
                          </div>
                          <div className="max-w-[520px] truncate text-xs text-slate-500">{r.url}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Mapping Preview (v2) results */}
              <div className="rounded-md border border-indigo-200 p-3 text-sm">
                {!mapFetcher.data?.items?.length ? (
                  <Text as="p" tone="subdued">
                    Use Preview Mapping (v2) to see auto-mapped fields and unmatched labels.
                  </Text>
                ) : (
                  <div className="space-y-3">
                    <Text as="h3" variant="headingSm">
                      Mapped Preview
                    </Text>
                    <table className="min-w-full border text-xs">
                      <thead>
                        <tr>
                          <th className="border px-1">Title</th>
                          <th className="border px-1">SKU</th>
                          <th className="border px-1">Price</th>
                          <th className="border px-1">Length</th>
                          <th className="border px-1">Power</th>
                          <th className="border px-1">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mapFetcher.data.items.slice(0, 10).map((it, idx) => (
                          <tr key={`${it.url}-${idx}`} className="border-t">
                            <td className="border-r px-1">{it.title || '—'}</td>
                            <td className="border-r px-1">{it.sku || '—'}</td>
                            <td className="border-r px-1">{it.price ?? '—'}</td>
                            <td className="border-r px-1">{it.options?.o1 || '—'}</td>
                            <td className="border-r px-1">{it.options?.o2 || '—'}</td>
                            <td className="px-1">{it.options?.o3 || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Match Fields Panel for unmatched labels (first item sample) */}
                    {(() => {
                      const first = mapFetcher.data.items[0]
                      const tmps = mapFetcher.data.templateFields || []
                      if (!first?.unmatched?.length || !tmps.length) return null
                      return (
                        <MatchFieldsPanel
                          unmatched={first.unmatched}
                          templateFields={tmps.map(f => ({ key: f.id, label: f.label, required: f.required }))}
                          onApply={({ label, fieldKey, remember }) => {
                            // Re-submit with manualMappings + rememberAliases
                            const urls = manualUrls
                              .split(/\r?\n|,/) // CSV or newline
                              .map(s => s.trim())
                              .filter(Boolean)
                            const form = new FormData()
                            form.set('urls', JSON.stringify(urls))
                            form.set('scraperId', scraperId)
                            if (variantTemplateId) form.set('variantTemplateId', variantTemplateId)
                            form.set('manualMappings', JSON.stringify([{ label, fieldKey }]))
                            if (remember) form.set('rememberAliases', 'on')
                            form.set('runId', runId)
                            mapFetcher.submit(form, { method: 'post', action: '/api/importer/preview' })
                          }}
                        />
                      )
                    })()}
                  </div>
                )}
              </div>
            </BlockStack>
          </div>
        </div>
      </BlockStack>
    </Card>
  )
}
