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
  ContextualSaveBar,
  Banner,
} from '@shopify/polaris'
import { useEffect, useState } from 'react'
import { authenticate } from '../shopify.server'
import { getTemplateWithFields } from '../models/specTemplate.server'
import { HelpBanner } from '../components/HelpBanner'

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
  const [dirty, setDirty] = useState(false)
  const publishFetcher = useFetcher()
  type PublishResult = { ok: boolean; error?: string }
  const publishData = publishFetcher.data as PublishResult | undefined
  const publishOk = publishFetcher.state === 'idle' && publishData?.ok === true
  const publishError =
    publishFetcher.state === 'idle' && publishData && publishData.ok === false ? publishData.error : undefined
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(data.fields, {
    resourceIDResolver: (item: LoaderData['fields'][number]) => item.id,
  })
  // Clear dirty after successful publish; show any server error in the bar
  useEffect(() => {
    if (publishOk) {
      setDirty(false)
    }
  }, [publishOk])

  const rename = (next: string) => {
    const form = new FormData()
    form.append('_action', 'renameTemplate')
    form.append('id', data.id)
    form.append('name', next)
    renameFetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
    setDirty(true)
  }

  const addFieldSubmit = (formValues: Record<string, string | boolean>) => {
    const form = new FormData()
    form.append('_action', 'addField')
    form.append('templateId', data.id)
    for (const [k, v] of Object.entries(formValues)) form.append(k, String(v))
    addFetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
    setDirty(true)
  }

  // SENTINEL: products-workspace-v3-0 (Spec Template detail editor)
  // BEGIN products-workspace-v3-0
  return (
    <>
      <HelpBanner id={`template-detail-${data.id}`} title="How this page works" learnMoreHref="/app/docs">
        Name your template, add fields, then Publish. Publishing creates/updates a metaobject entry for this template so
        products can use it. You can map fields to core product properties or to product metafields.
      </HelpBanner>
      {dirty && (
        <ContextualSaveBar
          message="You have unpublished changes"
          saveAction={{
            content: 'Publish',
            loading: publishFetcher.state === 'submitting',
            onAction: () => {
              const form = new FormData()
              form.append('_action', 'publishTemplates')
              publishFetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
            },
          }}
          discardAction={{
            content: 'Discard',
            onAction: () => {
              revalidator.revalidate()
              setName(data.name)
              setDirty(false)
            },
          }}
        />
      )}
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
              setDirty(true)
            }}
            autoComplete="off"
          />
        </BlockStack>
      </Card>
      <div style={{ height: 12 }} />
      {/* Guard: require a template name before adding fields */}
      {!name.trim() && (
        <div className="p-m">
          <Banner tone="info" title="Add a template name to get started">
            <p>Enter and save a template name to enable field creation. We’ll use it to prefill metafield mapping.</p>
          </Banner>
        </div>
      )}
      {publishError && (
        <div className="p-m">
          <Banner tone="critical" title="Publish failed">
            <p>{publishError}</p>
          </Banner>
        </div>
      )}
      <Card>
        <BlockStack>
          <Text as="h2" variant="headingMd">
            Fields
          </Text>
          {/* Add field */}
          <AddField templateName={name} existingKeys={data.fields.map(f => f.key)} onSubmit={addFieldSubmit} />
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
                  <FieldActions field={f} onEdit={() => setEditing(f)} onDirty={() => setDirty(true)} />
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </BlockStack>
      </Card>

      {/* Edit field modal */}
      {editing && (
        <EditFieldModal
          templateName={name}
          field={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            revalidator.revalidate()
            setDirty(true)
          }}
        />
      )}

      {/* ContextualSaveBar covers save/discard; no inline bar needed */}
    </>
  )
  // END products-workspace-v3-0
}

function AddField({
  templateName,
  existingKeys,
  onSubmit,
}: {
  templateName: string
  existingKeys: string[]
  onSubmit: (values: Record<string, string | boolean>) => void
}) {
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<'text' | 'number' | 'boolean' | 'select'>('text')
  const [required, setRequired] = useState(false)
  const [storage, setStorage] = useState<'CORE' | 'METAFIELD'>('CORE')
  const [coreFieldPath, setCoreFieldPath] = useState('title')
  const [metafieldNamespace, setMetaNs] = useState('')
  const [metafieldType, setMetaType] = useState('single_line_text_field')
  const [keyEdited, setKeyEdited] = useState(false)

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')

  const dedupeKey = (base: string) => {
    let k = base
    let i = 2
    while (existingKeys.includes(k)) {
      k = `${base}_${i}`
      i += 1
    }
    return k
  }

  const metafieldTypeFor = (t: 'text' | 'number' | 'boolean' | 'select') => {
    switch (t) {
      case 'number':
        return 'number_integer'
      case 'boolean':
        return 'boolean'
      case 'select':
        return 'single_line_text_field'
      default:
        return 'single_line_text_field'
    }
  }

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
      mtype: metafieldType ? undefined : 'Type is required',
    }
  })()

  const duplicateKey = key ? existingKeys.includes(key) : false
  const isValid = !keyError && !labelError && !storageErrors.ns && !storageErrors.mtype && !duplicateKey

  const onLabelChange = (v: string) => {
    setLabel(v)
    if (!keyEdited) {
      const base = `${templateName ? slugify(templateName) + '_' : ''}${slugify(v)}`
      const nextKey = dedupeKey(base)
      setKey(nextKey)
      // metafield key derives from machine key; no separate state here
    }
    if (storage === 'METAFIELD') {
      if (!metafieldNamespace) setMetaNs(slugify(templateName || 'product_spec'))
    }
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
      values.metafieldKey = key
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
              error={duplicateKey ? 'Key already exists' : keyError}
            />
            <Select
              label="Type"
              options={['text', 'number', 'boolean', 'select'].map(v => ({ label: v, value: v }))}
              value={type}
              onChange={v => {
                const nv = v as 'text' | 'number' | 'boolean' | 'select'
                setType(nv)
                if (storage === 'METAFIELD') setMetaType(metafieldTypeFor(nv))
              }}
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
              onChange={v => {
                const ns = v as 'CORE' | 'METAFIELD'
                setStorage(ns)
                if (ns === 'METAFIELD') {
                  if (!metafieldNamespace) setMetaNs(slugify(templateName || 'product_spec'))
                  setMetaType(metafieldTypeFor(type))
                }
              }}
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
            <Button onClick={submit} variant="primary" disabled={!isValid || !templateName.trim()}>
              Add field
            </Button>
          </InlineStack>
        </FormLayout>
      </div>
    </Card>
  )
}

function FieldActions({
  field,
  onEdit,
  onDirty,
}: {
  field: LoaderData['fields'][number]
  onEdit: () => void
  onDirty: () => void
}) {
  const fetcher = useFetcher()
  const remove = () => {
    const form = new FormData()
    form.append('_action', 'deleteField')
    form.append('id', field.id)
    fetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
    onDirty()
  }
  const move = (direction: 'up' | 'down') => {
    const form = new FormData()
    form.append('_action', 'reorderField')
    form.append('id', field.id)
    form.append('direction', direction)
    fetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
    onDirty()
  }

  useEffect(() => {
    // no-op; placeholder if we later need to react to fetcher completion
  }, [fetcher.state])

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
  templateName,
  field,
  onClose,
  onSaved,
}: {
  templateName: string
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
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')
  const metafieldTypeFor = (t: 'text' | 'number' | 'boolean' | 'select') => {
    switch (t) {
      case 'number':
        return 'number_integer'
      case 'boolean':
        return 'boolean'
      case 'select':
        return 'single_line_text_field'
      default:
        return 'single_line_text_field'
    }
  }

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

  const onKeyChanged = (v: string) => {
    setKey(v)
    if (storage === 'METAFIELD' && !metafieldKey) setMetaKey(slugify(v))
  }

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
              <TextField label="Key" value={key} onChange={onKeyChanged} error={keyError} autoComplete="off" />
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
                onChange={v => {
                  const ns = v as 'CORE' | 'METAFIELD'
                  setStorage(ns)
                  if (ns === 'METAFIELD') {
                    if (!metafieldNamespace) setMetaNs(slugify(templateName || 'product_spec'))
                    if (!metafieldKey) setMetaKey(slugify(key || label || ''))
                    setMetaType(metafieldTypeFor(type))
                  }
                }}
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
