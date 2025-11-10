// <!-- BEGIN RBP GENERATED: admin-hq-importer-ux-v2 -->
import { IndexTable, Text } from '@shopify/polaris'
import type { ReactNode } from 'react'

export type ImportRunRow = {
  id: string
  source: string
  createdAt: string
  status: string
  adds: number
  changes: number
  conflicts: number
  deletes?: number
  duration?: string
}

export function ImportRunsTable({
  rows,
  headings,
  actions,
}: {
  rows: ImportRunRow[]
  headings?: { title: string }[]
  actions?: (row: ImportRunRow) => ReactNode
}) {
  const cols =
    headings ||
    ([
      { title: 'Run' },
      { title: 'Source' },
      { title: 'Created' },
      { title: 'Status' },
      { title: 'Adds' },
      { title: 'Changes' },
      { title: 'Conflicts' },
      { title: 'Duration' },
      { title: 'Actions' },
    ] as unknown as [{ title: string }, ...{ title: string }[]])

  return (
    <IndexTable
      resourceName={{ singular: 'run', plural: 'runs' }}
      condensed={false}
      itemCount={rows.length}
      headings={cols as unknown as [{ title: string }, ...{ title: string }[]]}
      selectable
    >
      {rows.map((r, idx) => (
        <IndexTable.Row id={r.id} key={r.id} position={idx}>
          <IndexTable.Cell>
            <code className="text-xs">{r.id}</code>
          </IndexTable.Cell>
          <IndexTable.Cell>{r.source}</IndexTable.Cell>
          <IndexTable.Cell>{r.createdAt}</IndexTable.Cell>
          <IndexTable.Cell>{r.status}</IndexTable.Cell>
          <IndexTable.Cell>{r.adds}</IndexTable.Cell>
          <IndexTable.Cell>{r.changes}</IndexTable.Cell>
          <IndexTable.Cell>{r.conflicts}</IndexTable.Cell>
          <IndexTable.Cell>{r.duration || '-'}</IndexTable.Cell>
          <IndexTable.Cell>{actions ? actions(r) : <Text as="span">—</Text>}</IndexTable.Cell>
        </IndexTable.Row>
      ))}
    </IndexTable>
  )
}
// <!-- END RBP GENERATED: admin-hq-importer-ux-v2 -->
