import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, useFetcher, useLoaderData } from '@remix-run/react'
import { Card, IndexTable, useIndexResourceState, Text, Button, InlineStack, BlockStack } from '@shopify/polaris'
import { authenticate } from '../shopify.server'
import { listTemplatesSummary } from '../models/specTemplate.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  const items = await listTemplatesSummary()
  return json({ items })
}

export default function TemplatesIndex() {
  const { items } = useLoaderData<typeof loader>() as {
    items: Array<{ id: string; name: string; fieldsCount: number; updatedAt: string }>
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
        <InlineStack align="space-between">
          <Text as="p" tone="subdued">
            Manage template schemas for product specs.
          </Text>
          <Button onClick={createTemplate} variant="primary">
            New template
          </Button>
        </InlineStack>
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
