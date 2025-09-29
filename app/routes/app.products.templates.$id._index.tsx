import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useFetcher, useLoaderData } from '@remix-run/react'
import { Card, TextField, Text, Button, InlineStack, BlockStack, Select, Checkbox } from '@shopify/polaris'
import { useState } from 'react'
import { authenticate } from '../shopify.server'
import { getTemplateWithFields } from '../models/specTemplate.server'

type LoaderData = {
  id: string
  name: string
  fields: Array<{
    id: string
    key: string
    label: string
    type: 'text' | 'number' | 'boolean' | 'select'
    required: boolean
    position: number
    storage: 'CORE' | 'METAFIELD'
    coreFieldPath?: string | null
    metafieldNamespace?: string | null
    metafieldKey?: string | null
    metafieldType?: string | null
  }>
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  const id = String(params.id)
  const tpl = await getTemplateWithFields(id)
  if (!tpl) throw new Response('Not Found', { status: 404 })
  type FieldRec = {
    id: string
    key: string
    label: string
    type: 'text' | 'number' | 'boolean' | 'select'
    required: boolean
    position: number
    storage: 'CORE' | 'METAFIELD'
    coreFieldPath?: string | null
    metafieldNamespace?: string | null
    metafieldKey?: string | null
    metafieldType?: string | null
  }
  const fields = (tpl.fields as Array<FieldRec>).map(f => ({
    id: f.id,
    key: f.key,
    label: f.label,
    type: f.type,
    required: Boolean(f.required),
    position: Number(f.position),
    storage: f.storage,
    coreFieldPath: f.coreFieldPath ?? null,
    metafieldNamespace: f.metafieldNamespace ?? null,
    metafieldKey: f.metafieldKey ?? null,
    metafieldType: f.metafieldType ?? null,
  }))
  return json<LoaderData>({ id: tpl.id, name: tpl.name, fields })
}

const coreFieldOptions = [
  { label: 'title', value: 'title' },
  { label: 'bodyHtml', value: 'bodyHtml' },
  { label: 'vendor', value: 'vendor' },
  { label: 'productType', value: 'productType' },
  { label: 'tags', value: 'tags' },
  { label: 'variants[0].sku', value: 'variants[0].sku' },
  { label: 'variants[0].price', value: 'variants[0].price' },
]

export default function TemplateDetail() {
  const data = useLoaderData<LoaderData>()
  const renameFetcher = useFetcher()
  const addFetcher = useFetcher()
  const [name, setName] = useState(data.name)

  const rename = (next: string) => {
    const form = new FormData()
    form.append('_action', 'renameTemplate')
    form.append('id', data.id)
    form.append('name', next)
    renameFetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
  }

  const addFieldSubmit = (formValues: Record<string, string | boolean>) => {
    const form = new FormData()
    form.append('_action', 'addField')
    form.append('templateId', data.id)
    for (const [k, v] of Object.entries(formValues)) form.append(k, String(v))
    addFetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
  }

  // SENTINEL: products-workspace-v3-0 (Spec Template detail editor)
  // BEGIN products-workspace-v3-0
  return (
    <>
      <Card>
        <BlockStack>
          <Text as="h2" variant="headingMd">
            Template
          </Text>
          <TextField
            label="Name"
            value={name}
            onChange={v => {
              setName(v)
              rename(v)
            }}
            autoComplete="off"
          />
        </BlockStack>
      </Card>
      <div style={{ height: 12 }} />
      <Card>
        <BlockStack>
          <Text as="h2" variant="headingMd">
            Fields
          </Text>
          {/* Add field */}
          <AddField onSubmit={addFieldSubmit} />
          {/* Existing fields list with inline edit/delete/reorder via fetchers */}
          <BlockStack>
            {data.fields.map(f => (
              <FieldRow key={f.id} field={f} />
            ))}
          </BlockStack>
        </BlockStack>
      </Card>
    </>
  )
  // END products-workspace-v3-0
}

function AddField({ onSubmit }: { onSubmit: (values: Record<string, string | boolean>) => void }) {
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<'text' | 'number' | 'boolean' | 'select'>('text')
  const [required, setRequired] = useState(false)
  const [storage, setStorage] = useState<'CORE' | 'METAFIELD'>('CORE')
  const [coreFieldPath, setCoreFieldPath] = useState('title')
  const [metafieldNamespace, setMetaNs] = useState('')
  const [metafieldKey, setMetaKey] = useState('')
  const [metafieldType, setMetaType] = useState('single_line_text_field')

  const submit = () => {
    const values: Record<string, string | boolean> = { key, label, type, required, storage }
    if (storage === 'CORE') values.coreFieldPath = coreFieldPath
    else {
      values.metafieldNamespace = metafieldNamespace
      values.metafieldKey = metafieldKey
      values.metafieldType = metafieldType
    }
    onSubmit(values)
    setKey('')
    setLabel('')
  }

  return (
    <BlockStack>
      <InlineStack gap="200">
        <TextField label="Key" value={key} onChange={setKey} autoComplete="off" />
        <TextField label="Label" value={label} onChange={setLabel} autoComplete="off" />
        <Select
          label="Type"
          options={['text', 'number', 'boolean', 'select'].map(v => ({ label: v, value: v }))}
          value={type}
          onChange={v => setType(v as 'text' | 'number' | 'boolean' | 'select')}
        />
        <Checkbox label="Required" checked={required} onChange={setRequired} />
      </InlineStack>
      <InlineStack gap="200">
        <Select
          label="Storage"
          options={[
            { label: 'Core', value: 'CORE' },
            { label: 'Metafield', value: 'METAFIELD' },
          ]}
          value={storage}
          onChange={v => setStorage(v as 'CORE' | 'METAFIELD')}
        />
        {storage === 'CORE' ? (
          <Select label="Core field" options={coreFieldOptions} value={coreFieldPath} onChange={setCoreFieldPath} />
        ) : (
          <InlineStack gap="200">
            <TextField label="Namespace" value={metafieldNamespace} onChange={setMetaNs} autoComplete="off" />
            <TextField label="Key" value={metafieldKey} onChange={setMetaKey} autoComplete="off" />
            <TextField label="Type" value={metafieldType} onChange={setMetaType} autoComplete="off" />
          </InlineStack>
        )}
        <Button onClick={submit} variant="primary">
          Add field
        </Button>
      </InlineStack>
    </BlockStack>
  )
}

function FieldRow({ field }: { field: LoaderData['fields'][number] }) {
  const fetcher = useFetcher()
  const remove = () => {
    const form = new FormData()
    form.append('_action', 'deleteField')
    form.append('id', field.id)
    fetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
  }
  const move = (direction: 'up' | 'down') => {
    const form = new FormData()
    form.append('_action', 'reorderField')
    form.append('id', field.id)
    form.append('direction', direction)
    fetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
  }

  return (
    <InlineStack align="space-between" gap="200">
      <InlineStack gap="200">
        <Text as="span">{field.label}</Text>
        <Text as="span" tone="subdued">
          ({field.key})
        </Text>
      </InlineStack>
      <InlineStack gap="200">
        <Button onClick={() => move('up')} variant="plain">
          Up
        </Button>
        <Button onClick={() => move('down')} variant="plain">
          Down
        </Button>
        <Button tone="critical" variant="plain" onClick={remove}>
          Delete
        </Button>
      </InlineStack>
    </InlineStack>
  )
}
