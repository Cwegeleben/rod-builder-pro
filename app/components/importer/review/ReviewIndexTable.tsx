// <!-- BEGIN RBP GENERATED: importer-review-inline-v1 -->
import { IndexTable, Card, InlineStack, Button, Text, Pagination } from '@shopify/polaris'
import { useMemo } from 'react'
import RowExpandPanel from './RowExpandPanel'

export default function ReviewIndexTable({
  runId,
  rows,
  columns: _columns,
  page,
  pageSize,
  totalPages,
  selectedIds,
  onSelectedIdsChange,
  expandedRowId,
  onExpand,
  onPageChange,
  onPageSizeChange,
  onApproveSelected,
  onRejectSelected,
}: {
  runId: string
  rows: Array<{
    core: {
      id: string
      title: string | null
      externalId: string
      vendor: string
      status: 'staged' | 'approved' | 'rejected'
      confidence: number | null
      price?: number | null
      availability?: string | null
      shopifyProductId?: string | null
    }
    attributes: Record<string, unknown>
    diffClass: string
  }>
  columns: Array<{ key: string; label: string; type: string }>
  page: number
  pageSize: number
  totalPages: number
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  expandedRowId: string | null
  onExpand: (id: string | null) => void
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
  onApproveSelected: () => void
  onRejectSelected: () => void
}) {
  // keep API stable; columns are now rendered in the expand panel rather than the main row
  void _columns
  const resourceName = { singular: 'item', plural: 'items' }
  const bulkActive = selectedIds.length > 0
  // We keep the main row focused on core fields; attributes will be shown in the expanded panel
  const visibleDynamic: Array<{ key: string; label: string; type: string }> = []

  const headings = useMemo(() => {
    return [
      { title: 'Title' },
      { title: 'ExternalId' },
      { title: 'Vendor' },
      { title: 'Confidence' },
      { title: 'Price' },
      { title: 'Availability' },
      { title: 'Status' },
    ]
  }, [])

  const allIds = rows.map(r => r.core.id)
  const allSelected = allIds.length > 0 && selectedIds.length === allIds.length

  type H = { title: string }
  const typedHeadings = headings as unknown as [H, ...Array<H>]

  return (
    <Card>
      <div style={{ padding: '8px 12px' }}>
        <InlineStack align="space-between" blockAlign="center" gap="400">
          <Text as="span" tone="subdued">
            {rows.length} items
          </Text>
          <InlineStack gap="200">
            <Button disabled={!bulkActive} onClick={onApproveSelected}>
              Approve
            </Button>
            <Button tone="critical" disabled={!bulkActive} onClick={onRejectSelected}>
              Reject
            </Button>
          </InlineStack>
        </InlineStack>
      </div>
      <IndexTable
        resourceName={resourceName}
        itemCount={rows.length}
        selectable
        selectedItemsCount={allSelected ? 'All' : selectedIds.length}
        onSelectionChange={state => {
          if (Array.isArray(state)) onSelectedIdsChange(state as string[])
          // @ts-expect-error tolerate legacy 'All' type from Polaris
          else if (state === 'All') onSelectedIdsChange(allIds)
        }}
        headings={typedHeadings}
      >
        {rows.map((r, index) => {
          const isExpanded = expandedRowId === r.core.id
          return (
            <IndexTable.Row id={r.core.id} key={r.core.id} position={index} selected={selectedIds.includes(r.core.id)}>
              <IndexTable.Cell>
                <span style={{ cursor: 'pointer' }} onClick={() => onExpand(isExpanded ? null : r.core.id)}>
                  {r.core.title || '—'}
                </span>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <span style={{ cursor: 'pointer' }} onClick={() => onExpand(isExpanded ? null : r.core.id)}>
                  {r.core.externalId}
                </span>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <span style={{ cursor: 'pointer' }} onClick={() => onExpand(isExpanded ? null : r.core.id)}>
                  {r.core.vendor}
                </span>
              </IndexTable.Cell>
              <IndexTable.Cell>
                {r.core.confidence != null ? Math.round(r.core.confidence * 100) + '%' : '—'}
              </IndexTable.Cell>
              <IndexTable.Cell>
                <span style={{ cursor: 'pointer' }} onClick={() => onExpand(isExpanded ? null : r.core.id)}>
                  {r.core.price != null ? `$${r.core.price}` : '—'}
                </span>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <span style={{ cursor: 'pointer' }} onClick={() => onExpand(isExpanded ? null : r.core.id)}>
                  {r.core.availability || '—'}
                </span>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <span style={{ cursor: 'pointer' }} onClick={() => onExpand(isExpanded ? null : r.core.id)}>
                  {r.core.status}
                </span>
              </IndexTable.Cell>
              {visibleDynamic.map(c => (
                <IndexTable.Cell key={c.key}>{formatAttr(r.attributes[c.key])}</IndexTable.Cell>
              ))}
              {isExpanded ? (
                <IndexTable.Cell colSpan={headings.length}>
                  <RowExpandPanel
                    runId={runId}
                    rowId={r.core.id}
                    onApprove={() => onApproveSelected()}
                    onReject={() => onRejectSelected()}
                  />
                </IndexTable.Cell>
              ) : null}
            </IndexTable.Row>
          )
        })}
      </IndexTable>
      <div style={{ padding: '8px 12px' }}>
        <InlineStack align="space-between" blockAlign="center" gap="400">
          <Pagination
            hasPrevious={page > 1}
            onPrevious={() => onPageChange(page - 1)}
            hasNext={page < totalPages}
            onNext={() => onPageChange(page + 1)}
          />
          <InlineStack gap="200">
            <Button onClick={() => onPageSizeChange(25)} disabled={pageSize === 25}>
              25
            </Button>
            <Button onClick={() => onPageSizeChange(50)} disabled={pageSize === 50}>
              50
            </Button>
          </InlineStack>
        </InlineStack>
      </div>
    </Card>
  )
}

function formatAttr(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return '—'
  }
}
// <!-- END RBP GENERATED: importer-review-inline-v1 -->
