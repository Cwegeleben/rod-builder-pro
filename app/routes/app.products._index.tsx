import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData, useSearchParams, Link, useFetcher } from '@remix-run/react'
import {
  Card,
  IndexTable,
  useIndexResourceState,
  Text,
  Button,
  BlockStack,
  InlineStack,
  IndexFilters,
  ChoiceList,
  IndexFiltersMode,
} from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authenticate } from '../shopify.server'
import { isHqShop } from '../lib/access.server'

type ProductRow = {
  id: string
  title: string
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  vendor?: string | null
  productType?: string | null
  // Preformatted on server in a deterministic UTC format to avoid hydration mismatches
  updatedAt?: string | null
}

// HQ detection centralized

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request)
  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''
  const statusParams = url.searchParams.getAll('status')
  const sortParam = url.searchParams.get('sort') || 'updatedAt desc'
  const first = Math.max(1, Math.min(100, parseInt(url.searchParams.get('first') || '25', 10)))
  const after = url.searchParams.get('after') || undefined

  const mapSort = (s: string): { sortKey: 'UPDATED_AT' | 'TITLE'; reverse: boolean } => {
    const [field, dir] = s.split(' ')
    if (field === 'title') return { sortKey: 'TITLE', reverse: dir === 'desc' }
    return { sortKey: 'UPDATED_AT', reverse: dir !== 'asc' }
  }
  const { sortKey, reverse } = mapSort(sortParam)

  const queryTokens: string[] = []
  if (q) queryTokens.push(q)
  if (statusParams.length === 1) {
    queryTokens.push(`status:${statusParams[0]}`)
  } else if (statusParams.length > 1) {
    queryTokens.push(`(${statusParams.map(s => `status:${s}`).join(' OR ')})`)
  }
  const finalQuery = queryTokens.join(' ')

  const GQL = `#graphql
    query Products($first:Int!, $after:String, $query:String, $sortKey: ProductSortKeys, $reverse:Boolean) {
      products(first:$first, after:$after, query:$query, sortKey:$sortKey, reverse:$reverse) {
        edges {
          cursor
          node {
            id
            title
            status
            vendor
            productType
            updatedAt
          }
        }
        pageInfo { hasNextPage hasPreviousPage }
      }
    }
  `

  const resp = await admin.graphql(GQL, {
    variables: { first, after, query: finalQuery || undefined, sortKey, reverse },
  })
  const data = (await resp.json()) as {
    data?: {
      products?: {
        edges: Array<{ cursor: string; node: ProductRow }>
        pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean }
      }
    }
  }
  const edges = data?.data?.products?.edges ?? []
  const items: ProductRow[] = edges.map(e => ({
    id: e.node.id,
    title: e.node.title,
    status: e.node.status,
    vendor: e.node.vendor,
    productType: e.node.productType,
    // Format on server using UTC and a fixed template (YYYY-MM-DD HH:mm:ss UTC)
    updatedAt: e.node.updatedAt
      ? (() => {
          try {
            const d = new Date(e.node.updatedAt)
            const pad = (n: number) => String(n).padStart(2, '0')
            const YYYY = d.getUTCFullYear()
            const MM = pad(d.getUTCMonth() + 1)
            const DD = pad(d.getUTCDate())
            const hh = pad(d.getUTCHours())
            const mm = pad(d.getUTCMinutes())
            const ss = pad(d.getUTCSeconds())
            return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss} UTC`
          } catch {
            return e.node.updatedAt
          }
        })()
      : null,
  }))
  const nextCursor: string | null = edges.length > 0 ? edges[edges.length - 1].cursor : null

  const hq = await isHqShop(request)
  return json({ items, q, status: statusParams, sort: sortParam, first, nextCursor, hq })
}

export default function ProductsIndex() {
  const { items, q, status, sort, nextCursor, hq } = useLoaderData<typeof loader>() as {
    items: ProductRow[]
    q: string
    status: string[]
    sort: string
    nextCursor: string | null
    hq: boolean
  }
  const [params, setParams] = useSearchParams()
  const [mode, setMode] = useState<IndexFiltersMode>(IndexFiltersMode.Default)
  const tabs = useMemo(
    () => [
      { id: 'all', content: 'All products' },
      { id: 'active', content: 'Active' },
      { id: 'draft', content: 'Draft' },
      { id: 'archived', content: 'Archived' },
    ],
    [],
  )
  const selectedTab = useMemo(() => {
    const view = params.get('view') || 'all'
    const idx = tabs.findIndex(t => t.id === view)
    return idx >= 0 ? idx : 0
  }, [params, tabs])

  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
    useIndexResourceState<ProductRow>(items, {
      resourceIDResolver: item => item.id,
    })
  const fetcher = useFetcher()

  const onQueryChange = useCallback(
    (value: string) => {
      const next = new URLSearchParams(params)
      if (value) next.set('q', value)
      else next.delete('q')
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const onSortChange = useCallback(
    (value: string[]) => {
      const next = new URLSearchParams(params)
      const v = value?.[0]
      if (v) next.set('sort', v)
      else next.delete('sort')
      setParams(next)
    },
    [params, setParams],
  )

  const empty = items.length === 0

  // Columns chooser via URL param `columns`; fallback to defaults
  const allColumns = [
    { key: 'title', label: 'Title' },
    { key: 'status', label: 'Status' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'productType', label: 'Type' },
    { key: 'updatedAt', label: 'Updated' },
  ] as const
  const defaultColumnKeys = ['title', 'status', 'vendor', 'productType', 'updatedAt'] as const
  const selectedColumnKeys = (() => {
    const values = params.getAll('columns')
    if (values.length === 0) return defaultColumnKeys as unknown as string[]
    return values
  })()
  const headings = selectedColumnKeys.map(key => ({
    title: allColumns.find(c => c.key === key)?.label || key,
  })) as unknown as [{ title: string }, ...{ title: string }[]]

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text as="h2" variant="headingLg">
            Products
          </Text>
          <InlineStack gap="200">
            {/* <!-- BEGIN RBP GENERATED: supplier-importer-ui-v1 --> */}
            {hq && (
              // <!-- BEGIN RBP GENERATED: hq-products-import-wire-v1 (button) -->
              <Button
                variant="primary"
                disabled={false}
                onClick={() => {
                  // handled by wired hook below
                }}
                id="btn-import-products"
              >
                Import from Supplier
              </Button>
              // <!-- END RBP GENERATED: hq-products-import-wire-v1 (button) -->
            )}
            {/* <!-- END RBP GENERATED: supplier-importer-ui-v1 --> */}
            {hq && <Button url="templates">Templates</Button>}
          </InlineStack>
        </InlineStack>

        <IndexFilters
          queryValue={q}
          queryPlaceholder="Filter products"
          onQueryChange={onQueryChange}
          onQueryClear={() => onQueryChange('')}
          tabs={tabs}
          selected={selectedTab}
          onSelect={index => {
            const next = new URLSearchParams(params)
            const tab = tabs[index]
            next.set('view', tab.id)
            next.delete('status')
            if (tab.id !== 'all') next.append('status', tab.id)
            setParams(next)
          }}
          mode={mode}
          setMode={setMode}
          onClearAll={() => {
            const next = new URLSearchParams(params)
            next.delete('q')
            next.delete('status')
            next.delete('columns')
            setParams(next)
          }}
          filters={[
            {
              key: 'status',
              label: 'Status',
              filter: (
                <ChoiceList
                  title="Status"
                  titleHidden
                  choices={[
                    { label: 'Active', value: 'active' },
                    { label: 'Draft', value: 'draft' },
                    { label: 'Archived', value: 'archived' },
                  ]}
                  selected={status}
                  onChange={values => {
                    const next = new URLSearchParams(params)
                    next.delete('status')
                    values.forEach(v => next.append('status', v))
                    setParams(next)
                  }}
                />
              ),
            },
            {
              key: 'columns',
              label: 'Columns',
              filter: (
                <ChoiceList
                  title="Columns"
                  titleHidden
                  choices={allColumns.map(c => ({ label: c.label, value: c.key }))}
                  selected={selectedColumnKeys}
                  allowMultiple
                  onChange={values => {
                    const next = new URLSearchParams(params)
                    next.delete('columns')
                    values.forEach(v => next.append('columns', v))
                    setParams(next)
                  }}
                />
              ),
            },
          ]}
          sortOptions={[
            { label: 'Updated', value: 'updatedAt desc', directionLabel: 'Newest first' },
            { label: 'Updated', value: 'updatedAt asc', directionLabel: 'Oldest first' },
            { label: 'Title', value: 'title asc', directionLabel: 'A-Z' },
            { label: 'Title', value: 'title desc', directionLabel: 'Z-A' },
          ]}
          sortSelected={[sort]}
          onSort={onSortChange}
        />

        {empty ? (
          <Card>
            <div className="p-m space-y-m">
              <Text as="p" tone="subdued">
                No products yet.
              </Text>
              <InlineStack gap="200">
                {/* <!-- BEGIN RBP GENERATED: supplier-importer-ui-v1 --> */}
                {hq && (
                  // <!-- BEGIN RBP GENERATED: hq-products-import-wire-v1 (button-empty) -->
                  <Button
                    variant="primary"
                    disabled={false}
                    onClick={() => {
                      // handled by wired hook below
                    }}
                    id="btn-import-products-empty"
                  >
                    Import from Supplier
                  </Button>
                  // <!-- END RBP GENERATED: hq-products-import-wire-v1 (button-empty) -->
                )}
                {/* <!-- END RBP GENERATED: supplier-importer-ui-v1 --> */}
                {hq && (
                  <Button url="templates" variant="secondary">
                    Templates
                  </Button>
                )}
              </InlineStack>
            </div>
          </Card>
        ) : (
          <BlockStack gap="300">
            <InlineStack gap="200" align="space-between">
              <Text as="p" tone="subdued">
                {selectedResources.length} selected
              </Text>
              <InlineStack gap="200">
                <Button
                  disabled={selectedResources.length === 0 || fetcher.state === 'submitting'}
                  onClick={() => {
                    const form = new FormData()
                    form.append('_action', 'setStatus')
                    form.append('status', 'ACTIVE')
                    selectedResources.forEach(id => form.append('ids', String(id)))
                    fetcher.submit(form, { method: 'post', action: '/app/resources/products' })
                    clearSelection()
                  }}
                >
                  Set active
                </Button>
                <Button
                  disabled={selectedResources.length === 0 || fetcher.state === 'submitting'}
                  onClick={() => {
                    const form = new FormData()
                    form.append('_action', 'setStatus')
                    form.append('status', 'DRAFT')
                    selectedResources.forEach(id => form.append('ids', String(id)))
                    fetcher.submit(form, { method: 'post', action: '/app/resources/products' })
                    clearSelection()
                  }}
                >
                  Set draft
                </Button>
                <Button
                  tone="critical"
                  disabled={selectedResources.length === 0 || fetcher.state === 'submitting'}
                  onClick={() => {
                    const form = new FormData()
                    form.append('_action', 'setStatus')
                    form.append('status', 'ARCHIVED')
                    selectedResources.forEach(id => form.append('ids', String(id)))
                    fetcher.submit(form, { method: 'post', action: '/app/resources/products' })
                    clearSelection()
                  }}
                >
                  Archive
                </Button>
              </InlineStack>
            </InlineStack>
            <IndexTable
              resourceName={{ singular: 'product', plural: 'products' }}
              itemCount={items.length}
              selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
              onSelectionChange={handleSelectionChange}
              headings={headings}
            >
              {items.map((item, index) => (
                <IndexTable.Row
                  id={item.id}
                  key={item.id}
                  position={index}
                  selected={selectedResources.includes(item.id)}
                >
                  {selectedColumnKeys.map(key => (
                    <IndexTable.Cell key={key}>
                      {key === 'title' ? (
                        <Link to={`/app/products/${item.id}`}>{item.title}</Link>
                      ) : key === 'status' ? (
                        <Text as="span">{item.status.toLowerCase()}</Text>
                      ) : key === 'vendor' ? (
                        <Text as="span">{item.vendor || '-'}</Text>
                      ) : key === 'productType' ? (
                        <Text as="span">{item.productType || '-'}</Text>
                      ) : key === 'updatedAt' ? (
                        <Text as="span">{item.updatedAt || '-'}</Text>
                      ) : null}
                    </IndexTable.Cell>
                  ))}
                </IndexTable.Row>
              ))}
            </IndexTable>
            <InlineStack align="end" gap="200">
              <Button
                disabled={!nextCursor}
                onClick={() => {
                  if (!nextCursor) return
                  const next = new URLSearchParams(params)
                  next.set('after', nextCursor)
                  setParams(next)
                }}
              >
                Next
              </Button>
            </InlineStack>
          </BlockStack>
        )}
      </BlockStack>
      {/* <!-- BEGIN RBP GENERATED: hq-products-import-wire-v1 (hook) --> */}
      <ImportWiring hq={hq} />
      {/* <!-- END RBP GENERATED: hq-products-import-wire-v1 (hook) --> */}
    </Card>
  )
}

// <!-- BEGIN RBP GENERATED: hq-products-import-wire-v1 (component) -->
function ImportWiring({ hq }: { hq: boolean }) {
  const fetcher = useFetcher()
  const [polling, setPolling] = useState(false)
  // Minimal toast helper with safe access
  const toast = {
    success: (msg: string) => {
      const w = window as unknown as { shopifyToast?: { success?: (m: string) => void } }
      w.shopifyToast?.success?.(msg)
    },
    error: (msg: string) => {
      const w = window as unknown as { shopifyToast?: { error?: (m: string) => void } }
      w.shopifyToast?.error?.(msg)
    },
  }
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)

  useEffect(() => {
    if (!hq) return
    const btn = document.getElementById('btn-import-products') || document.getElementById('btn-import-products-empty')
    if (!btn) return
    const onClick = () => {
      if (polling) return
      // reset state
      // 1) POST to start import (reuse existing endpoint in your app)
      // If you have a dedicated endpoint, replace below. This uses a generic supplier import preview/run.
      const form = new FormData()
      form.append('supplier', 'batson')
      fetcher.submit(form, { method: 'post', action: '/api/importer/run' })
      // 2) Toast (simple alert for now; replace with Polaris Toast if available globally)
      toast.success('Import started')
      // 3) Begin polling newest runs for ready status
      setPolling(true)
      startRef.current = Date.now()
    }
    btn.addEventListener('click', onClick)
    return () => btn.removeEventListener('click', onClick)
  }, [hq, polling, fetcher])

  useEffect(() => {
    if (!polling) return
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(async () => {
      // timeout after 2 minutes
      const elapsed = Date.now() - startRef.current
      if (elapsed > 120_000) {
        setPolling(false)
        toast.error('Import timed out')
        if (timerRef.current) clearInterval(timerRef.current)
        return
      }
      try {
        const res = await fetch('/api/importer/run', { method: 'GET' })
        if (!res.ok) return
        const js = await res.json()
        // Expect your list endpoint shape; adapt as needed
        const newest = js?.runs?.[0]
        if (newest && (newest.status === 'ready' || newest.status === 'success')) {
          if (timerRef.current) clearInterval(timerRef.current)
          setPolling(false)
          const runId = newest.id
          window.location.assign(`/app/admin/import/runs/${runId}`)
        }
      } catch {
        // ignore transient errors
      }
    }, 2000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [polling])

  return null
}
// <!-- END RBP GENERATED: hq-products-import-wire-v1 (component) -->
