// <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
// react types inferred via JSX runtime
import { DataTable, Text, Card } from '@shopify/polaris'

type Product = { title?: string | null; price?: number | null; status?: string | null; url: string }
export type MappingRow = { field: string; value?: string | number | null; matchedBy?: string | null }

export function SettingsPreview({
  products,
  mappingPreview,
  isLoading,
  error,
}: {
  products: Product[]
  mappingPreview: MappingRow[]
  isLoading?: boolean
  error?: string | null
}) {
  if (isLoading)
    return (
      <Card>
        <div className="p-3 text-slate-600">Loading preview…</div>
      </Card>
    )
  if (error)
    return (
      <Card>
        <div role="alert" className="p-3 text-amber-800">
          Preview error: {error}
        </div>
      </Card>
    )

  const productRows: (string | number | JSX.Element)[][] = (products || []).slice(0, 20).map(p => [
    p.title || '—',
    p.price != null ? Number(p.price) : '—',
    p.status || '—',
    <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">
      {p.url}
    </a>,
  ])
  const mappingRows: (string | number)[][] = (mappingPreview || [])
    .slice(0, 20)
    .map(m => [
      m.field,
      m.value == null || m.value === '' ? '—' : typeof m.value === 'number' ? m.value : String(m.value),
      m.matchedBy || '—',
    ])

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <div className="p-3">
          <Text as="h3" variant="headingMd">
            Product candidates
          </Text>
        </div>
        {productRows.length === 0 ? (
          <div className="px-3 pb-3 text-sm text-slate-600">No product candidates found.</div>
        ) : (
          <DataTable
            columnContentTypes={[
              'text', // Title
              'numeric', // Price
              'text', // Status
              'text', // URL
            ]}
            headings={['Title', 'Price', 'Status', 'URL']}
            rows={productRows}
            totals={['', '', '', '']}
          />
        )}
      </Card>
      <Card>
        <div className="p-3">
          <Text as="h3" variant="headingMd">
            Template-field preview
          </Text>
        </div>
        {mappingRows.length === 0 ? (
          <div className="px-3 pb-3 text-sm text-slate-600">No mapping detected.</div>
        ) : (
          <DataTable
            columnContentTypes={['text', 'text', 'text']}
            headings={['Field', 'Detected Value', 'Matched By']}
            rows={mappingRows}
          />
        )}
      </Card>
    </div>
  )
}
export default SettingsPreview
// <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
