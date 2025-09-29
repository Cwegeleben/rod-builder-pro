import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useFetcher, useLoaderData, useRevalidator } from '@remix-run/react'
import {
  Card,
  TextField,
  Text,
  Button,
  InlineStack,
  BlockStack,
  Select,
  Checkbox,
  FormLayout,
  IndexTable,
  useIndexResourceState,
} from '@shopify/polaris'
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
  const revalidator = useRevalidator()
  const [name, setName] = useState(data.name)
  const [editing, setEditing] = useState<LoaderData['fields'][number] | null>(null)
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(data.fields, {
    resourceIDResolver: item => item.id,
  })

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
          <InlineStack align="space-between">
            <Text as="h2" variant="headingMd">
              Template
            </Text>
            <Button url="/app/products/templates" variant="secondary">
              Back to Templates
            </Button>
          </InlineStack>
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
          {/* Existing fields in a table */}
          <IndexTable
            resourceName={{ singular: 'field', plural: 'fields' }}
            itemCount={data.fields.length}
            selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: 'Label' },
              { title: 'Key' },
              { title: 'Type' },
              { title: 'Storage' },
              { title: 'Required' },
              { title: 'Actions' },
            ]}
          >
            {data.fields.map((f, index) => (
              <IndexTable.Row id={f.id} key={f.id} position={index} selected={selectedResources.includes(f.id)}>
                <IndexTable.Cell>
                  <Text as="span">{f.label}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" tone="subdued">
                    {f.key}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span">{f.type}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span">{f.storage === 'CORE' ? 'Core' : 'Metafield'}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span">{f.required ? 'Yes' : 'No'}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <FieldActions field={f} onEdit={() => setEditing(f)} />
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </BlockStack>
      </Card>

      {/* Edit field modal */}
      {editing && (
        <EditFieldModal
          field={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            revalidator.revalidate()
          }}
        />
      )}
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
  const [keyEdited, setKeyEdited] = useState(false)

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')

  const keyError = key
    ? /[a-z0-9_]+/.test(key)
      ? undefined
      : 'Use lowercase letters, numbers, and underscores'
    : 'Key is required'
  const labelError = label ? undefined : 'Label is required'
  const storageErrors = (() => {
    if (storage === 'CORE') return { core: undefined, ns: undefined, mkey: undefined, mtype: undefined }
    return {
      core: undefined,
      ns: metafieldNamespace ? undefined : 'Namespace is required',
      mkey: metafieldKey ? undefined : 'Metafield key is required',
      mtype: metafieldType ? undefined : 'Type is required',
    }
  })()

  const isValid = !keyError && !labelError && !storageErrors.ns && !storageErrors.mkey && !storageErrors.mtype

  const onLabelChange = (v: string) => {
    setLabel(v)
    if (!keyEdited) setKey(slugify(v))
  }

  const onKeyChange = (v: string) => {
    setKey(v)
    setKeyEdited(true)
  }

  const submit = () => {
    if (!isValid) return
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
    setKeyEdited(false)
  }

  return (
    <Card>
      <div className="p-m">
        <FormLayout>
          <FormLayout.Group>
            <TextField
              label="Label"
              value={label}
              onChange={onLabelChange}
              autoComplete="off"
              helpText="Human-friendly name shown in the UI"
              error={labelError}
            />
            <TextField
              label="Key"
              value={key}
              onChange={onKeyChange}
              autoComplete="off"
              helpText="Machine key (auto-generated from label). You can override."
              error={keyError}
            />
            <Select
              label="Type"
              options={['text', 'number', 'boolean', 'select'].map(v => ({ label: v, value: v }))}
              value={type}
              onChange={v => setType(v as 'text' | 'number' | 'boolean' | 'select')}
            />
            <Checkbox label="Required" checked={required} onChange={setRequired} />
          </FormLayout.Group>

          <FormLayout.Group>
            <Select
              label="Storage"
              options={[
                { label: 'Core', value: 'CORE' },
                { label: 'Metafield', value: 'METAFIELD' },
              ]}
              value={storage}
              onChange={v => setStorage(v as 'CORE' | 'METAFIELD')}
              helpText="Choose where this value is stored on the product"
            />
            {storage === 'CORE' ? (
              <Select
                label="Core field"
                options={coreFieldOptions}
                value={coreFieldPath}
                onChange={setCoreFieldPath}
                helpText="Map to a built-in product field"
              />
            ) : (
              <>
                <TextField
                  label="Metafield namespace"
                  value={metafieldNamespace}
                  onChange={setMetaNs}
                  autoComplete="off"
                  error={storageErrors.ns}
                />
                <TextField
                  label="Metafield key"
                  value={metafieldKey}
                  onChange={setMetaKey}
                  autoComplete="off"
                  error={storageErrors.mkey}
                />
                <TextField
                  label="Metafield type"
                  value={metafieldType}
                  onChange={setMetaType}
                  autoComplete="off"
                  error={storageErrors.mtype}
                />
              </>
            )}
          </FormLayout.Group>

          <InlineStack align="end">
            <Button onClick={submit} variant="primary" disabled={!isValid}>
              Add field
            </Button>
          </InlineStack>
        </FormLayout>
      </div>
    </Card>
  )
}

function FieldActions({ field, onEdit }: { field: LoaderData['fields'][number]; onEdit: () => void }) {
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
    <InlineStack gap="100">
      <Button onClick={onEdit} variant="plain">
        Edit
      </Button>
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
  )
}

function EditFieldModal({
  field,
  onClose,
  onSaved,
}: {
  field: LoaderData['fields'][number]
  onClose: () => void
  onSaved: () => void
}) {
  const fetcher = useFetcher()
  const [key, setKey] = useState(field.key)
  const [label, setLabel] = useState(field.label)
  const [type, setType] = useState<LoaderData['fields'][number]['type']>(field.type)
  const [required, setRequired] = useState<boolean>(field.required)
  const [storage, setStorage] = useState<'CORE' | 'METAFIELD'>(field.storage)
  const [coreFieldPath, setCoreFieldPath] = useState<string>(field.coreFieldPath || 'title')
  const [metafieldNamespace, setMetaNs] = useState<string>(field.metafieldNamespace || '')
  const [metafieldKey, setMetaKey] = useState<string>(field.metafieldKey || '')
  const [metafieldType, setMetaType] = useState<string>(field.metafieldType || 'single_line_text_field')

  const keyError = key
    ? /[a-z0-9_]+/.test(key)
      ? undefined
      : 'Use lowercase letters, numbers, and underscores'
    : 'Key is required'
  const labelError = label ? undefined : 'Label is required'
  const storageErrors = (() => {
    if (storage === 'CORE') return { core: undefined, ns: undefined, mkey: undefined, mtype: undefined }
    return {
      core: undefined,
      ns: metafieldNamespace ? undefined : 'Namespace is required',
      mkey: metafieldKey ? undefined : 'Metafield key is required',
      mtype: metafieldType ? undefined : 'Type is required',
    }
  })()

  const isValid = !keyError && !labelError && !storageErrors.ns && !storageErrors.mkey && !storageErrors.mtype

  const onSubmit = () => {
    if (!isValid) return
    const form = new FormData()
    form.append('_action', 'updateField')
    form.append('id', field.id)
    form.append('key', key)
    form.append('label', label)
    form.append('type', type)
    form.append('required', String(required))
    form.append('storage', storage)
    if (storage === 'CORE') {
      form.append('coreFieldPath', coreFieldPath)
      // Explicitly clear metafield mapping
      form.append('metafieldNamespace', '')
      form.append('metafieldKey', '')
      form.append('metafieldType', '')
    } else {
      // METAFIELD
      form.append('metafieldNamespace', metafieldNamespace)
      form.append('metafieldKey', metafieldKey)
      form.append('metafieldType', metafieldType)
      // Explicitly clear core mapping
      form.append('coreFieldPath', '')
    }
    const submit = fetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
    Promise.resolve(submit).then(onSaved)
  }

  return (
    <Card>
      <div className="p-m">
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            Edit field
          </Text>
          <FormLayout>
            <FormLayout.Group>
              <TextField label="Label" value={label} onChange={setLabel} error={labelError} autoComplete="off" />
              <TextField label="Key" value={key} onChange={setKey} error={keyError} autoComplete="off" />
              <Select
                label="Type"
                options={['text', 'number', 'boolean', 'select'].map(v => ({ label: v, value: v }))}
                value={type}
                onChange={v => setType(v as typeof type)}
              />
              <Checkbox label="Required" checked={required} onChange={setRequired} />
            </FormLayout.Group>

            <FormLayout.Group>
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
                <Select
                  label="Core field"
                  options={coreFieldOptions}
                  value={coreFieldPath}
                  onChange={setCoreFieldPath}
                />
              ) : (
                <>
                  <TextField
                    label="Metafield namespace"
                    value={metafieldNamespace}
                    onChange={setMetaNs}
                    autoComplete="off"
                  />
                  <TextField label="Metafield key" value={metafieldKey} onChange={setMetaKey} autoComplete="off" />
                  <TextField label="Metafield type" value={metafieldType} onChange={setMetaType} autoComplete="off" />
                </>
              )}
            </FormLayout.Group>

            <InlineStack align="end" gap="200">
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={onSubmit} disabled={!isValid || fetcher.state === 'submitting'}>
                Save
              </Button>
            </InlineStack>
          </FormLayout>
        </BlockStack>
      </div>
    </Card>
  )
}
