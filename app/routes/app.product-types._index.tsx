import type { LoaderFunctionArgs } from '@remix-run/node'
import { Page, Layout, Card, Text, Button, TextField } from '@shopify/polaris'
import { useState } from 'react'
import { authenticate } from '../shopify.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  return null
}

type Template = { id: string; name: string; fields: string[] }

export default function ProductTypesIndex() {
  const [templates, setTemplates] = useState<Template[]>([
    { id: 'rod-blank', name: 'Rod Blank', fields: ['Length', 'Power', 'Action'] },
  ])
  const [name, setName] = useState('')
  const [field, setField] = useState('')

  const addTemplate = () => {
    if (!name.trim()) return
    const id = `t${Date.now()}`
    setTemplates(prev => [...prev, { id, name: name.trim(), fields: [] }])
    setName('')
  }

  const addField = (id: string) => {
    if (!field.trim()) return
    setTemplates(prev => prev.map(t => (t.id === id ? { ...t, fields: [...t.fields, field.trim()] } : t)))
    setField('')
  }

  return (
    <Page title="Spec Templates" primaryAction={{ content: 'Import Products', url: '/app/products/import' }}>
      <Layout>
        <Layout.Section>
          <Card>
            <div className="p-m space-y-m">
              <Text as="p" tone="subdued">
                Define the fields/columns shown in your Catalog per product type.
              </Text>
              <div className="gap-s flex items-end">
                <TextField label="New template name" value={name} onChange={setName} autoComplete="off" />
                <Button onClick={addTemplate} variant="primary">
                  Add Template
                </Button>
              </div>
              <div className="space-y-m">
                {templates.map(t => (
                  <div key={t.id} className="p-m rounded border">
                    <div className="space-y-s">
                      <Text as="h3" variant="headingMd">
                        {t.name}
                      </Text>
                      <div className="gap-s flex items-end">
                        <TextField label="Add field" value={field} onChange={setField} autoComplete="off" />
                        <Button onClick={() => addField(t.id)}>Add</Button>
                      </div>
                      {t.fields.length > 0 ? (
                        <ul className="list-disc pl-6">
                          {t.fields.map((f, idx) => (
                            <li key={`${t.id}-${idx}`}>
                              <Text as="span">{f}</Text>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <Text as="p" tone="subdued">
                          No fields yet.
                        </Text>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
