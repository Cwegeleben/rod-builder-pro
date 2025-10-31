import { useEffect, useMemo, useState } from 'react'
import { Link, useFetcher, useNavigate } from '@remix-run/react'
import {
  Page,
  Layout,
  Button,
  IndexTable,
  Filters,
  useIndexResourceState,
  Badge,
  Card,
  InlineStack,
  Toast,
  Frame,
  EmptyState,
  SkeletonBodyText,
  TextField,
} from '@shopify/polaris'
import RunOptionsModal from './RunOptionsModal'

export type AdminImportsPageProps = { initialSearch: URLSearchParams }

function useUrlState(initial: URLSearchParams) {
  const nav = useNavigate()
  const [state, setState] = useState(() => {
    const qs = new URLSearchParams(initial)
    return qs
  })
  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(state)
    if (v == null || v === '') next.delete(k)
    else next.set(k, v)
    setState(next)
    nav({ pathname: '/app/imports', search: `?${next.toString()}` }, { replace: true })
  }
  return { search: state, setParam }
}

export default function AdminImportsPage({ initialSearch }: AdminImportsPageProps) {
  // <!-- BEGIN RBP GENERATED: hq-imports-shopify-style-v1 -->
  const { search, setParam } = useUrlState(initialSearch)
  const fetcher = useFetcher<{
    items?: Array<Record<string, unknown>>
    total?: number
    error?: string
  }>()
  const [showOptions, setShowOptions] = useState(false)
  const [toast, setToast] = useState<{ content: string; error?: boolean } | null>(null)
  const [rows, setRows] = useState<Array<ReturnType<typeof mapImportRunToRow>>>([])
  const [backupRows, setBackupRows] = useState<Array<ReturnType<typeof mapImportRunToRow>> | null>(null)

  // URL state keys
  const view = search.get('view') || 'all'
  const q = search.get('q') || ''
  const status = search.get('status') || ''
  const supplier = search.get('supplier') || ''
  const onlyNeedsReview = search.get('onlyNeedsReview') === '1'
  const sort = search.get('sort') || 'updatedAt'
  const direction = (search.get('direction') || 'desc') as 'asc' | 'desc'
  const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1)
  const perPage = Math.min(100, Math.max(5, parseInt(search.get('perPage') || '25', 10) || 25))

  // View-model adapter
  function mapImportRunToRow(run: Record<string, unknown>) {
    const asRec = (v: unknown): Record<string, unknown> =>
      v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
    const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)
    const num = (v: unknown, d = 0): number => (typeof v === 'number' && isFinite(v) ? v : d)

    const cfg = asRec(run.importConfig ?? run.config)
    const last = asRec((run as Record<string, unknown>).lastRun ?? cfg.lastRun)
    const counts = asRec((run as Record<string, unknown>).counts ?? last)
    const totals =
      (counts.total as number | undefined) ??
      num(counts.added, 0) + num(counts.updated ?? counts.changes, 0) + num(counts.failed, 0)
    const created = str(
      (run as Record<string, unknown>).createdAt ??
        (run as Record<string, unknown>).created ??
        (run as Record<string, unknown>).at,
      new Date().toISOString(),
    )
    const updated = str(
      (run as Record<string, unknown>).updatedAt ?? (run as Record<string, unknown>).updated ?? created,
      created,
    )
    const source = asRec(cfg.source)
    const src = str(source.entryUrl ?? cfg.sourceUrl ?? (run as Record<string, unknown>).sourceUrl, '')
    const id =
      str(
        (run as Record<string, unknown>).id ??
          (run as Record<string, unknown>).templateId ??
          (run as Record<string, unknown>).runId,
        '',
      ) || cryptoRandomId()
    const supplierName = str(
      (run as Record<string, unknown>).supplier ??
        (run as Record<string, unknown>).vendor ??
        (run as Record<string, unknown>).name,
      '—',
    )
    const statusStr = str(
      (run as Record<string, unknown>).state ?? (run as Record<string, unknown>).status,
      'unknown',
    ).toLowerCase()

    return {
      id,
      supplier: supplierName,
      status: statusStr,
      total: num(totals, 0),
      adds: num(counts.added, 0),
      changes: num(counts.updated ?? counts.changes, 0),
      errors: num(counts.failed ?? counts.errors, 0),
      createdAt: created,
      updatedAt: updated,
      sourceUrl: src,
    }
  }

  function cryptoRandomId() {
    try {
      // best-effort stable string if id is missing
      const n = Math.random().toString(36).slice(2)
      return `tmp_${n}`
    } catch {
      return `tmp_${Date.now()}`
    }
  }

  // Load list (reuse existing endpoint; adapt client-side)
  const load = () => {
    const qs = new URLSearchParams()
    qs.set('kind', 'import-templates')
    // Keep backend contracts as-is
    fetcher.load(`/api/importer/templates?${qs.toString()}`)
  }
  useEffect(() => {
    load()
  }, [view, q, status, supplier, onlyNeedsReview])

  // Build rows from response
  useEffect(() => {
    const raw = fetcher.data?.items || []
    const mapped = raw.map(mapImportRunToRow)
    setRows(mapped)
  }, [fetcher.data])

  // Filtering
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return rows.filter(r => {
      if (query && !r.supplier.toLowerCase().includes(query)) return false
      if (status && r.status !== status) return false
      if (supplier && r.supplier.toLowerCase() !== supplier.toLowerCase()) return false
      if (onlyNeedsReview && !(r.status === 'ready_to_approve' || r.status === 'ready-to-approve')) return false
      return true
    })
  }, [rows, q, status, supplier, onlyNeedsReview])

  // Sorting (client-side)
  const sorted = useMemo(() => {
    const arr = [...filtered]
    const dir = direction === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      const key = sort as keyof typeof a
      const av = a[key]
      const bv = b[key]
      if (key === 'createdAt' || key === 'updatedAt') {
        const at = Date.parse(String(av)) || 0
        const bt = Date.parse(String(bv)) || 0
        return (at - bt) * dir
      }
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
    return arr
  }, [filtered, sort, direction])

  // Pagination
  const total = fetcher.data?.total ?? sorted.length
  const start = (page - 1) * perPage
  const paged = sorted.slice(start, start + perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } = useIndexResourceState(
    paged,
    { resourceIDResolver: i => i.id },
  )

  const onDeleteSelected = () => {
    if (selectedResources.length === 0) return
    const ok = window.confirm(
      `Delete ${selectedResources.length} selected imports? This is idempotent and affects only current run artifacts.`,
    )
    if (!ok) return
    // Optimistic update with rollback
    setBackupRows(rows)
    setRows(prev => prev.filter(r => !selectedResources.includes(r.id)))
    clearSelection()
    // No backend call (contracts unchanged). Consider showing info toast.
    setToast({ content: 'Deleted selected (client-only)', error: false })
  }

  const filters = [
    {
      key: 'q',
      label: 'Search',
      filter: (
        <div style={{ maxWidth: 280 }}>
          <TextField
            label=""
            labelHidden
            value={q}
            onChange={v => setParam('q', v)}
            autoComplete="off"
            placeholder="Search"
          />
        </div>
      ),
      shortcut: true,
    },
    {
      key: 'status',
      label: 'Status',
      filter: (
        <select
          value={status}
          onChange={e => setParam('status', e.currentTarget.value || null)}
          style={{ minWidth: 160 }}
        >
          <option value="">Any</option>
          <option value="needs_settings">Needs settings</option>
          <option value="ready_to_test">Ready to test</option>
          <option value="in_test">In test</option>
          <option value="ready_to_approve">Ready to approve</option>
          <option value="approved">Approved</option>
          <option value="scheduled">Scheduled</option>
          <option value="failed">Failed</option>
        </select>
      ),
    },
    {
      key: 'supplier',
      label: 'Supplier',
      filter: (
        <div style={{ maxWidth: 240 }}>
          <TextField
            label=""
            labelHidden
            value={supplier}
            onChange={v => setParam('supplier', v)}
            autoComplete="off"
            placeholder="Supplier"
          />
        </div>
      ),
    },
    {
      key: 'onlyNeedsReview',
      label: 'Needs review',
      filter: (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={onlyNeedsReview}
            onChange={e => setParam('onlyNeedsReview', e.currentTarget.checked ? '1' : null)}
          />
          Only needs review
        </label>
      ),
    },
    {
      key: 'sort',
      label: 'Sort',
      filter: (
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={sort} onChange={e => setParam('sort', e.currentTarget.value)}>
            <option value="supplier">Supplier</option>
            <option value="status">Status</option>
            <option value="total">Totals</option>
            <option value="adds">Adds</option>
            <option value="changes">Changes</option>
            <option value="errors">Errors</option>
            <option value="createdAt">Created</option>
            <option value="updatedAt">Updated</option>
          </select>
          <select value={direction} onChange={e => setParam('direction', e.currentTarget.value)}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
      ),
    },
  ]
  const appliedFilters = useMemo(() => {
    const out: Array<{ key: string; label: string; onRemove: () => void }> = []
    if (q) out.push({ key: 'q', label: `Search: ${q}`, onRemove: () => setParam('q', null) })
    if (status) out.push({ key: 'status', label: `Status: ${status}`, onRemove: () => setParam('status', null) })
    if (supplier)
      out.push({ key: 'supplier', label: `Supplier: ${supplier}`, onRemove: () => setParam('supplier', null) })
    if (onlyNeedsReview)
      out.push({ key: 'onlyNeedsReview', label: 'Needs review', onRemove: () => setParam('onlyNeedsReview', null) })
    return out
  }, [q, status, supplier, onlyNeedsReview, setParam])

  const primaryAction = { content: 'Import products', onAction: () => setShowOptions(true) }
  const secondaryActions = [{ content: 'Settings', url: '/app/imports/settings' }]

  type BadgeTone = 'success' | 'warning' | 'critical' | 'attention'
  const badgeToneFor = (s: string): BadgeTone | undefined => {
    const v = s.toLowerCase()
    if (v.includes('fail')) return 'critical'
    if (v.includes('approve')) return 'success'
    if (v.includes('test') || v.includes('schedule') || v.includes('in_')) return 'attention'
    if (v.includes('need')) return 'warning'
    return undefined
  }

  const formatUtc = (d: string) => new Date(d).toISOString().replace('T', ' ').replace(/Z$/, '')

  return (
    <Frame>
      <Page title="Imports" primaryAction={primaryAction} secondaryActions={secondaryActions}>
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ padding: 12 }}>
                <Filters
                  queryValue={q}
                  filters={filters}
                  appliedFilters={appliedFilters}
                  onQueryChange={v => setParam('q', v)}
                  onQueryClear={() => setParam('q', null)}
                  onClearAll={() => {
                    setParam('q', null)
                    setParam('status', null)
                    setParam('supplier', null)
                    setParam('onlyNeedsReview', null)
                  }}
                />
              </div>
              {fetcher.state === 'loading' ? (
                <div style={{ padding: 16 }}>
                  <SkeletonBodyText lines={6} />
                </div>
              ) : paged.length === 0 ? (
                <div style={{ padding: 24 }}>
                  <EmptyState
                    heading="Import products"
                    action={{ content: 'Run import', onAction: () => setShowOptions(true) }}
                    secondaryAction={{ content: 'Learn more', url: '/app/docs' }}
                    image="/empty-state.svg"
                  >
                    <p>Run an import to add or update products. You can review changes and approve adds.</p>
                  </EmptyState>
                </div>
              ) : (
                <div style={{ maxHeight: 520, overflow: 'auto' }}>
                  <IndexTable
                    resourceName={{ singular: 'import', plural: 'imports' }}
                    itemCount={total}
                    selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
                    onSelectionChange={handleSelectionChange}
                    headings={[
                      { title: 'Supplier' },
                      { title: 'Status' },
                      { title: 'Totals' },
                      { title: 'Adds' },
                      { title: 'Changes' },
                      { title: 'Errors' },
                      { title: 'Created' },
                      { title: 'Updated' },
                    ]}
                  >
                    {paged.map((item, index) => (
                      <IndexTable.Row
                        id={item.id}
                        key={item.id}
                        position={index}
                        selected={selectedResources.includes(item.id)}
                        onClick={() => {
                          const qs = search.toString()
                          window.location.assign(`/app/imports/${item.id}${qs ? `?${qs}` : ''}`)
                        }}
                      >
                        <IndexTable.Cell>
                          <div
                            title={item.sourceUrl}
                            style={{
                              maxWidth: 280,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Link to={`/app/imports/${item.id}${search.toString() ? `?${search.toString()}` : ''}`}>
                              {item.supplier}
                            </Link>
                          </div>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge tone={badgeToneFor(item.status)}>{item.status}</Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>{item.total}</IndexTable.Cell>
                        <IndexTable.Cell>{item.adds}</IndexTable.Cell>
                        <IndexTable.Cell>{item.changes}</IndexTable.Cell>
                        <IndexTable.Cell>{item.errors}</IndexTable.Cell>
                        <IndexTable.Cell>{formatUtc(item.createdAt)}</IndexTable.Cell>
                        <IndexTable.Cell>{formatUtc(item.updatedAt)}</IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                </div>
              )}
              <div
                style={{
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <InlineStack align="start" gap="200">
                  <Button tone="critical" disabled={selectedResources.length === 0} onClick={onDeleteSelected}>
                    Delete selected
                  </Button>
                </InlineStack>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span>Rows per page</span>
                  <select value={String(perPage)} onChange={e => setParam('perPage', e.currentTarget.value)}>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                  <Button disabled={page <= 1} onClick={() => setParam('page', String(Math.max(1, page - 1)))}>
                    Previous
                  </Button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    disabled={page >= totalPages}
                    onClick={() => setParam('page', String(Math.min(totalPages, page + 1)))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
      {showOptions && (
        <RunOptionsModal
          open={showOptions}
          onClose={() => setShowOptions(false)}
          onConfirmed={() => {
            setShowOptions(false)
            setToast({ content: 'Import started', error: false })
            load()
          }}
        />
      )}
      {toast && (
        <Toast
          content={toast.content}
          error={toast.error}
          onDismiss={() => {
            // allow undo rollback if we have a backup snapshot
            if (backupRows) {
              setRows(backupRows)
              setBackupRows(null)
            }
            setToast(null)
          }}
        />
      )}
    </Frame>
  )
  // <!-- END RBP GENERATED: hq-imports-shopify-style-v1 -->
}
