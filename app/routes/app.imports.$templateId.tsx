// <!-- BEGIN RBP GENERATED: importer-v2-3 (re-inlined) -->
// Revert composition: inline Import Settings UI back into app routes
import React from 'react'
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
  const fetcher = useFetcher<{ urls?: string[]; debug?: Record<string, unknown> }>()
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
    <div>
      {justCreated ? (
        <div className="mb-3 rounded border border-green-300 bg-green-50 p-2 text-sm text-green-800">
          Import created. You can configure settings below.
        </div>
      ) : null}
      <h1>Import Settings</h1>
      {/* Removed placeholder sections: General, Scrape & Mapping, Preview */}
      {/* <!-- BEGIN RBP GENERATED: importer-discover-unified-v1 --> */}
      <div className="mt-4 rounded border p-3">
        <h2 className="font-semibold">Discover product series from target</h2>
        <div className="mt-2 flex flex-col gap-2">
          <label className="text-sm">
            Target
            <select
              value={targetId}
              onChange={e => onTargetChange(e.target.value)}
              className="ml-2 rounded border px-2 py-1 text-sm"
            >
              <option value="" disabled>
                Select a source target
              </option>
              {KNOWN_IMPORT_TARGETS.map(t => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Source URL
            <input value={sourceUrl} disabled className="ml-2 w-full max-w-xl rounded border px-2 py-1 text-sm" />
          </label>

          <fetcher.Form method="post" action="/api/importer/crawl.discover" className="flex items-center gap-2">
            <input type="hidden" name="siteId" value={siteId} />
            <input type="hidden" name="sourceUrl" value={sourceUrl} />
            <button type="submit" className="rounded border px-3 py-1 text-sm" disabled={!siteId || !sourceUrl}>
              Discover
            </button>
          </fetcher.Form>
        </div>

        {Array.isArray(data.urls) && data.urls.length > 0 ? (
          <div className="mt-3 text-sm">
            <strong>Discovered series (seeds):</strong>
            <ul className="mt-1 list-disc pl-5">
              {data.urls.map((u: string) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded border p-3">
        <h2 className="font-semibold">Debug details</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <strong>Site</strong>: {safe.siteId}
          </div>
          <div>
            <strong>Status</strong>: {String(safe.status)}
          </div>
          <div>
            <strong>Used mode</strong>: {safe.usedMode}
          </div>
          <div>
            <strong>Page title</strong>: {safe.pageTitle}
          </div>
          <div>
            <strong>Content-Length</strong>: {safe.contentLength}
          </div>
          <div>
            <strong>Text-Length</strong>: {safe.textLength}
          </div>
          <div>
            <strong>Strategy used</strong>: {safe.strategyUsed}
          </div>
          <div>
            <strong>Headless</strong>: attempted={String(safe.headless.attempted)} available=
            {String(safe.headless.available)} {safe.headless.error ? `error=${safe.headless.error}` : ''}
          </div>
        </div>
        <div className="mt-2 text-sm">
          <strong>Sample</strong>:
          <pre className="max-h-40 overflow-auto rounded bg-gray-50 p-2 whitespace-pre-wrap">
            {safe.sample.slice(0, 5).join('\n')}
          </pre>
        </div>
        <details className="mt-2">
          <summary>HTML excerpt (first ~600 chars)</summary>
          <pre className="max-h-60 overflow-auto rounded bg-gray-50 p-2 whitespace-pre-wrap">{safe.htmlExcerpt}</pre>
        </details>
        <details className="mt-2">
          <summary>Notes</summary>
          <ul className="mt-1 list-disc pl-5">
            {safe.notes.map((n: string, i: number) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      </div>
      {/* <!-- END RBP GENERATED: importer-discover-unified-v1 --> */}
      <div className="mt-3">
        <button onClick={onSave} className="rounded border px-3 py-1">
          Save Settings
        </button>
      </div>
    </div>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 (re-inlined) -->
