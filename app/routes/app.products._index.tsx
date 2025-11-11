import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData, useSearchParams, Link, useFetcher, useNavigate, useLocation } from '@remix-run/react'
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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { authenticate } from '../shopify.server'
import { prisma } from '../db.server'
import { isHqShop } from '../lib/access.server'
// <!-- BEGIN RBP GENERATED: admin-link-manifest-selftest-v1 -->
import { TEST_IDS } from '../../src/config/testIds'
// <!-- END RBP GENERATED: admin-link-manifest-selftest-v1 -->

type ProductRow = {
  id: string
  title: string
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  vendor?: string | null
  productType?: string | null
  // Preformatted on server in a deterministic UTC format to avoid hydration mismatches
  updatedAt?: string | null
  // Canonical product_db fields when flag enabled
  canonical?: boolean
  supplierId?: string
  sku?: string
  latestVersionId?: string | null
}

// HQ detection centralized

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request)
  const url = new URL(request.url)
  // <!-- BEGIN RBP GENERATED: importer-publish-shopify-v1 -->
  // Support tag=importRun:<runId> (and banner params) for post-publish redirect.
  const tag = url.searchParams.get('tag') || ''
  const banner = url.searchParams.get('banner') || ''
  const created = Number(url.searchParams.get('created') || '0') || 0
  const updated = Number(url.searchParams.get('updated') || '0') || 0
  const skipped = Number(url.searchParams.get('skipped') || '0') || 0
  const failed = Number(url.searchParams.get('failed') || '0') || 0
  // Shop Admin tag query link
  // When embedding a tag with a colon in Shopify's Admin search query, wrap in quotes
  const safeTagForQuery = tag ? `"${String(tag).replace(/"/g, '\\"')}"` : ''
  const adminTagQuery = tag ? `tag:${safeTagForQuery}` : ''
  // <!-- END RBP GENERATED: importer-publish-shopify-v1 -->
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
  if (tag) queryTokens.unshift(`tag:${safeTagForQuery}`)
  const finalQuery = queryTokens.filter(Boolean).join(' ')

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

  let items: ProductRow[] = []
  let nextCursor: string | null = null
  const useCanonical = process.env.PRODUCT_DB_ENABLED === '1'
  if (useCanonical) {
    // product_db path: local SQLite canonical products
    // Basic filtering: q matches sku OR title (case-insensitive substring)
    const whereTitleSku: string | undefined = q ? `%${q.toLowerCase()}%` : undefined
    // Fetch products (limit first) ordered by updatedAt desc unless overridden
    // Prisma can handle filtering; simpler manual filter post-fetch for substring
    type CanonicalProduct = {
      id: string
      supplierId: string
      sku: string
      title: string
      type: string | null
      status: 'DRAFT' | 'READY' | 'PUBLISHED'
      updatedAt: Date
      latestVersionId: string | null
    }
    // Access product table via prisma.$queryRawUnsafe (runtime guard path in db.server.ts may have skipped generation)
    const rows = (await prisma.$queryRawUnsafe<CanonicalProduct[]>(
      `SELECT id, supplierId, sku, title, type, status, updatedAt, latestVersionId FROM Product ORDER BY updatedAt DESC LIMIT ?`,
      first,
    )) as CanonicalProduct[]
    items = rows
      .filter((p: CanonicalProduct) => {
        if (!whereTitleSku) return true
        const t = p.title?.toLowerCase() || ''
        const sku = p.sku?.toLowerCase() || ''
        return t.includes(q.toLowerCase()) || sku.includes(q.toLowerCase())
      })
      .map((p: CanonicalProduct) => ({
        id: p.id,
        title: p.title,
        status: p.status === 'PUBLISHED' ? 'ACTIVE' : p.status === 'READY' ? 'DRAFT' : 'DRAFT',
        vendor: null,
        productType: p.type || null,
        updatedAt: (() => {
          try {
            const d = new Date(p.updatedAt)
            const pad = (n: number) => String(n).padStart(2, '0')
            const YYYY = d.getUTCFullYear()
            const MM = pad(d.getUTCMonth() + 1)
            const DD = pad(d.getUTCDate())
            const hh = pad(d.getUTCHours())
            const mm = pad(d.getUTCMinutes())
            const ss = pad(d.getUTCSeconds())
            return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss} UTC`
          } catch {
            return null
          }
        })(),
        canonical: true,
        supplierId: p.supplierId,
        sku: p.sku,
        latestVersionId: p.latestVersionId,
      }))
  } else {
    // Legacy Shopify path
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
    items = edges.map(e => ({
      id: e.node.id,
      title: e.node.title,
      status: e.node.status,
      vendor: e.node.vendor,
      productType: e.node.productType,
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
    nextCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null
  }

  const hq = await isHqShop(request)
  return json({
    items,
    q,
    status: statusParams,
    sort: sortParam,
    first,
    nextCursor,
    hq,
    tag,
    banner,
    created,
    updated,
    skipped,
    failed,
    adminTagQuery,
    canonical: useCanonical,
  })
}

export default function ProductsIndex() {
  const {
    items,
    q,
    status,
    sort,
    nextCursor,
    hq,
    banner,
    created,
    updated,
    skipped,
    failed,
    adminTagQuery,
    canonical,
  } = useLoaderData<typeof loader>() as {
    items: ProductRow[]
    q: string
    status: string[]
    sort: string
    nextCursor: string | null
    hq: boolean
    banner?: string
    created?: number
    updated?: number
    skipped?: number
    failed?: number
    adminTagQuery?: string
    canonical?: boolean
  }
  const [params, setParams] = useSearchParams()
  const location = useLocation()
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
  const fetcher = useFetcher<{ ok?: boolean; runId?: string }>()

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
        {/* <!-- BEGIN RBP GENERATED: importer-publish-shopify-v1 --> */}
        {banner === 'publishOk' ? (
          <Card>
            <div className="p-m">
              <InlineStack align="space-between">
                <Text as="p">
                  Published {created} created, {updated} updated, {skipped} skipped{failed ? `, ${failed} failed` : ''}.
                </Text>
                {adminTagQuery ? (
                  <Button
                    url={`https://admin.shopify.com/store/dev/products?query=${encodeURIComponent(adminTagQuery ?? '')}`}
                    variant="plain"
                  >
                    View in Shopify Admin
                  </Button>
                ) : null}
              </InlineStack>
            </div>
          </Card>
        ) : null}
        {/* <!-- END RBP GENERATED: importer-publish-shopify-v1 --> */}
        <InlineStack align="space-between">
          <Text as="h2" variant="headingLg">
            {canonical ? 'Canonical Products' : 'Products'}
          </Text>
          <InlineStack gap="200">
            {/* Sole importer entry: Import button links to new Imports hub */}
            {/* BEGIN RBP GENERATED: admin-link-integrity-v1 */}
            {/* Direct link to Imports hub from Products; preserve current params */}
            {hq && (
              // <!-- BEGIN RBP GENERATED: admin-link-manifest-selftest-v1 -->
              <Button url={`/app/imports${location.search}`} data-testid={TEST_IDS.btnProductsImport}>
                Import
              </Button>
              // <!-- END RBP GENERATED: admin-link-manifest-selftest-v1 -->
            )}
            {/* END RBP GENERATED: admin-link-integrity-v1 */}
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

        {canonical ? (
          <Text as="p" tone="subdued">
            Showing canonical product_db rows ({items.length}).
          </Text>
        ) : null}
        {empty ? (
          <Card>
            <div className="p-m space-y-m">
              <Text as="p" tone="subdued">
                No products yet.
              </Text>
              <InlineStack gap="200">
                {hq && (
                  // Direct importer entry in empty state → Imports hub
                  <Button
                    variant="primary"
                    disabled={false}
                    url={`/app/imports${location.search}`}
                    id="btn-import-products-empty"
                    data-testid={TEST_IDS.btnProductsImport}
                  >
                    Import from Supplier
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
                {canonical ? (
                  <>
                    <Button
                      variant="secondary"
                      disabled={selectedResources.length === 0}
                      onClick={async () => {
                        const ids = selectedResources.map(String)
                        try {
                          const resp = await fetch('/api/products/publish-bulk', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ ids, dryRun: true }),
                          })
                          const data = (await resp.json()) as {
                            ok?: boolean
                            created?: number
                            updated?: number
                            skipped?: number
                            failed?: number
                          }
                          if (data?.ok) {
                            const p = new URLSearchParams(params)
                            p.set('banner', 'publishOk')
                            p.set('created', String(data.created || 0))
                            p.set('updated', String(data.updated || 0))
                            p.set('skipped', String(data.skipped || 0))
                            p.set('failed', String(data.failed || 0))
                            window.location.search = p.toString()
                          } else {
                            const w = window as unknown as { shopifyToast?: { error?: (m: string) => void } }
                            w.shopifyToast?.error?.('Dry-run failed')
                          }
                        } catch {
                          const w = window as unknown as { shopifyToast?: { error?: (m: string) => void } }
                          w.shopifyToast?.error?.('Dry-run failed')
                        } finally {
                          clearSelection()
                        }
                      }}
                    >
                      Dry-run publish
                    </Button>
                    <Button
                      variant="primary"
                      disabled={selectedResources.length === 0}
                      onClick={async () => {
                        if (!confirm(`Publish ${selectedResources.length} product(s) to Shopify?`)) return
                        const ids = selectedResources.map(String)
                        try {
                          const resp = await fetch('/api/products/publish-bulk', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ ids, dryRun: false }),
                          })
                          const data = (await resp.json()) as {
                            ok?: boolean
                            created?: number
                            updated?: number
                            skipped?: number
                            failed?: number
                          }
                          if (data?.ok) {
                            const p = new URLSearchParams(params)
                            p.set('banner', 'publishOk')
                            p.set('created', String(data.created || 0))
                            p.set('updated', String(data.updated || 0))
                            p.set('skipped', String(data.skipped || 0))
                            p.set('failed', String(data.failed || 0))
                            window.location.search = p.toString()
                          } else {
                            const w = window as unknown as { shopifyToast?: { error?: (m: string) => void } }
                            w.shopifyToast?.error?.('Publish failed')
                          }
                        } catch {
                          const w = window as unknown as { shopifyToast?: { error?: (m: string) => void } }
                          w.shopifyToast?.error?.('Publish failed')
                        } finally {
                          clearSelection()
                        }
                      }}
                    >
                      Publish to Shopify
                    </Button>
                  </>
                ) : null}
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
      <ImportWiring fetcher={fetcher} />
      {/* <!-- END RBP GENERATED: hq-products-import-wire-v1 (hook) --> */}
    </Card>
  )
}

// <!-- BEGIN RBP GENERATED: hq-products-import-wire-v1 (component) -->
type StartRunFetcher = ReturnType<typeof useFetcher<{ ok?: boolean; runId?: string }>>
function ImportWiring({ fetcher }: { fetcher: StartRunFetcher }) {
  const navigate = useNavigate()
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok && fetcher.data.runId) {
      // Toast and navigate to run detail
      try {
        const w = window as unknown as { shopifyToast?: { success?: (m: string) => void } }
        w.shopifyToast?.success?.('Import started')
      } catch {
        /* ignore */
      }
      try {
        navigate(`/app/admin/import/runs/${fetcher.data.runId}`)
      } catch {
        /* ignore */
      }
    } else if (fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok) {
      try {
        const w = window as unknown as { shopifyToast?: { error?: (m: string) => void } }
        w.shopifyToast?.error?.('Failed to start import')
      } catch {
        /* ignore */
      }
    }
  }, [fetcher.state, fetcher.data, navigate])
  return null
}
// <!-- END RBP GENERATED: hq-products-import-wire-v1 (component) -->
