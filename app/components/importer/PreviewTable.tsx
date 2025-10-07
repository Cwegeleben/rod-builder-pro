// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import type { ReactNode } from 'react'

export interface PreviewRow {
  key: string
  title?: string
  vendor?: string
  sku?: string
  price?: number
  action: string
  warnings?: string[]
}

export function PreviewTable({ rows, footer }: { rows: PreviewRow[]; footer?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
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
          {rows.map(r => (
            <tr key={r.key} className="border-t">
              <td className="border-r px-1">{r.title}</td>
              <td className="border-r px-1">{r.vendor}</td>
              <td className="border-r px-1">{r.sku}</td>
              <td className="border-r px-1">{r.price}</td>
              <td className="border-r px-1">{r.action}</td>
              <td className="px-1">{r.warnings?.join(', ')}</td>
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              <td colSpan={6}>{footer}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
