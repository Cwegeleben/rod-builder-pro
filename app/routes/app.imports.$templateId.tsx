// <!-- BEGIN RBP GENERATED: importer-v2-3 (re-inlined) -->
// Revert composition: inline Import Settings UI back into app routes
import React from 'react'
import { useSearchParams } from '@remix-run/react'
import { importerActions } from '../../src/apps/admin.portal/app/state/importerMachine'

export default function ImportSettings() {
  const [params] = useSearchParams()
  const justCreated = params.get('created') === '1'
  // Simple discovery UI state
  const [sourceUrl, setSourceUrl] = React.useState('https://batsonenterprises.com/rod-blanks')
  const [siteId, setSiteId] = React.useState('batson-rod-blanks')
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<null | {
    usedMode?: 'static' | 'headless' | 'none'
    contentLength?: number
    textLength?: number
    pageTitle?: string
    htmlExcerpt?: string
    seeds?: Array<{ url: string }>
    siteId?: string
    model?: string
  }>(null)
  const [error, setError] = React.useState<string | null>(null)
  async function onDiscover() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/importer/crawl.discover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceUrl, siteId }),
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Discover failed: ${res.status} ${txt}`)
      }
      const json = (await res.json()) as typeof result
      setResult(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }
  async function onSave() {
    // Placeholder: assume config changed and is valid
    await importerActions.suspendScheduleOnConfigChange('DEMO-TEMPLATE')
    await importerActions.markReadyToTest('DEMO-TEMPLATE')
    alert('Saved. State moved to READY_TO_TEST')
  }
  return (
    <div>
      {justCreated ? (
        <div className="mb-3 rounded border border-green-300 bg-green-50 p-2 text-sm text-green-800">
          Import created. You can configure settings below.
        </div>
      ) : null}
      <h1>Import Settings</h1>
      <div>importer-v2-3 placeholder: General</div>
      <div>importer-v2-3 placeholder: Scrape & Mapping</div>
      <div>importer-v2-3 placeholder: Preview</div>
      {/* Minimal Discovery panel */}
      <div className="mt-4 rounded border p-3">
        <h2 className="font-semibold">Discover product series from target</h2>
        <div className="mt-2 flex flex-col gap-2">
          <label className="text-sm">
            Target site
            <select
              value={siteId}
              onChange={e => setSiteId(e.target.value)}
              className="ml-2 rounded border px-2 py-1 text-sm"
            >
              <option value="batson-rod-blanks">Batson — Rod Blanks</option>
            </select>
          </label>
          <label className="text-sm">
            Source URL
            <input
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              placeholder="https://batsonenterprises.com/rod-blanks"
              className="ml-2 w-full max-w-xl rounded border px-2 py-1 text-sm"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={onDiscover}
              disabled={loading}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              {loading ? 'Discovering…' : 'Discover'}
            </button>
            {error ? <span className="text-sm text-red-700">{error}</span> : null}
          </div>
          {result ? (
            <div className="mt-2 text-sm">
              <div className="mb-2">
                <strong>usedMode:</strong> {result.usedMode}
                {' · '}
                <strong>contentLength:</strong> {result.contentLength}
                {' · '}
                <strong>textLength:</strong> {result.textLength}
              </div>
              <div className="mb-2">
                <strong>pageTitle:</strong> {result.pageTitle}
              </div>
              <div className="mb-2">
                <strong>htmlExcerpt:</strong>
                <pre className="max-h-40 overflow-auto rounded bg-gray-50 p-2 whitespace-pre-wrap">
                  {result.htmlExcerpt}
                </pre>
              </div>
              <div className="mb-2">
                <strong>seeds ({result.seeds?.length ?? 0}):</strong>
                <ul className="mt-1 list-disc pl-5">
                  {(result.seeds || []).slice(0, 10).map(s => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                        {s.url}
                      </a>
                    </li>
                  ))}
                </ul>
                {(result.seeds?.length || 0) === 0 ? (
                  <div className="mt-1 text-amber-800">No series links found for target: Batson — Rod Blanks.</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-3">
        <button onClick={onSave} className="rounded border px-3 py-1">
          Save Settings
        </button>
      </div>
    </div>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 (re-inlined) -->
