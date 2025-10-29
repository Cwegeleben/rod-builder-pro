// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
export default function ShopifyFilterLink({ runId }: { runId: string }) {
  const tag = `rbp-import:${runId}`
  const href = `/admin/products?status=draft&query=${encodeURIComponent('tag:' + tag)}`
  return (
    <a href={href} target="_blank" rel="noreferrer" className="rounded border px-2 py-1">
      Review in Shopify
    </a>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
