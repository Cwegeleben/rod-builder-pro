// <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { Form, Link, useLoaderData, useNavigation, useSearchParams, useSubmit } from '@remix-run/react'
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  IndexFilters,
  useIndexResourceState,
  Button,
  ButtonGroup,
  InlineStack,
} from '@shopify/polaris'
import { useMemo, useState } from 'react'
import { authenticate } from '../shopify.server'
import { ProductsTabs } from '../components/products-tabs'
import { createTemplate, deleteTemplates, listTemplates } from '../models/specTemplate.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  const url = new URL(request.url)
  const q = url.searchParams.get('q') || undefined
  const sort = (url.searchParams.get('sort') as 'updatedAt' | 'title') || 'updatedAt'
  const direction = (url.searchParams.get('direction') as 'asc' | 'desc') || 'desc'
  const page = parseInt(url.searchParams.get('page') || '1', 10) || 1
  const perPage = parseInt(url.searchParams.get('perPage') || '25', 10) || 25
  const { total, items } = await listTemplates({ q, sort, direction, page, perPage })
  return json({ total, items, q, sort, direction, page, perPage })
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request)
  const form = await request.formData()
  const intent = String(form.get('_intent') || '')
  if (intent === 'create') {
    const title = String(form.get('title') || 'Untitled Template')
    const t = await createTemplate({ title })
    return redirect(`/app/products/templates/${t.id}`)
  }
  if (intent === 'bulk-delete') {
    const ids = String(form.get('ids') || '')
      .split(',')
      .filter(Boolean)
    if (ids.length) await deleteTemplates(ids)
    return redirect(`/app/products/templates`)
  }
  return redirect(`/app/products/templates`)
}

export default function TemplatesIndexPage() {
  const { items, total, q } = useLoaderData<typeof loader>()
  const [searchParams] = useSearchParams()
  const nav = useNavigation()
  const submit = useSubmit()
  const isSubmitting = nav.state === 'submitting'
  const [selectedTab, setSelectedTab] = useState(0)
  const [mode, setMode] = useState('DEFAULT')

  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(items)

  const promotedBulkActions = useMemo(
    () => [
      {
        content: 'Delete',
        destructive: true,
        onAction: () => {
          const form = new FormData()
          form.append('_intent', 'bulk-delete')
          form.append('ids', selectedResources.join(','))
          submit(form, { method: 'post' })
        },
      },
    ],
    [selectedResources, submit],
  )

  const tabs = [{ id: 'all', content: 'All', accessibilityLabel: 'All', panelID: 'all' }]

  return (
    <Page
      title="Spec Templates"
      primaryAction={{
        content: 'Create template',
        onAction: () => {
          const form = document.getElementById('create-template-form') as HTMLFormElement | null
          form?.requestSubmit()
        },
      }}
    >
      <div className="mb-m">
        <ProductsTabs />
      </div>
      <Layout>
        <Layout.Section>
          <Card>
            <div className="p-m">
              <IndexFilters
                queryValue={q || ''}
                onQueryChange={value => {
                  const sp = new URLSearchParams(searchParams)
                  if (value) sp.set('q', value)
                  else sp.delete('q')
                  submit(sp, { method: 'get' })
                }}
                onQueryClear={() => {
                  const sp = new URLSearchParams(searchParams)
                  sp.delete('q')
                  submit(sp, { method: 'get' })
                }}
                tabs={tabs}
                selected={selectedTab}
                onSelect={setSelectedTab}
                filters={[]}
                appliedFilters={[]}
                onClearAll={() => {
                  const sp = new URLSearchParams(searchParams)
                  sp.delete('q')
                  submit(sp, { method: 'get' })
                }}
                // @ts-expect-error - Polaris typing for mode is not exported in our setup
                mode={mode}
                setMode={setMode}
              />
            </div>
            <IndexTable
              resourceName={{ singular: 'template', plural: 'templates' }}
              itemCount={items.length}
              selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: 'Title' },
                { title: 'Handle' },
                { title: 'Fields' },
                { title: 'Updated' },
                { title: 'Actions' },
              ]}
              promotedBulkActions={promotedBulkActions}
            >
              {items.map(
                (
                  t: { id: string; title: string; handle: string; updatedAt: string | Date; fields: unknown[] },
                  index: number,
                ) => (
                  <IndexTable.Row id={t.id} key={t.id} position={index} selected={selectedResources.includes(t.id)}>
                    <IndexTable.Cell>
                      <Link to={t.id} prefetch="intent">
                        {t.title}
                      </Link>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" tone="subdued">
                        {t.handle}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{t.fields.length}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" tone="subdued">
                        {new Date(t.updatedAt).toLocaleString()}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <ButtonGroup>
                        <Button url={t.id}>Edit</Button>
                      </ButtonGroup>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ),
              )}
            </IndexTable>
            <div className="p-m">
              <InlineStack align="space-between">
                <Text as="span" tone="subdued">
                  Showing {items.length} of {total}
                </Text>
                <Form id="create-template-form" method="post">
                  <input type="hidden" name="_intent" value="create" />
                  <input type="hidden" name="title" value="Untitled Template" />
                  <noscript>
                    <Button submit variant="primary" loading={isSubmitting}>
                      Create template
                    </Button>
                  </noscript>
                </Form>
              </InlineStack>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
// <!-- END RBP GENERATED: products-module-v3-0 -->
