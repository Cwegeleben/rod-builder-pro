import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { Form, useActionData, useLoaderData, useNavigation } from '@remix-run/react'
import { Page, Layout, Card, Text, TextField, Select, Button, InlineError } from '@shopify/polaris'
// <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
import { ProductsTabs } from '../components/products-tabs'
// <!-- END RBP GENERATED: products-module-v3-0 -->
import { useState } from 'react'
import { authenticate } from '../shopify.server'
// <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
import { listTemplates } from '../models/specTemplate.server'
// <!-- END RBP GENERATED: products-module-v3-0 -->

type ActionData = {
  ok?: boolean
  errors?: { sourceUrl?: string; templateId?: string }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  // <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
  const { items } = await listTemplates({ perPage: 100 })
  return json({ templates: items })
  // <!-- END RBP GENERATED: products-module-v3-0 -->
}

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request)
  const form = await request.formData()
  const sourceUrl = String(form.get('sourceUrl') || '')
  // <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
  const templateId = String(form.get('templateId') || '')
  // <!-- END RBP GENERATED: products-module-v3-0 -->

  const errors: ActionData['errors'] = {}
  try {
    const url = new URL(sourceUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol')
  } catch {
    errors.sourceUrl = 'Enter a valid http(s) URL'
  }
  // <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
  if (!templateId) {
    errors.templateId = 'Select a Spec Template'
  }
  // <!-- END RBP GENERATED: products-module-v3-0 -->

  if (Object.keys(errors).length > 0) {
    return json<ActionData>({ ok: false, errors }, { status: 400 })
  }

  // TODO: enqueue background job to fetch + parse sourceUrl into products of productType
  return redirect('/app/products')
}

export default function ImportProductsIndex() {
  const data = useLoaderData<typeof loader>()
  const actionData = useActionData<ActionData>()
  const nav = useNavigation()
  const [sourceUrl, setSourceUrl] = useState('')
  // <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
  const [templateId, setTemplateId] = useState('')
  // <!-- END RBP GENERATED: products-module-v3-0 -->
  const isSubmitting = nav.state === 'submitting'

  return (
    <Page title="Import Products">
      {/* <!-- BEGIN RBP GENERATED: products-module-v3-0 --> */}
      <div className="mb-m">
        <ProductsTabs />
      </div>
      {/* <!-- END RBP GENERATED: products-module-v3-0 --> */}
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
                  {/* <!-- BEGIN RBP GENERATED: products-module-v3-0 --> */}
                  <Select
                    name="templateId"
                    label="Spec Template"
                    options={[
                      { label: 'Select…', value: '' },
                      ...(data?.templates ?? []).map((t: { id: string; title: string }) => ({
                        label: t.title,
                        value: t.id,
                      })),
                    ]}
                    value={templateId}
                    onChange={setTemplateId}
                    error={actionData?.errors?.templateId}
                  />
                  {/* <!-- END RBP GENERATED: products-module-v3-0 --> */}
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
        {/* <!-- BEGIN RBP GENERATED: products-module-v3-0 --> */}
        <Layout.Section>
          <Card>
            <div className="p-m space-y-s">
              <Text as="h3" variant="headingMd">
                Recent imports
              </Text>
              <Text as="p" tone="subdued">
                No recent imports.
              </Text>
            </div>
          </Card>
        </Layout.Section>
        {/* <!-- END RBP GENERATED: products-module-v3-0 --> */}
      </Layout>
    </Page>
  )
}
