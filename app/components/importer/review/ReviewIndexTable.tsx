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
  onApproveRow,
  onRejectRow,
  detailsBase,
}: {
  runId: string
  rows: Array<{
    core: {
      id: string
      title: string | null
      proposedTitle?: string | null
      titleChanged?: boolean
      prevTitle?: string | null
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
  onApproveRow: (rowId: string) => void
  onRejectRow: (rowId: string) => void
  detailsBase?: (runId: string, rowId: string) => string
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
        onSelectionChange={(state: unknown) => {
          // Normalize selection from Polaris: can be string[] | 'All' | {selectionType:'All'}
          if (Array.isArray(state)) {
            onSelectedIdsChange(state as string[])
            return
          }
          if (state === 'All') {
            onSelectedIdsChange(allIds)
            return
          }
          if (state && typeof state === 'object' && (state as { selectionType?: string }).selectionType === 'All') {
            onSelectedIdsChange(allIds)
            return
          }
          // Fallback: clear selection
          onSelectedIdsChange([])
        }}
        headings={typedHeadings}
      >
        {rows.map((r, index) => {
          const isExpanded = expandedRowId === r.core.id
          return (
            <IndexTable.Row id={r.core.id} key={r.core.id} position={index} selected={selectedIds.includes(r.core.id)}>
              <IndexTable.Cell>
                <div style={{ cursor: 'pointer' }} onClick={() => onExpand(isExpanded ? null : r.core.id)}>
                  <div>
                    {r.core.proposedTitle || r.core.title || '—'}
                    {r.core.titleChanged ? (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: '#fff3cd',
                          color: '#8a6d3b',
                          fontSize: 12,
                        }}
                      >
                        changed
                      </span>
                    ) : null}
                  </div>
                  {r.core.titleChanged && r.core.prevTitle ? (
                    <div style={{ color: '#6d7175', fontSize: 12 }}>Prev: {r.core.prevTitle}</div>
                  ) : null}
                </div>
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
              {/* Expanded content is rendered below the table to avoid invalid table structure */}
            </IndexTable.Row>
          )
        })}
      </IndexTable>
      {expandedRowId ? (
        <div style={{ padding: '8px 12px' }}>
          <RowExpandPanel
            runId={runId}
            rowId={expandedRowId}
            onApprove={() => onApproveRow(expandedRowId)}
            onReject={() => onRejectRow(expandedRowId)}
            detailsBase={detailsBase}
          />
        </div>
      ) : null}
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
