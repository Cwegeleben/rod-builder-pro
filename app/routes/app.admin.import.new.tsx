// hq-run-options-scrape-preview-v1
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import { useEffect, useState } from 'react'
import { useFetcher, useLoaderData } from '@remix-run/react'
import { requireHqShopOr404 } from '../lib/access.server'
import { ImportNav } from '../components/importer/ImportNav'
import { Card, BlockStack, InlineStack, Text, TextField, Button, Checkbox, Badge } from '@shopify/polaris'
import {
  loadRunOptions,
  parseRunOptions,
  startImportFromOptions,
  type RunOptions,
} from '../services/importer/runOptions.server'
import { authenticate } from '../shopify.server'

type LoaderData = { options: RunOptions }

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const options = await loadRunOptions(null)
  return json<LoaderData>({ options })
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
  const { options: initial } = useLoaderData<typeof loader>() as LoaderData
  const [includeSeeds, setIncludeSeeds] = useState(initial.includeSeeds)
  const [manualUrls, setManualUrls] = useState((initial.manualUrls || []).join('\n'))
  const [skipSuccessful, setSkipSuccessful] = useState(initial.skipSuccessful)
  const [notes, setNotes] = useState(initial.notes || '')
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

  useEffect(() => {
    // no-op
  }, [])

  return (
    <Card>
      <BlockStack gap="300">
        <ImportNav current="runs" title="New Import" />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <BlockStack gap="200">
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
                    previewFetcher.submit(form, { method: 'post', action: '/app/admin/import/preview' })
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
                  <Button variant="primary" submit>
                    Save & Continue to Review
                  </Button>
                </previewFetcher.Form>
              </InlineStack>
            </BlockStack>
          </div>
          <div>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h3" variant="headingMd">
                  Preview
                </Text>
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
            </BlockStack>
          </div>
        </div>
      </BlockStack>
    </Card>
  )
}
