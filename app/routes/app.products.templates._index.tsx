import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, useFetcher, useLoaderData } from '@remix-run/react'
import {
  Card,
  IndexTable,
  useIndexResourceState,
  Text,
  Button,
  InlineStack,
  BlockStack,
  Banner,
} from '@shopify/polaris'
import { HelpBanner } from '../components/HelpBanner'
import { authenticate } from '../shopify.server'
// NOTE: Sourcing directly from Shopify metaobjects (rbp_template) instead of local DB (Route A)

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request)
  const TYPE = 'rbp_template'
  const first = 100
  let after: string | null = null
  const items: Array<{ id: string; name: string; fieldsCount: number; updatedAt: string }> = []
  let error: string | null = null
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
        items.push({
          id,
          name: node?.nameField?.value || '(Unnamed)',
          fieldsCount,
          updatedAt: node?.updatedAt || new Date().toISOString(),
        })
      }
      const pageInfo = data?.data?.metaobjects?.pageInfo
      if (pageInfo?.hasNextPage && pageInfo?.endCursor) after = pageInfo.endCursor
      else break
    }
    items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error listing templates'
  }
  return json({ items, error })
}

export default function TemplatesIndex() {
  const { items, error } = useLoaderData<typeof loader>() as {
    items: Array<{ id: string; name: string; fieldsCount: number; updatedAt: string }>
    error?: string | null
  }
  const fetcher = useFetcher()
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState<{ id: string }>(
    items,
    {
      resourceIDResolver: (item: { id: string }) => item.id,
    },
  )

  const bulkDelete = () => {
    if (selectedResources.length === 0) return
    const form = new FormData()
    form.append('_action', 'deleteTemplates')
    for (const id of selectedResources) form.append('ids', String(id))
    fetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
  }

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
        <IndexTable
          resourceName={{ singular: 'template', plural: 'templates' }}
          itemCount={items.length}
          selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
          onSelectionChange={handleSelectionChange}
          headings={[{ title: 'Template' }, { title: 'Fields' }, { title: 'Updated' }, { title: 'Actions' }]}
        >
          {items.map((item: { id: string; name: string; fieldsCount: number; updatedAt: string }, index: number) => (
            <IndexTable.Row id={item.id} key={item.id} position={index} selected={selectedResources.includes(item.id)}>
              <IndexTable.Cell>
                <Link to={`/app/products/templates/${item.id}`}>{item.name}</Link>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span">{item.fieldsCount}</Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span">{new Date(item.updatedAt).toLocaleString()}</Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Button url={`/app/products/templates/${item.id}`} variant="plain">
                  Edit
                </Button>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
        <InlineStack>
          <Button tone="critical" onClick={bulkDelete} disabled={selectedResources.length === 0}>
            Delete selected
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  )
  // END products-workspace-v3-0
}
