// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import { useState } from 'react'

interface PreviewItem {
  dedupeKey: string
  action: string
  mapped: { title?: string; price?: number; vendor?: string; sku?: string }
  warnings: string[]
}

export function ImportWizard() {
  const [step, setStep] = useState(0)
  const [url, setUrl] = useState('')
  const [productType, setProductType] = useState('')
  const [mappingJson, setMappingJson] = useState('{}')
  const [preview, setPreview] = useState<PreviewItem[] | null>(null)
  const [hqError, setHqError] = useState<string | null>(null)
  // Note: reserved for future use; fetch() is used directly for preview/run JSON endpoints

  const runPreview = async () => {
    try {
      const mapping = JSON.parse(mappingJson)
      const resp = await fetch('/api/importer/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ url, productType, mapping }),
      })
      if (resp.status === 403) {
        setHqError('hq_required')
        return
      }
      setHqError(null)
      const data = await resp.json()
      setPreview(data.items || [])
      setStep(2)
    } catch (e) {
      console.error(e)
    }
  }

  const runJob = async () => {
    const mapping = JSON.parse(mappingJson)
    const resp = await fetch('/api/importer/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url, productType, mapping }),
    })
    if (resp.status === 403) {
      setHqError('hq_required')
      return
    }
    setHqError(null)
    const data = await resp.json()
    if (data.jobId) alert('Job enqueued: ' + data.jobId)
  }

  return (
    <div className="p-m space-y-m">
      <h2>Supplier Import Wizard (v1)</h2>
      {hqError === 'hq_required' ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Import actions are restricted to HQ. Add <code>?hq=1</code> to the URL or sign in as an HQ shop.
        </div>
      ) : null}
      {step === 0 && (
        <div className="space-y-s">
          <div>
            <label className="block text-sm font-medium">Supplier Listing URL</label>
            <input className="w-full border px-2 py-1" value={url} onChange={e => setUrl(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Product Type</label>
            <input
              className="w-full border px-2 py-1"
              value={productType}
              onChange={e => setProductType(e.target.value)}
            />
          </div>
          <button
            className="rounded bg-blue-600 px-3 py-1 text-white"
            onClick={() => setStep(1)}
            disabled={!url || !productType}
          >
            Next: Mapping
          </button>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-s">
          <p className="text-sm text-gray-600">Define minimal mapping JSON (item.container + fields[])</p>
          <textarea
            className="h-48 w-full border p-2 font-mono text-xs"
            value={mappingJson}
            onChange={e => setMappingJson(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="rounded bg-gray-200 px-3 py-1" onClick={() => setStep(0)}>
              Back
            </button>
            <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={runPreview}>
              Preview
            </button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-s">
          <h3 className="font-semibold">Preview ({preview?.length || 0} items)</h3>
          <table className="min-w-full border text-xs">
            <thead>
              <tr>
                <th className="border px-1">Title</th>
                <th className="border px-1">Vendor</th>
                <th className="border px-1">SKU</th>
                <th className="border px-1">Price</th>
                <th className="border px-1">Action</th>
                <th className="border px-1">Warnings</th>
              </tr>
            </thead>
            <tbody>
              {preview?.map(p => (
                <tr key={p.dedupeKey} className="border-t">
                  <td className="border-r px-1">{p.mapped.title}</td>
                  <td className="border-r px-1">{p.mapped.vendor}</td>
                  <td className="border-r px-1">{p.mapped.sku}</td>
                  <td className="border-r px-1">{p.mapped.price}</td>
                  <td className="border-r px-1">{p.action}</td>
                  <td className="px-1">{p.warnings?.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2">
            <button className="rounded bg-gray-200 px-3 py-1" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="rounded bg-green-600 px-3 py-1 text-white" onClick={runJob} disabled={!preview?.length}>
              Run Import
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
