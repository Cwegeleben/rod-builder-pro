// <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { Form, useLoaderData, useNavigation } from '@remix-run/react'
import { Page, Layout, Card, Text, TextField, Button, InlineStack, ButtonGroup, Select } from '@shopify/polaris'
import { useCallback, useEffect, useState } from 'react'
import { authenticate } from '../shopify.server'
import { getTemplateById, upsertTemplateWithFields } from '../models/specTemplate.server'
import { deleteField } from '../models/specField.server'
import { ProductsTabs } from '../components/products-tabs'

type Field = {
  id?: string
  key: string
  label: string
  type: string
  required?: boolean
  storageMode?: 'METAFIELD' | 'PRODUCT_FIELD'
  position?: number
  productField?: 'TITLE' | 'BODY_HTML' | 'VENDOR' | 'PRODUCT_TYPE' | 'TAGS' | null
  namespace?: string | null
  metafieldKey?: string | null
  metafieldType?: string | null
}

type SpecFieldInput = Partial<{
  id: string
  key: string
  label: string
  type: string
  required: boolean
  storageMode: 'METAFIELD' | 'PRODUCT_FIELD'
  position: number
  productField: 'TITLE' | 'BODY_HTML' | 'VENDOR' | 'PRODUCT_TYPE' | 'TAGS' | null
  namespace: string | null
  metafieldKey: string | null
  metafieldType: string | null
}> & { key: string; label: string; type: string }

export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  const id = String(params.id)
  const template = await getTemplateById(id)
  if (!template) {
    throw new Response('Not Found', { status: 404 })
  }
  return json({ template })
}

export async function action({ request, params }: ActionFunctionArgs) {
  await authenticate.admin(request)
  const id = String(params.id)
  const url = new URL(request.url)
  const actionQ = url.searchParams.get('_action')
  const form = await request.formData()

  if (actionQ === 'deleteField') {
    const fieldId = String(form.get('fieldId') || '')
    if (fieldId) await deleteField(fieldId)
    return redirect(`/app/products/templates/${id}`)
  }

  const title = String(form.get('title') || '')
  const description = (form.get('description') as string) || ''
  const fieldsJson = (form.get('fields') as string) || '[]'
  type Field = {
    id?: string
    key: string
    label: string
    type: string
    required?: boolean
    storageMode?: 'METAFIELD' | 'PRODUCT_FIELD'
    position?: number
    productField?: string | null
    namespace?: string | null
    metafieldKey?: string | null
    metafieldType?: string | null
  }
  let fields: Field[] = []
  try {
    fields = JSON.parse(fieldsJson)
  } catch {
    // ignore parse errors and fall back to empty list
  }

  const saved = await upsertTemplateWithFields({
    id,
    title,
    description,
    fields: fields as unknown as SpecFieldInput[],
  })
  return redirect(`/app/products/templates/${saved?.id}`)
}

export default function TemplateDetailPage() {
  const { template } = useLoaderData<typeof loader>()
  const nav = useNavigation()
  const isSubmitting = nav.state === 'submitting'
  const [title, setTitle] = useState(template.title)
  const [description, setDescription] = useState(template.description || '')
  const [fields, setFields] = useState<Field[]>(template.fields as Field[])

  useEffect(() => {
    setFields(template.fields)
  }, [template.fields])

  const addField = useCallback(() => {
    setFields(fs => [
      ...fs,
      {
        id: undefined,
        key: '',
        label: '',
        type: 'text',
        required: false,
        storageMode: 'METAFIELD',
        namespace: '',
        metafieldKey: '',
        metafieldType: 'single_line_text_field',
        position: fs.length,
      },
    ])
  }, [])

  const moveField = useCallback((index: number, delta: 1 | -1) => {
    setFields(fs => {
      const nxt = [...fs]
      const j = index + delta
      if (j < 0 || j >= nxt.length) return fs
      const tmp = nxt[index]
      nxt[index] = nxt[j]
      nxt[j] = tmp
      return nxt.map((f, i) => ({ ...f, position: i }))
    })
  }, [])

  const removeField = useCallback((index: number) => {
    setFields(fs => fs.filter((_, i) => i !== index).map((f, i) => ({ ...f, position: i })))
  }, [])

  const updateField = useCallback((index: number, patch: Record<string, unknown>) => {
    setFields(fs => fs.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }, [])

  return (
    <Page title="Template">
      <div className="mb-m">
        <ProductsTabs />
      </div>
      <Form method="post" replace>
        <input type="hidden" name="fields" value={JSON.stringify(fields)} />
        <Layout>
          <Layout.Section>
            <Card>
              <div className="p-m space-y-m">
                <TextField label="Title" name="title" value={title} onChange={setTitle} autoComplete="off" />
                <TextField
                  label="Description"
                  name="description"
                  value={description}
                  onChange={setDescription}
                  multiline
                  autoComplete="off"
                />
                <Button submit variant="primary" loading={isSubmitting}>
                  Save
                </Button>
              </div>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <Card>
              <div className="p-m space-y-m">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">
                    Fields
                  </Text>
                  <Button onClick={addField}>Add field</Button>
                </InlineStack>
                <div className="space-y-s">
                  {fields.length === 0 && (
                    <Text as="p" tone="subdued">
                      No fields yet.
                    </Text>
                  )}
                  {fields.map((f, index) => (
                    <div key={(f.id ?? String(index)) as string} className="p-s rounded border">
                      <div className="gap-s flex items-center">
                        <ButtonGroup>
                          <Button disabled={index === 0} onClick={() => moveField(index, -1)}>
                            Up
                          </Button>
                          <Button disabled={index === fields.length - 1} onClick={() => moveField(index, 1)}>
                            Down
                          </Button>
                          <Button tone="critical" onClick={() => removeField(index)}>
                            Remove
                          </Button>
                        </ButtonGroup>
                        <Text as="span" tone="subdued">
                          #{index + 1}
                        </Text>
                      </div>
                      <div className="gap-s mt-s grid grid-cols-1 md:grid-cols-3">
                        <TextField
                          label="Key"
                          value={f.key}
                          onChange={v => updateField(index, { key: v })}
                          autoComplete="off"
                          helpText="Lowercase with dashes"
                        />
                        <TextField
                          label="Label"
                          value={f.label}
                          onChange={v => updateField(index, { label: v })}
                          autoComplete="off"
                        />
                        <Select
                          label="Type"
                          options={[
                            { label: 'Text', value: 'text' },
                            { label: 'Number', value: 'number' },
                            { label: 'Boolean', value: 'boolean' },
                            { label: 'Select', value: 'select' },
                          ]}
                          value={f.type}
                          onChange={v => updateField(index, { type: v })}
                        />
                        <Select
                          label="Storage mode"
                          options={[
                            { label: 'Metafield', value: 'METAFIELD' },
                            { label: 'Product field', value: 'PRODUCT_FIELD' },
                          ]}
                          value={f.storageMode}
                          onChange={v => updateField(index, { storageMode: v })}
                        />
                        {f.storageMode === 'PRODUCT_FIELD' ? (
                          <Select
                            label="Product core field"
                            options={[
                              { label: 'Title', value: 'TITLE' },
                              { label: 'Body HTML', value: 'BODY_HTML' },
                              { label: 'Vendor', value: 'VENDOR' },
                              { label: 'Product Type', value: 'PRODUCT_TYPE' },
                              { label: 'Tags', value: 'TAGS' },
                            ]}
                            value={f.productField || 'TITLE'}
                            onChange={v => updateField(index, { productField: v })}
                          />
                        ) : (
                          <>
                            <TextField
                              label="Metafield namespace"
                              value={f.namespace || ''}
                              onChange={v => updateField(index, { namespace: v })}
                              autoComplete="off"
                            />
                            <TextField
                              label="Metafield key"
                              value={f.metafieldKey || ''}
                              onChange={v => updateField(index, { metafieldKey: v })}
                              autoComplete="off"
                            />
                            <TextField
                              label="Metafield type"
                              value={f.metafieldType || 'single_line_text_field'}
                              onChange={v => updateField(index, { metafieldType: v })}
                              autoComplete="off"
                              helpText="Prefer standard metafields when possible."
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Form>
    </Page>
  )
}
// <!-- END RBP GENERATED: products-module-v3-0 -->
