// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
// Import Settings page with server-backed loader/action.
// Shows General section (name) and allows marking template READY_TO_TEST.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { Form, useLoaderData, useNavigation, useSearchParams, useLocation, Link } from '@remix-run/react'
// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
import { SettingsPreview } from '../components/importer/SettingsPreview'
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
import { useState, useRef, useEffect } from 'react'
// <!-- BEGIN RBP GENERATED: hq-imports-polaris-v1 -->
import { Card, BlockStack, InlineStack, Text, Button, TextField, Banner, DataTable } from '@shopify/polaris'
// <!-- END RBP GENERATED: hq-imports-polaris-v1 -->
import { requireHqShopOr404 } from '../lib/access.server'

type LoaderData = {
  id: string
  name: string
  state: string
  importConfig: {
    seedUrls: string[]
    vendor?: string
  }
  preview?: {
    runId: string
    discovered: number
    products: { total: number; ok: number; partial: number; errors: number }
    at: string
    fieldSamples?: Record<string, string>
  }
  templateFields?: Array<{
    id: string
    key: string
    label: string
    type: 'text' | 'number' | 'boolean' | 'select'
    required: boolean
    storage: 'CORE' | 'METAFIELD'
  }>
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const id = String(params.templateId || '')
  if (!id) throw new Response('Not Found', { status: 404 })
  const { prisma } = await import('../db.server')
  const row = await (prisma as any).importTemplate.findUnique({ where: { id } })
  if (!row) throw new Response('Not Found', { status: 404 })
  const cfgRaw = (row as any).importConfig ?? {}
  const cfg = typeof cfgRaw === 'object' && cfgRaw ? cfgRaw : {}
  const seedUrls = Array.isArray((cfg as any).seedUrls)
    ? (cfg as any).seedUrls.filter((s: unknown) => typeof s === 'string')
    : []
  const vendor = typeof (cfg as any).vendor === 'string' ? (cfg as any).vendor : undefined
  // <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
  // Restore deterministic fields for UI initialization
  const sourceUrlCfg = typeof (cfg as any).sourceUrl === 'string' ? (cfg as any).sourceUrl : undefined
  // <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
  // Fetch last preview/test summary if any
  const lastPreview = await (prisma as any).importLog
    .findFirst({
      where: { templateId: id, type: 'TEST_SUMMARY' },
      orderBy: { at: 'desc' },
      select: { runId: true, payload: true, at: true },
    })
    .catch(() => null)
  // Load template fields for this import (1:1 with Spec Template)
  const fields = await (prisma as any).specField
    .findMany({
      where: { templateId: id },
      orderBy: { position: 'asc' },
      select: { id: true, key: true, label: true, type: true, required: true, storage: true },
    })
    .catch(() => [])
  let preview: LoaderData['preview'] | undefined
  if (lastPreview && lastPreview.payload) {
    try {
      const p = lastPreview.payload as any
      preview = {
        runId: String(lastPreview.runId || ''),
        discovered: Number(p.discovered || p.products?.total || 0),
        products: {
          total: Number(p.products?.total || p.discovered || 0),
          ok: Number(p.products?.ok || 0),
          partial: Number(p.products?.partial || 0),
          errors: Number(p.products?.errors || 0),
        },
        at: new Date(lastPreview.at as Date).toISOString(),
        fieldSamples: ((): Record<string, string> | undefined => {
          const fs = p.fieldSamples
          if (fs && typeof fs === 'object') {
            const out: Record<string, string> = {}
            for (const [k, v] of Object.entries(fs as Record<string, unknown>)) {
              if (typeof v === 'string') out[k] = v
            }
            return out
          }
          return undefined
        })(),
      }
    } catch {
      // ignore parse errors
    }
  }
  return json<LoaderData>({
    id: row.id,
    name: row.name ?? row.id,
    state: row.state ?? 'NEEDS_SETTINGS',
    importConfig: {
      seedUrls,
      vendor,
      // <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
      ...(sourceUrlCfg ? { sourceUrl: sourceUrlCfg } : {}),
      // <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
    },
    preview,
    templateFields: Array.isArray(fields) ? fields : [],
  })
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const id = String(params.templateId || '')
  if (!id) return json({ error: 'Missing id' }, { status: 400 })
  const form = await request.formData()
  const intent = String(form.get('intent') || 'save')
  const name = String(form.get('name') || '').trim()
  const { prisma } = await import('../db.server')
  const data: Record<string, unknown> = {}

  if (intent === 'save' || intent === 'saveAndReady') {
    if (name) data.name = name
    // Note: validation/test-run now driven from Preview; keep state unchanged here
  }

  if (intent === 'saveConfig') {
    // Build importConfig from form fields
    const seedUrlsRaw = String(form.get('seedUrls') || '')
    // <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
    const sourceUrl = String(form.get('sourceUrl') || '').trim()
    // <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
    const vendor = String(form.get('vendor') || '').trim()
    const seedUrls = seedUrlsRaw
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0)

    try {
      // Read current config to merge
      const current = await (prisma as any).importTemplate.findUnique({
        where: { id },
        select: { importConfig: true, state: true },
      })
      const existing =
        current?.importConfig && typeof current.importConfig === 'object' ? (current.importConfig as any) : {}
      const nextConfig = {
        ...existing,
        seedUrls,
        ...(vendor ? { vendor } : { vendor: undefined }),
        // <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
        ...(sourceUrl ? { sourceUrl } : {}),
        // options now resolved by site config registry; nothing else persisted
        // <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
      }
      data.importConfig = nextConfig
      // Invalidate validation if settings changed and was previously validated/approved/scheduled
      const prevState = String(current?.state || '')
      if (['READY_TO_APPROVE', 'APPROVED', 'SCHEDULED', 'IN_TEST', 'FAILED'].includes(prevState)) {
        data.state = 'NEEDS_SETTINGS'
      }
    } catch (e) {
      const message = (e as Error)?.message || 'Failed to read current config'
      return json({ error: message }, { status: 400 })
    }
  }

  if (intent === 'saveAll') {
    // Consolidated save: name + importConfig in one go
    const seedUrlsRaw = String(form.get('seedUrls') || '')
    // <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
    const sourceUrl = String(form.get('sourceUrl') || '').trim()
    // <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
    const vendor = String(form.get('vendor') || '').trim()
    const seedUrls = seedUrlsRaw
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0)

    try {
      const current = await (prisma as any).importTemplate.findUnique({
        where: { id },
        select: { importConfig: true, state: true },
      })
      const existing =
        current?.importConfig && typeof current.importConfig === 'object' ? (current.importConfig as any) : {}
      const nextConfig = {
        ...existing,
        seedUrls,
        ...(vendor ? { vendor } : { vendor: undefined }),
        // <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
        ...(sourceUrl ? { sourceUrl } : {}),
        // options now resolved by site config registry; nothing else persisted
        // <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
      }
      if (name) data.name = name
      data.importConfig = nextConfig
      // Invalidate and re-validate config: if previously validated/approved/scheduled, require fresh validation
      const prevState = String(current?.state || '')
      const hasBasicConfig = seedUrls.length > 0
      if (['READY_TO_APPROVE', 'APPROVED', 'SCHEDULED', 'IN_TEST', 'FAILED'].includes(prevState)) {
        data.state = hasBasicConfig ? 'READY_TO_TEST' : 'NEEDS_SETTINGS'
      } else if (prevState === 'NEEDS_SETTINGS' && hasBasicConfig) {
        // Fresh config becomes READY_TO_TEST on save per design
        data.state = 'READY_TO_TEST'
      }
    } catch (e) {
      const message = (e as Error)?.message || 'Failed to read current config'
      return json({ error: message }, { status: 400 })
    }
  }

  if (intent === 'validate') {
    // Minimal validation: ensure we have at least one seed URL; mark READY_TO_TEST and return to list
    try {
      const row = await (prisma as any).importTemplate.findUnique({ where: { id }, select: { importConfig: true } })
      const cfg = row?.importConfig && typeof row.importConfig === 'object' ? (row.importConfig as any) : {}
      const urls: string[] = Array.isArray(cfg.seedUrls)
        ? cfg.seedUrls.filter((s: unknown) => typeof s === 'string')
        : []
      if (!urls.length) return json({ error: 'Add at least one Seed URL before validating.' }, { status: 400 })
      await (prisma as any).importTemplate.update({ where: { id }, data: { state: 'READY_TO_TEST' } })
      const url = new URL(request.url)
      const sp = url.searchParams
      sp.set('validated', '1')
      return redirect(`/app/imports?${sp.toString()}`)
    } catch (e) {
      const message = (e as Error)?.message || 'Validation failed'
      return json({ error: message }, { status: 400 })
    }
  }
  if (intent === 'runTest') {
    // Real crawl summary: use Seeds (series URLs) or discover from Source URL, then parse up to 10 products and persist counts
    try {
      const row = await (prisma as any).importTemplate.findUnique({ where: { id }, select: { importConfig: true } })
      const cfg = row?.importConfig && typeof row.importConfig === 'object' ? (row.importConfig as any) : {}
      const seedUrls: string[] = Array.isArray(cfg.seedUrls)
        ? cfg.seedUrls.filter((s: unknown) => typeof s === 'string')
        : []
      const sourceUrlCfg = typeof cfg.sourceUrl === 'string' ? (cfg.sourceUrl as string) : ''
      // const strategyCfg = (cfg.strategy as 'static' | 'headless' | 'hybrid') || 'hybrid' // reserved for diagnostics

      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      }
      const base = 'https://batsonenterprises.com'
      let seriesList: string[] = [...seedUrls]
      // If no seeds, attempt listing discovery from sourceUrl
      if (!seriesList.length && sourceUrlCfg) {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 8000)
        try {
          const r = await fetch(sourceUrlCfg, { headers, signal: ctrl.signal })
          if (r.ok) {
            const html = await r.text()
            try {
              const { crawlBatsonRodBlanksListing } = await import('../server/importer/crawlers/batsonListing')
              seriesList = crawlBatsonRodBlanksListing(html, base)
            } catch {
              /* ignore */
            }
          }
        } finally {
          clearTimeout(timer)
        }
      }
      if (!seriesList.length) {
        const url = new URL(request.url)
        const sp = url.searchParams
        sp.set('tested', '0')
        sp.set('error', 'No series URLs available. Run Discover or add Seeds first.')
        return redirect(`/app/imports/${id}?${sp.toString()}`)
      }
      const seriesTotal = seriesList.length
      // Resolve product scrape type from site config (file-driven)
      let st: 'auto' | 'batson-attribute-grid' = 'auto'
      try {
        const { getSiteConfigForUrl } = await import('../server/importer/sites')
        const urlForCfg = seriesList[0] || sourceUrlCfg
        if (urlForCfg) st = getSiteConfigForUrl(urlForCfg).products.scrapeType
      } catch {
        /* default stays 'auto' */
      }
      const limitProducts = 10
      let productsTotal = 0
      let ok = 0
      let partial = 0
      let errors = 0
      let visited = 0
      for (const su of seriesList) {
        if (productsTotal >= limitProducts) break
        const u = su.trim()
        if (!u) continue
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 8000)
        try {
          const r = await fetch(u, { headers, signal: ctrl.signal })
          if (!r.ok) {
            errors++
            continue
          }
          const html = await r.text()
          let rows: Array<{ title?: string | null; price?: number | null; url: string }>
          if (st === 'batson-attribute-grid') {
            const mod = await import('../server/importer/preview/parsers/batsonAttributeGrid')
            const ps = mod.extractBatsonAttributeGrid(html, base)
            rows = ps.map(p => ({ title: p.title || null, price: p.price ?? null, url: p.url }))
          } else {
            const { extractSeriesProducts } = await import('../server/importer/preview/seriesProducts')
            const ps = extractSeriesProducts(html, base)
            rows = ps.map(p => ({ title: p.title || null, price: p.price ?? null, url: p.url }))
          }
          for (const it of rows) {
            if (productsTotal >= limitProducts) break
            productsTotal++
            if (it.title && typeof it.price === 'number') ok++
            else partial++
          }
          visited++
        } catch {
          errors++
        } finally {
          clearTimeout(timer)
        }
      }
      // Persist summary
      const { randomUUID } = await import('node:crypto')
      const runId = `test-${randomUUID()}`
      await (prisma as any).importLog.create({
        data: {
          templateId: id,
          runId,
          type: 'TEST_SUMMARY',
          payload: {
            seedUrls: seriesList,
            discovered: seriesTotal,
            products: { total: productsTotal, ok, partial, errors },
            meta: { seriesVisited: visited },
          },
        },
      })
      await (prisma as any).importTemplate.update({
        where: { id },
        data: { state: 'READY_TO_APPROVE', lastRunAt: new Date(), hadFailures: errors > 0 },
      })
      const url = new URL(request.url)
      const sp = url.searchParams
      sp.set('tested', '1')
      return redirect(`/app/imports/${id}?${sp.toString()}`)
    } catch (e) {
      const message = (e as Error)?.message || 'Test run failed'
      return json({ error: message }, { status: 400 })
    }
  }
  try {
    if (Object.keys(data).length) {
      await (prisma as any).importTemplate.update({ where: { id }, data })
    }
  } catch (err) {
    const message = (err as Error)?.message || 'Failed to save settings'
    return json({ error: message }, { status: 400 })
  }
  const url = new URL(request.url)
  const sp = url.searchParams
  sp.set('saved', '1')
  return redirect(`/app/imports/${id}?${sp.toString()}`)
}

export default function ImportsTemplateSettings() {
  const data = useLoaderData<typeof loader>() as LoaderData
  const nav = useNavigation()
  const [params] = useSearchParams()
  const location = useLocation()
  // Legacy previewFetcher removed in favor of explicit Discover + Crawl buttons
  // <!-- BEGIN RBP GENERATED: hq-imports-polaris-v1 -->
  // Seed URLs visible text (Polaris TextField) mirrored into hidden textarea for POST
  const initialSeedText = (data.importConfig.seedUrls || []).join('\n')
  const [seedText] = useState<string>(initialSeedText)
  const [nameText, setNameText] = useState<string>(data.name || '')
  const [vendorText, setVendorText] = useState<string>(data.importConfig.vendor || '')
  const formRef = useRef<HTMLFormElement | null>(null)
  // <!-- END RBP GENERATED: hq-imports-polaris-v1 -->
  // <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
  // Deterministic controls state
  const [sourceUrlInput, setSourceUrlInput] = useState<string>(() => {
    try {
      // restore from persisted config if present
      const anyCfg = (data as any)?.importConfig as { sourceUrl?: string }
      return anyCfg?.sourceUrl && typeof anyCfg.sourceUrl === 'string' ? anyCfg.sourceUrl : ''
    } catch {
      return ''
    }
  })
  // Options are site-configured; no client state for discovery/scrape models
  const batsonBase = 'https://batsonenterprises.com'
  // Discover → Seed URLs banners and control state
  const [seedUrlsText, setSeedUrlsText] = useState<string>(initialSeedText)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [crawlError, setCrawlError] = useState<string | null>(null)
  const [crawlInfo, setCrawlInfo] = useState<string | null>(null)
  const [crawlDebug, setCrawlDebug] = useState<Record<string, unknown> | null>(null)
  // Always capture raw HTML diagnostics for discover/preview requests
  const devSampleHtml = true
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewData, setPreviewData] = useState<{ products: any[]; mappingPreview: any[]; meta: any } | null>(null)
  const [crawlInfoProducts, setCrawlInfoProducts] = useState<string | null>(null)
  // Auto-dismiss success banner for newly created import (client-side only)
  const [showImportCreated, setShowImportCreated] = useState<boolean>(() => {
    try {
      return new URLSearchParams(location.search).get('created') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    if (!showImportCreated) return
    const t = setTimeout(() => setShowImportCreated(false), 30000)
    return () => clearTimeout(t)
  }, [showImportCreated])
  // Sync legacy seedText state into new seedUrlsText on mount to keep lints happy and values aligned
  useEffect(() => {
    try {
      if (seedText !== seedUrlsText) {
        setSeedUrlsText(seedText)
        const el = seedRef.current
        if (el) {
          el.value = seedText
        }
      }
    } catch {
      /* ignore */
    }
    // run once on mount
  }, [])

  async function onDiscoverSeries() {
    setCrawlError(null)
    setCrawlInfo(null)
    setCrawlDebug(null)
    setIsDiscovering(true)
    try {
      // Unified discover: run exactly on the provided source URL (required)
      let src = sourceUrlInput.trim()
      if (!src) {
        setCrawlError('Source URL is required.')
        return
      }
      if (src && !/^https?:\/\//i.test(src)) {
        src = src.startsWith('/') ? `${batsonBase}${src}` : `${batsonBase}/${src}`
      }
      // Remix route naming: file api.importer.crawl.discover -> path /api/importer/crawl/discover
      const res = await fetch('/api/importer/crawl/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl: src, devSampleHtml }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        urls?: string[]
        error?: string
        debug?: Record<string, unknown>
        count?: number
      }
      if (!data?.debug) {
        try {
          const ct = res.headers.get('content-type') || undefined
          setCrawlDebug({ status: res.status, contentType: ct, note: 'client-fallback-diagnostics' } as any)
        } catch {
          /* ignore */
        }
      }
      const urls = Array.isArray(data?.urls) ? (data!.urls as string[]) : []
      // Treat API error field as failure even if status is 200
      if (!res.ok || data?.error) {
        setCrawlError(`Crawl failed. ${data?.error ?? ''}`.trim())
        setCrawlDebug((data as any)?.debug ?? null)
        return
      }
      if (urls.length === 0) {
        setCrawlError('No series links found at Blanks by series.')
        setCrawlDebug((data as any)?.debug ?? null)
        return
      }
      // Success: replace Seed URLs (newline-separated)
      const all = Array.from(new Set(urls))
      const next = all.join('\n')
      setSeedUrlsText(next)
      setSeedsDirty(next !== initialSeedText)
      try {
        const el = seedRef.current
        if (el) {
          el.value = next
        }
      } catch {
        /* ignore */
      }
      setCrawlInfo(`Discovered ${data?.count ?? urls.length} links.`)
    } catch (e: any) {
      setCrawlError(`Network error while crawling. ${String(e?.message || e)}`)
    } finally {
      setIsDiscovering(false)
    }
  }

  async function onCrawlProducts() {
    setCrawlError(null)
    setCrawlInfo(null)
    setCrawlDebug(null)
    setIsPreviewing(true)
    setCrawlInfoProducts(null)
    setPreviewData(null)
    try {
      // Collect series URLs from the Seeds textarea
      const list = (seedUrlsText || '')
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean)
      const payload: Record<string, unknown> = {
        templateId: data.id,
        mode: 'series-products',
        seriesUrls: list,
        devSampleHtml,
      }
      // If no seeds yet, include sourceUrl so server can discover on the fly
      let src = sourceUrlInput.trim()
      if (src && !/^https?:\/\//i.test(src)) src = src.startsWith('/') ? `${batsonBase}${src}` : `${batsonBase}/${src}`
      if (!list.length && src) payload.sourceUrl = src
      const res = await fetch('/api/importer/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const js = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCrawlError('Products crawl failed.')
        setCrawlDebug(js?.meta || js?.debug || null)
        return
      }
      setPreviewData(js)
      const count = Number(js?.meta?.count ?? js?.products?.length ?? 0)
      const seriesTotal = Number(js?.meta?.seriesTotal ?? 0)
      const seriesVisited = Number(js?.meta?.seriesVisited ?? 0)
      setCrawlInfoProducts(`Crawled ${count} products (max 10) from ${seriesVisited}/${seriesTotal} series.`)
    } catch (e: any) {
      setCrawlError(`Network error during products crawl. ${String(e?.message || e)}`)
    } finally {
      setIsPreviewing(false)
    }
  }
  // <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
  const created = params.get('created') === '1'
  const saved = params.get('saved') === '1'
  const tested = params.get('tested') === '1'
  const err = params.get('error')
  const busy = nav.state !== 'idle'
  const [nameDirty, setNameDirty] = useState(false)
  const [vendorDirty, setVendorDirty] = useState(false)
  const [seedsDirty, setSeedsDirty] = useState(false)
  const seedRef = useRef<HTMLTextAreaElement | null>(null)
  const anythingDirty = !!(nameDirty || vendorDirty || seedsDirty)
  const isValidated = data.state === 'READY_TO_APPROVE'
  // Legacy first-URL auto-preview removed
  return (
    <div>
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingLg">
              Import settings
            </Text>
            <InlineStack gap="200">
              <Link to={`/app/imports${location.search}`}>Back to Imports</Link>
              {(() => {
                try {
                  const next = `/app/imports/${data.id}${location.search}`
                  const editUrl = `/app/products/templates/${data.id}?next=${encodeURIComponent(next)}`
                  return <Link to={editUrl}>Edit template</Link>
                } catch {
                  return null
                }
              })()}
            </InlineStack>
          </InlineStack>
          {created ? (
            <Banner tone="success" title="Import created">
              You can configure settings below.
            </Banner>
          ) : null}
          {saved ? <Banner tone="success" title="Settings saved" /> : null}
          {tested ? (
            <Banner tone="info" title="Test run completed">
              Preview updated below.
            </Banner>
          ) : null}
          {err ? (
            <Banner tone="warning" title="Attention">
              {err}
            </Banner>
          ) : null}
          <Form method="post" ref={formRef as any}>
            <BlockStack gap="300">
              <InlineStack gap="400">
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Name"
                    value={nameText}
                    onChange={v => {
                      setNameText(v)
                      setNameDirty(v.trim() !== (data.name || '').trim())
                    }}
                    autoComplete="off"
                  />
                  <input type="hidden" id="name-hidden" name="name" value={nameText} />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Vendor (optional)"
                    value={vendorText}
                    onChange={v => {
                      setVendorText(v)
                      setVendorDirty(v.trim() !== (data.importConfig.vendor || '').trim())
                    }}
                    placeholder="e.g. Batson Enterprises"
                    autoComplete="off"
                    helpText="Used as a hint in discovery/mapping."
                  />
                  <input type="hidden" id="vendor-hidden" name="vendor" value={vendorText} />
                </div>
              </InlineStack>
              {/* Crawler controls and Seed URLs inside a single visual card */}
              {/* <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 --> */}
              <Card>
                <BlockStack gap="400">
                  <TextField
                    label="Source URL"
                    value={sourceUrlInput}
                    onChange={setSourceUrlInput}
                    autoComplete="off"
                    placeholder="https://batsonenterprises.com/rod-blanks"
                    helpText="Required for Discover and Preview."
                  />
                  {showImportCreated ? (
                    <Banner tone="success" title="Import created" onDismiss={() => setShowImportCreated(false)}>
                      <p>You can configure settings below.</p>
                    </Banner>
                  ) : null}
                  {crawlInfo ? (
                    <Banner tone="success" title="Series discovered" onDismiss={() => setCrawlInfo(null)}>
                      <p>{crawlInfo}</p>
                    </Banner>
                  ) : null}
                  {crawlError ? (
                    <Banner
                      tone="critical"
                      title="Series discovery issue"
                      onDismiss={() => {
                        setCrawlError(null)
                        setCrawlDebug(null)
                      }}
                    >
                      <p>{crawlError}</p>
                      <div style={{ marginTop: 8 }}>
                        <details>
                          <summary>Debug details</summary>
                          {(() => {
                            // <!-- BEGIN RBP GENERATED: importer-discover-batson-series-v1 -->
                            const d = (
                              crawlDebug && typeof crawlDebug === 'object'
                                ? (crawlDebug as Record<string, unknown>)
                                : {
                                    siteId: 'unknown',
                                    usedMode: 'unknown',
                                    strategyUsed: 'n/a',
                                    totalFound: 0,
                                    deduped: 0,
                                    sample: [],
                                    notes: [
                                      '(synthesized) No server diagnostics; check route wiring or inspect /api/importer/crawl/discover response.',
                                    ],
                                  }
                            ) as Record<string, unknown>
                            const rows: Array<[string, string]> = []
                            if (typeof d.startUrl === 'string') rows.push(['Start URL', d.startUrl])
                            if (typeof d.pageTitle === 'string') rows.push(['Page title', d.pageTitle])
                            if (typeof d.status !== 'undefined') rows.push(['Status', String(d.status)])
                            if (typeof d.contentType === 'string') rows.push(['Content-Type', d.contentType])
                            if (typeof d.contentLength === 'string') rows.push(['Content-Length', d.contentLength])
                            if (typeof d.got === 'string') rows.push(['Provided startUrl', d.got])
                            return (
                              <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.4 }}>
                                <ul style={{ paddingLeft: 16 }}>
                                  {rows.map(([k, v]) => (
                                    <li key={k}>
                                      <strong>{k}:</strong> {v}
                                    </li>
                                  ))}
                                </ul>
                                {(() => {
                                  const excerpt =
                                    typeof d.htmlExcerpt === 'string' ? (d.htmlExcerpt as string) : undefined
                                  if (excerpt) {
                                    return (
                                      <>
                                        <div style={{ marginTop: 6 }}>
                                          <strong>HTML excerpt (first 4k chars):</strong>
                                        </div>
                                        <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>
                                          {excerpt}
                                        </pre>
                                      </>
                                    )
                                  }
                                  return <p style={{ marginTop: 6 }}>No HTML excerpt available.</p>
                                })()}
                              </div>
                            )
                            // <!-- END RBP GENERATED: importer-discover-batson-series-v1 -->
                          })()}
                        </details>
                      </div>
                    </Banner>
                  ) : null}
                  {/* Scrape options hidden (site-config driven) */}
                  {/* Action rows positioned next to their instructions */}
                  <InlineStack gap="300" blockAlign="center">
                    <Text as="p" variant="bodySm">
                      Discover series from the Source URL and populate Seeds.
                    </Text>
                    <Button onClick={onDiscoverSeries} loading={isDiscovering} variant="primary">
                      Discover
                    </Button>
                  </InlineStack>
                  <InlineStack gap="300" blockAlign="center">
                    <Text as="p" variant="bodySm">
                      Crawl products (max 10) from Seeds or from discovered series for mapping preview.
                    </Text>
                    <Button onClick={onCrawlProducts} loading={isPreviewing}>
                      Crawl products (max 10)
                    </Button>
                  </InlineStack>
                  <Text tone="subdued" as="p" variant="bodySm">
                    Discovered series URLs are auto-added to Seeds below. You can edit before saving.
                  </Text>
                  {/* Hidden textarea for form submit; keep DOM id for programmatic updates */}
                  <textarea
                    id="seedUrls"
                    name="seedUrls"
                    ref={seedRef}
                    value={seedUrlsText}
                    readOnly
                    style={{ display: 'none' }}
                  />
                  {/* Persist deterministic settings on Save */}
                  <input type="hidden" name="sourceUrl" value={sourceUrlInput} />
                  <TextField
                    label="Seed URLs"
                    value={seedUrlsText}
                    onChange={v => {
                      setSeedUrlsText(v)
                      setSeedsDirty(v !== initialSeedText)
                      try {
                        const el = seedRef.current
                        if (el) {
                          el.value = v
                        }
                      } catch {
                        /* ignore */
                      }
                    }}
                    multiline={6}
                    autoComplete="off"
                    helpText="One URL per line. Discover Series will append all found series URLs here."
                  />
                  {/* Inline series/product output (products + meta) */}
                  {crawlInfoProducts ? (
                    <Banner tone="success" title="Products crawled" onDismiss={() => setCrawlInfoProducts(null)}>
                      <p>{crawlInfoProducts}</p>
                    </Banner>
                  ) : null}
                  {previewData ? (
                    <div>
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h3" variant="headingMd">
                          Products
                        </Text>
                        <Text as="span" tone="subdued" variant="bodySm">
                          {(() => {
                            const m = previewData?.meta || {}
                            const used = typeof m?.urlUsed === 'string' ? m.urlUsed : undefined
                            const followed = typeof m?.followed === 'string' ? m.followed : undefined
                            const count = typeof m?.count === 'number' ? m.count : (previewData?.products?.length ?? 0)
                            const seriesTotal = typeof m?.seriesTotal === 'number' ? m.seriesTotal : undefined
                            const seriesVisited = typeof m?.seriesVisited === 'number' ? m.seriesVisited : undefined
                            return (
                              <>
                                {used ? (
                                  <span>
                                    URL: <span className="font-mono">{used}</span>
                                  </span>
                                ) : null}
                                {followed ? (
                                  <span>
                                    {' '}
                                    • Followed: <span className="font-mono">{followed}</span>
                                  </span>
                                ) : null}
                                <span>
                                  {' '}
                                  • Products: <strong>{count}</strong>
                                </span>
                                {typeof seriesTotal !== 'undefined' ? (
                                  <span>
                                    {' '}
                                    • Series:{' '}
                                    <strong>
                                      {seriesVisited ?? 0}/{seriesTotal}
                                    </strong>
                                  </span>
                                ) : null}
                              </>
                            )
                          })()}
                        </Text>
                      </InlineStack>
                      {(() => {
                        const pid = (previewData as any)?.meta?.parserId as string | undefined
                        const site = (previewData as any)?.meta?.siteTag as string | undefined
                        if (!pid) return null
                        return (
                          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                            Parser: {pid} • Site: {site || 'n/a'}
                          </div>
                        )
                      })()}
                      {(() => {
                        try {
                          const rows = (previewData?.products || []).slice(0, 12).map((p: any, i: number) => [
                            p.title || '—',
                            <a
                              key={`u-${i}`}
                              href={p.url}
                              target="_blank"
                              rel="noreferrer"
                              className="max-w-[520px] truncate text-blue-700 underline"
                              title={p.url}
                            >
                              {p.url}
                            </a>,
                            typeof p.price === 'number' ? `$${p.price.toFixed(2)}` : '—',
                            p.status || '—',
                          ]) as unknown as (string | number | JSX.Element)[][]
                          return (
                            <div className="mt-2">
                              <DataTable
                                columnContentTypes={['text', 'text', 'text', 'text']}
                                headings={['Title', 'URL', 'Price', 'Status']}
                                rows={rows}
                              />
                            </div>
                          )
                        } catch {
                          return null
                        }
                      })()}
                      {/* Mapping preview (Template-driven) */}
                      <div className="mt-4">
                        <SettingsPreview
                          products={previewData?.products ?? []}
                          mappingPreview={previewData?.mappingPreview ?? []}
                          isLoading={false}
                          error={undefined as any}
                        />
                      </div>
                      {/* Coverage footer */}
                      {(() => {
                        try {
                          const missing: string[] = Array.isArray((previewData as any)?.meta?.missingFields)
                            ? ((previewData as any).meta.missingFields as string[])
                            : []
                          const total = Array.isArray(data.templateFields) ? data.templateFields.length : 0
                          const mapped = total > 0 ? Math.max(0, total - missing.length) : 0
                          if (!total) return null
                          const labelByKey = new Map<string, string>()
                          for (const f of data.templateFields || []) labelByKey.set(f.key, f.label)
                          return (
                            <div className="mt-2 text-xs text-slate-700">
                              <div>
                                Coverage:{' '}
                                <strong>
                                  {mapped}/{total}
                                </strong>{' '}
                                fields mapped
                              </div>
                              {missing.length ? (
                                <div className="mt-1">
                                  <div className="text-slate-500">Missing fields:</div>
                                  <ul className="ml-4 list-disc">
                                    {missing.map(k => (
                                      <li key={k}>
                                        <span className="font-mono">{k}</span>
                                        {labelByKey.get(k) ? <span> — {labelByKey.get(k)}</span> : null}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          )
                        } catch {
                          return null
                        }
                      })()}
                    </div>
                  ) : null}
                </BlockStack>
              </Card>
              {/* <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 --> */}
              <input type="hidden" id="intent-input" name="intent" value="" />
              <InlineStack gap="200">
                <Button
                  variant="primary"
                  loading={busy}
                  disabled={!anythingDirty}
                  onClick={() => {
                    try {
                      const inp = document.getElementById('intent-input') as HTMLInputElement | null
                      if (inp) inp.value = 'saveAll'
                      formRef.current?.requestSubmit()
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  Save
                </Button>
                <Button
                  loading={busy}
                  onClick={() => {
                    try {
                      const inp = document.getElementById('intent-input') as HTMLInputElement | null
                      if (inp) inp.value = 'validate'
                      formRef.current?.requestSubmit()
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  {isValidated ? 'Valid' : 'Validate'}
                </Button>
                <Button url={`/app/imports${location.search}`}>Close</Button>
              </InlineStack>
            </BlockStack>
          </Form>
        </BlockStack>
      </Card>
      {/* Last run section removed: we’ll show results inline in the main card (Discover + Crawl products area) */}
    </div>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
