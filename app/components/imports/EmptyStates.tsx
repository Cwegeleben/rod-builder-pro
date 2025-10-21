// <!-- BEGIN RBP GENERATED: admin-hq-importer-ux-v2 -->
import { EmptyState } from '@shopify/polaris'

export function ImportRunsEmpty() {
  return (
    <EmptyState
      heading="No import runs yet"
      action={{ content: 'Start Import', url: '/app/products' }}
      secondaryAction={{ content: 'Importer Settings', url: '/app/imports/settings' }}
      image="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images/empty-state.svg"
    >
      <p>Start an import from the Products page to ingest supplier products and review diffs here.</p>
    </EmptyState>
  )
}

export function TabEmpty({ label }: { label: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">No {label}.</div>
}
// <!-- END RBP GENERATED: admin-hq-importer-ux-v2 -->
