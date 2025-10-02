import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { useLoaderData, useFetcher } from '@remix-run/react'
import { authenticate } from '../shopify.server'
import { listMappings, upsertMapping, deleteMapping } from '../models/productTypeTemplate.server'
import { listTemplatesSummary } from '../models/specTemplate.server'
import { Card, BlockStack, Text, InlineStack, Button, TextField, Select } from '@shopify/polaris'
import { useState } from 'react'

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  const [mappings, templates] = await Promise.all([listMappings(), listTemplatesSummary()])
  return json({ mappings, templates })
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request)
  const form = await request.formData()
  const actionType = String(form.get('_action') || '')
  switch (actionType) {
    case 'upsert': {
      const productType = String(form.get('productType') || '').trim()
      const templateId = String(form.get('templateId') || '').trim()
      if (!productType || !templateId) return json({ ok: false, error: 'Missing fields' }, { status: 400 })
      await upsertMapping(productType, templateId)
      return redirect('/app/settings/product-types')
    }
    case 'delete': {
      const productType = String(form.get('productType') || '').trim()
      if (!productType) return json({ ok: false, error: 'Missing productType' }, { status: 400 })
      await deleteMapping(productType)
      return redirect('/app/settings/product-types')
    }
    default:
      return json({ ok: false, error: 'Unknown action' }, { status: 400 })
  }
}

export default function ProductTypeSettings() {
  const data = useLoaderData<typeof loader>()
  const fetcher = useFetcher()
  const [productType, setProductType] = useState('')
  const [templateId, setTemplateId] = useState('')

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingLg">
          Templates by product type
        </Text>
        <BlockStack gap="200">
          <InlineStack gap="200" align="start">
            <TextField label="Product type" value={productType} onChange={setProductType} autoComplete="off" />
            <Select
              label="Template"
              options={[
                { label: 'Select…', value: '' },
                ...data.templates.map((t: { id: string; name: string }) => ({ label: t.name, value: t.id })),
              ]}
              value={templateId}
              onChange={setTemplateId}
            />
            <fetcher.Form method="post">
              <input type="hidden" name="_action" value="upsert" />
              <input type="hidden" name="productType" value={productType} />
              <input type="hidden" name="templateId" value={templateId} />
              <Button submit variant="primary" disabled={!productType || !templateId}>
                Save mapping
              </Button>
            </fetcher.Form>
          </InlineStack>
        </BlockStack>

        <BlockStack gap="200">
          <Text as="h3" variant="headingMd">
            Existing mappings
          </Text>
          {data.mappings.length === 0 ? (
            <Text as="p">No mappings yet.</Text>
          ) : (
            <BlockStack gap="200">
              {data.mappings.map((m: { productType: string; templateId: string }) => (
                <InlineStack key={m.productType} align="space-between">
                  <Text as="p">
                    {m.productType} → <code>{m.templateId}</code>
                  </Text>
                  <fetcher.Form method="post">
                    <input type="hidden" name="_action" value="delete" />
                    <input type="hidden" name="productType" value={m.productType} />
                    <Button tone="critical" variant="secondary" submit>
                      Remove
                    </Button>
                  </fetcher.Form>
                </InlineStack>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </BlockStack>
    </Card>
  )
}
