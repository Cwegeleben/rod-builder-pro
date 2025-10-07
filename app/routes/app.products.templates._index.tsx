import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, useFetcher, useLoaderData, useRevalidator } from '@remix-run/react'
import {
  Card,
  IndexTable,
  useIndexResourceState,
  Text,
  Button,
  InlineStack,
  BlockStack,
  Banner,
  Badge,
} from '@shopify/polaris'
import { HelpBanner } from '../components/HelpBanner'
import { useEffect, useRef } from 'react'
import { authenticate } from '../shopify.server'
import { requireHqShopOr404 } from '../lib/access.server'
// prisma imported indirectly via listTemplatesSummary
import { listTemplatesSummary } from '../models/specTemplate.server'
import { isRemoteHybridEnabled, listPublishedRemoteTemplates } from '../models/remoteTemplates.server'
// NOTE: Sourcing directly from Shopify metaobjects (rbp_template) instead of local DB (Route A)

// HQ gating via shared util

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const hybrid = isRemoteHybridEnabled()
  const { admin } = await authenticate.admin(request)
  await requireHqShopOr404(request)
  const url = new URL(request.url)
  const showOrphans = !hybrid && url.searchParams.get('showOrphans') === '1'
  const items: Array<{
    id: string
    name: string
    fieldsCount: number
    updatedAt: string
    orphan?: boolean
    status: 'draft' | 'published' | 'orphan'
  }> = []
  let error: string | null = null
  let orphanCount = 0
  const localSummaries = await listTemplatesSummary()
  const localIds = new Set(localSummaries.map(r => r.id))
  if (hybrid) {
    try {
      const remote = await listPublishedRemoteTemplates(
        admin as unknown as {
          graphql: (query: string, init?: { variables?: Record<string, unknown> }) => Promise<Response>
        },
      )
      for (const r of remote) {
        items.push({
          id: r.id,
          name: r.name,
          fieldsCount: r.fields.length,
          updatedAt: new Date().toISOString(),
          status: 'published',
        })
      }
      const publishedIds = new Set(remote.map(r => r.id))
      for (const draft of localSummaries) {
        if (!publishedIds.has(draft.id)) {
          items.push({
            id: draft.id,
            name: draft.name,
            fieldsCount: draft.fieldsCount,
            updatedAt: draft.updatedAt,
            status: 'draft',
          })
        }
      }
      items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load remote templates'
    }
    return json({ items, error, orphanCount: 0, showOrphans: false, hybrid })
  }
  // Legacy non-hybrid path with orphan detection
  const TYPE = 'rbp_template'
  const first = 100
  let after: string | null = null
  const GQL = `#graphql
    query List($type: String!, $first: Int!, $after: String) {
      metaobjects(type: $type, first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            handle
            updatedAt
            templateId: field(key: "template_id") { value }
            nameField: field(key: "name") { value }
            fieldsJson: field(key: "fields_json") { value }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `
  try {
    while (true) {
      const resp: Response = await admin.graphql(GQL, { variables: { type: TYPE, first, after } })
      if (!resp.ok) throw new Error(`Metaobject list failed (HTTP ${resp.status})`)
      type MetaobjectsResp = {
        data?: {
          metaobjects?: {
            edges: Array<{
              cursor: string
              node: {
                id: string
                handle: string
                updatedAt: string
                templateId?: { value?: string | null } | null
                nameField?: { value?: string | null } | null
                fieldsJson?: { value?: string | null } | null
              }
            }>
            pageInfo: { hasNextPage: boolean; endCursor?: string | null }
          }
        }
        errors?: Array<{ message: string }>
      }
      const data = (await resp.json()) as MetaobjectsResp
      if (data?.errors?.length) throw new Error(data.errors.map(e => e.message).join('; '))
      const edges = data?.data?.metaobjects?.edges || []
      for (const e of edges) {
        const node = e.node
        const id = node?.templateId?.value || node?.handle
        if (!id) continue
        let fieldsCount = 0
        if (node?.fieldsJson?.value) {
          try {
            const arr = JSON.parse(node.fieldsJson.value)
            if (Array.isArray(arr)) fieldsCount = arr.length
          } catch {
            /* ignore parse error */
          }
        }
        const orphan = !localIds.has(id)
        if (orphan) orphanCount += 1
        if (orphan && !showOrphans) continue
        items.push({
          id,
          name: node?.nameField?.value || '(Unnamed)',
          fieldsCount,
          updatedAt: node?.updatedAt || new Date().toISOString(),
          orphan,
          status: orphan ? 'orphan' : 'published',
        })
      }
      const pageInfo = data?.data?.metaobjects?.pageInfo
      if (pageInfo?.hasNextPage && pageInfo?.endCursor) after = pageInfo.endCursor
      else break
    }
    // Add local drafts not present in published remote list
    const publishedOrIds = new Set(items.map(i => i.id))
    for (const local of localSummaries) {
      if (!publishedOrIds.has(local.id)) {
        items.push({
          id: local.id,
          name: local.name,
          fieldsCount: local.fieldsCount,
          updatedAt: local.updatedAt,
          status: 'draft',
        })
      }
    }
    items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error listing templates'
  }
  return json({ items, error, orphanCount, showOrphans, hybrid })
}

export default function TemplatesIndex() {
  const { items, error, orphanCount, showOrphans, hybrid } = useLoaderData<typeof loader>() as {
    items: Array<{ id: string; name: string; fieldsCount: number; updatedAt: string; orphan?: boolean; status: string }>
    error?: string | null
    orphanCount?: number
    showOrphans?: boolean
    hybrid?: boolean
  }
  const fetcher = useFetcher()
  const revalidator = useRevalidator()
  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } = useIndexResourceState<{
    id: string
  }>(items, {
    resourceIDResolver: (item: { id: string }) => item.id,
  })
  const actionPending = fetcher.state === 'submitting'

  const bulkDelete = () => {
    if (selectedResources.length === 0) return
    const form = new FormData()
    form.append('_action', 'deleteTemplates')
    for (const id of selectedResources) form.append('ids', String(id))
    fetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
  }

  // Track transition from submitting -> idle to detect completion
  const prevState = useRef(fetcher.state)
  useEffect(() => {
    if (prevState.current === 'submitting' && fetcher.state === 'idle') {
      const data = fetcher.data as { ok?: boolean } | undefined
      if (data?.ok) {
        revalidator.revalidate()
        clearSelection()
      }
    }
    prevState.current = fetcher.state
  }, [fetcher.state, fetcher.data, revalidator, clearSelection])

  // SENTINEL: products-workspace-v3-0 (Spec Templates IndexTable)
  // BEGIN products-workspace-v3-0
  const createTemplate = () => {
    const form = new FormData()
    form.append('_action', 'createTemplate')
    form.append('name', 'Untitled template')
    fetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
  }

  return (
    <Card>
      <BlockStack>
        <HelpBanner id="templates-index" title="Product spec templates" learnMoreHref="/app/docs">
          Create templates that define the fields your products should capture. Publish to sync with Shopify. Assign a
          template to a product from the product row.
        </HelpBanner>
        <InlineStack align="space-between">
          <Text as="h2" variant="headingLg">
            Templates
          </Text>
          <Button onClick={createTemplate} variant="primary">
            Add template
          </Button>
        </InlineStack>
        {error && (
          <Banner tone="critical" title="Unable to load templates">
            <p>{error}</p>
            <div style={{ marginTop: 8 }}>
              <Button onClick={() => window.location.reload()} variant="secondary">
                Retry
              </Button>
            </div>
          </Banner>
        )}
        {!error && !hybrid && orphanCount ? (
          <Banner
            tone={showOrphans ? 'info' : 'warning'}
            title={showOrphans ? 'Showing orphan templates' : 'Some published templates are hidden'}
          >
            <p>
              {orphanCount} metaobject{orphanCount === 1 ? '' : 's'} exist in Shopify without a corresponding local
              template record.
              {showOrphans
                ? ' You can restore them into the local DB or delete them in Shopify.'
                : ' They were hidden to avoid 404 errors.'}
            </p>
            <div style={{ marginTop: 8 }}>
              <Button
                onClick={() => {
                  const next = new URL(window.location.href)
                  if (showOrphans) next.searchParams.delete('showOrphans')
                  else next.searchParams.set('showOrphans', '1')
                  window.location.assign(next.toString())
                }}
                variant="secondary"
              >
                {showOrphans ? 'Hide orphans' : 'Show orphans'}
              </Button>
            </div>
          </Banner>
        ) : null}
        <IndexTable
          resourceName={{ singular: 'template', plural: 'templates' }}
          itemCount={items.length}
          selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
          onSelectionChange={handleSelectionChange}
          headings={[
            { title: 'Template' },
            { title: 'Fields' },
            { title: 'Updated' },
            { title: 'Status' },
            { title: 'Actions' },
          ]}
        >
          {items.map((item, index: number) => (
            <IndexTable.Row id={item.id} key={item.id} position={index} selected={selectedResources.includes(item.id)}>
              <IndexTable.Cell>
                {hybrid && item.status === 'published' ? (
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {item.name}
                  </Text>
                ) : (
                  <Link to={`/app/products/templates/${item.id}`}>{item.name}</Link>
                )}{' '}
                {item.orphan && (
                  <Text as="span" tone="subdued" variant="bodySm">
                    (orphan)
                  </Text>
                )}
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span">{item.fieldsCount}</Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span">{new Date(item.updatedAt).toISOString().replace('T', ' ').replace(/Z$/, '')}</Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                {item.status === 'draft' && <Badge tone="attention">Draft</Badge>}
                {item.status === 'published' && <Badge tone="success">Published</Badge>}
                {item.status === 'orphan' && <Badge tone="warning">Orphan</Badge>}
              </IndexTable.Cell>
              <IndexTable.Cell>
                {hybrid && item.status === 'draft' ? (
                  <InlineStack gap="200">
                    <Button
                      onClick={() => {
                        const fd = new FormData()
                        fd.append('_action', 'publishHybridTemplate')
                        fd.append('id', item.id)
                        fetcher.submit(fd, { method: 'post', action: '/resources/spec-templates' })
                      }}
                      variant="plain"
                    >
                      Publish
                    </Button>
                    <Button url={`/app/products/templates/${item.id}`} variant="plain">
                      Edit
                    </Button>
                  </InlineStack>
                ) : item.orphan ? (
                  <InlineStack gap="200">
                    <Button
                      onClick={() => {
                        const fd = new FormData()
                        fd.append('_action', 'restoreOrphanTemplate')
                        fd.append('id', item.id)
                        fetcher.submit(fd, { method: 'post', action: '/resources/spec-templates' })
                      }}
                      variant="plain"
                    >
                      Restore
                    </Button>
                    <Button
                      tone="critical"
                      onClick={() => {
                        if (!confirm('Delete remote metaobject? This cannot be undone.')) return
                        const fd = new FormData()
                        fd.append('_action', 'deleteOrphanTemplate')
                        fd.append('id', item.id)
                        fetcher.submit(fd, { method: 'post', action: '/resources/spec-templates' })
                      }}
                      variant="plain"
                    >
                      Delete
                    </Button>
                  </InlineStack>
                ) : hybrid && item.status === 'published' ? (
                  <Button
                    onClick={async () => {
                      const fd = new FormData()
                      fd.append('_action', 'importRemoteTemplateDraft')
                      fd.append('id', item.id)
                      fetcher.submit(fd, { method: 'post', action: '/resources/spec-templates' })
                      // Watch fetcher completion via effect already in place; navigate when draftId returns
                      type ImportResp = { ok?: boolean; draftId?: string }
                      const int = setInterval(() => {
                        const raw = fetcher.data as unknown
                        if (raw && typeof raw === 'object') {
                          const data = raw as ImportResp
                          if (data.ok && data.draftId) {
                            clearInterval(int)
                            window.location.assign(`/app/products/templates/${data.draftId}`)
                          }
                        }
                      }, 150)
                      setTimeout(() => clearInterval(int), 8000)
                    }}
                    variant="plain"
                  >
                    Edit
                  </Button>
                ) : (
                  <Button url={`/app/products/templates/${item.id}`} variant="plain">
                    Edit
                  </Button>
                )}
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
        <InlineStack>
          <Button
            tone="critical"
            onClick={bulkDelete}
            disabled={selectedResources.length === 0 || actionPending}
            loading={actionPending}
          >
            {actionPending ? 'Deleting…' : 'Delete selected'}
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  )
  // END products-workspace-v3-0
}
