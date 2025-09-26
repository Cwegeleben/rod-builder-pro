import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { Form, useActionData, useNavigation } from '@remix-run/react'
import { Page, Layout, Card, Text, TextField, Select, Button, InlineError } from '@shopify/polaris'
import { useState } from 'react'
import { authenticate } from '../shopify.server'

type ActionData = {
  ok?: boolean
  errors?: { sourceUrl?: string; productType?: string }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  return null
}

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request)
  const form = await request.formData()
  const sourceUrl = String(form.get('sourceUrl') || '')
  const productType = String(form.get('productType') || '')

  const errors: ActionData['errors'] = {}
  try {
    const url = new URL(sourceUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol')
  } catch {
    errors.sourceUrl = 'Enter a valid http(s) URL'
  }
  if (!productType) {
    errors.productType = 'Select a product type'
  }

  if (Object.keys(errors).length > 0) {
    return json<ActionData>({ ok: false, errors }, { status: 400 })
  }

  // TODO: enqueue background job to fetch + parse sourceUrl into products of productType
  // For now, pretend success and redirect back to Products
  return redirect('/app/products')
}

export default function ImportIndex() {
  const actionData = useActionData<ActionData>()
  const nav = useNavigation()
  const [sourceUrl, setSourceUrl] = useState('')
  const [productType, setProductType] = useState('')

  const isSubmitting = nav.state === 'submitting'

  return (
    <Page title="Import Products">
      <Layout>
        <Layout.Section>
          <Card>
            <div className="p-m space-y-m">
              <Text as="p">Submit a source URL to import products into a selected Spec Template.</Text>
              <Form method="post" replace>
                <div className="space-y-m">
                  <TextField
                    name="sourceUrl"
                    label="Source URL"
                    value={sourceUrl}
                    onChange={setSourceUrl}
                    autoComplete="off"
                    placeholder="https://example.com/products.csv or https://example.com/category"
                    error={actionData?.errors?.sourceUrl}
                  />
                  <Select
                    name="productType"
                    label="Spec Template"
                    options={[
                      { label: 'Select…', value: '' },
                      { label: 'Build Specs: Rods', value: 'rods' },
                      { label: 'Build Specs: Reels', value: 'reels' },
                    ]}
                    value={productType}
                    onChange={setProductType}
                    error={actionData?.errors?.productType}
                  />
                  <div>
                    <Button submit variant="primary" loading={isSubmitting}>
                      Queue Import
                    </Button>
                  </div>
                </div>
              </Form>
              {actionData?.errors && <InlineError message="Please fix the errors above." fieldID="sourceUrl" />}
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
