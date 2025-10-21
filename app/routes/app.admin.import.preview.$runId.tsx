// <!-- BEGIN RBP GENERATED: importer-extractor-templates-v2 -->
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import { useEffect, useMemo, useState } from 'react'
import { useFetcher, useLoaderData, useSearchParams } from '@remix-run/react'
import { Card, BlockStack, InlineStack, Text, TextField, Button, Banner } from '@shopify/polaris'
import { requireHQAccess } from '../services/auth/guards.server'
import { PreviewPane, type FieldRow } from '../components/imports/PreviewPane'
import { slugFromPath, hash as hashUrl } from '../../src/importer/extract/fallbacks'
import fs from 'fs/promises'
import path from 'path'

const TEMPLATE_PATH = 'src/importer/extract/templates/batson.product.v2.yaml'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  const runId = String(params.runId)
  const url = new URL(request.url)
  const productUrl = url.searchParams.get('url') || ''
  return json({ runId, productUrl, templatePath: TEMPLATE_PATH })
}

export async function action({ request }: ActionFunctionArgs) {
  await requireHQAccess(request)
  const fd = await request.formData()
  const intent = String(fd.get('intent') || '')
  if (intent === 'save-selector') {
    const field = String(fd.get('field') || '')
    const selector = String(fd.get('selector') || '')
    if (!field || !selector) return json({ ok: false, error: 'Missing field/selector' }, { status: 400 })
    const full = path.join(process.cwd(), TEMPLATE_PATH)
    const txt = await fs.readFile(full, 'utf8').catch(() => '')
    const lines = txt.split('\n')
    const sentinelBegin = lines.findIndex(l => l.includes('BEGIN RBP GENERATED: importer-extractor-templates-v2'))
    if (sentinelBegin === -1) return json({ ok: false, error: 'Template sentinel not found' }, { status: 500 })
    const appendBlock = `# ui: add selector\n# field: ${field}\n# selector: ${selector}`
    const nextTxt = txt + `\n` + appendBlock + `\n`
    await fs.writeFile(full, nextTxt, 'utf8')
    return json({ ok: true })
  }
  return json({ ok: false }, { status: 400 })
}

export default function ImportPreviewPage() {
  const { runId, productUrl } = useLoaderData<typeof loader>() as { runId: string; productUrl: string }
  const [params, setParams] = useSearchParams()
  const [url, setUrl] = useState(productUrl)
  const fetcher = useFetcher<{
    results: Array<{
      url: string
      externalId: string | null
      title: string | null
      images: string[]
      ok: boolean
      error?: string
    }>
  }>()
  const saveFetcher = useFetcher<{ ok?: boolean; error?: string }>()

  useEffect(() => {
    if (productUrl) setUrl(productUrl)
  }, [productUrl])

  const fields: FieldRow[] = useMemo(() => {
    const r = fetcher.data?.results?.[0]
    if (!r) return []
    const externalId = r.externalId || slugFromPath(r.url) || hashUrl(r.url)
    const idSource: 'jsonld' | 'slug' | 'hash' = r.externalId ? 'jsonld' : slugFromPath(r.url) ? 'slug' : 'hash'
    return [
      { name: 'externalId', value: externalId, source: idSource, status: r.externalId ? 'ok' : 'fallback' },
      { name: 'title', value: r.title, source: 'jsonld', status: r.title ? 'ok' : 'missing' },
      { name: 'image', value: r.images?.[0] || null, source: 'jsonld', status: r.images?.[0] ? 'ok' : 'missing' },
    ]
  }, [fetcher.data])

  const requiredMissing = fields.filter(
    f => (f.name === 'externalId' || f.name === 'title' || f.name === 'image') && !f.value,
  )

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingLg">
            Scrape Preview — Run {runId.slice(0, 8)}…
          </Text>
          <InlineStack gap="200">
            <div style={{ minWidth: 420 }}>
              <TextField
                label="URL"
                labelHidden
                value={url}
                onChange={v => setUrl(v)}
                autoComplete="off"
                placeholder="https://www.batson.com/product/…"
              />
            </div>
            <Button
              variant="primary"
              onClick={() => {
                const form = new FormData()
                form.set('urls', JSON.stringify([url]))
                fetcher.submit(form, { method: 'post', action: '/app/admin/import/preview' })
                const next = new URLSearchParams(params)
                if (url) next.set('url', url)
                else next.delete('url')
                setParams(next)
              }}
            >
              Preview
            </Button>
          </InlineStack>
        </InlineStack>
        {requiredMissing.length > 0 && (
          <Banner tone="warning" title="Required fields missing">
            Some required fields are missing. Add selectors and preview again.
          </Banner>
        )}
        <PreviewPane
          url={url}
          fields={fields}
          onSaveSelector={(name, selector) => {
            const form = new FormData()
            form.set('intent', 'save-selector')
            form.set('field', name)
            form.set('selector', selector)
            saveFetcher.submit(form, { method: 'post' })
          }}
        />
      </BlockStack>
    </Card>
  )
}
// <!-- END RBP GENERATED: importer-extractor-templates-v2 -->
