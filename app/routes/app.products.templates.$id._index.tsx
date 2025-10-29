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
  Frame,
  Toast,
} from '@shopify/polaris'
import { useEffect, useState } from 'react'
import { authenticate } from '../shopify.server'
import { requireHqShopOr404 } from '../lib/access.server'
import { getTemplateWithFields } from '../models/specTemplate.server'
import { CORE_SPEC_FIELD_DEFS } from '../models/specTemplateCoreFields'
import { loadTemplateSnapshotData, loadPublishedSnapshot, diffTemplate } from '../models/templateVersion.server'
import { HelpBanner } from '../components/HelpBanner'

type LoaderData = {
  status: 'ok' | 'orphan'
  id: string
  name: string
  lastPublishedAt?: string | null
  orphan: boolean
  // <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 -->
  productImageUrl?: string | null
  supplierAvailability?: string | null
  // <!-- END RBP GENERATED: importer-templates-orphans-v1 -->
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
  diff?: {
    added: number
    removed: number
    changed: number
  }
}

// HQ gating via shared util

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request)
  await requireHqShopOr404(request)
  const id = String(params.id)
  const url = new URL(request.url)
  const isNew = url.searchParams.get('new') === '1'
  const tpl = await getTemplateWithFields(id)
  if (!tpl) {
    // Try to load remote metaobject to detect orphan
    try {
      const q = `#graphql
        query Orphan($handle:String!){
          metaobjectByHandle(handle:{type:"rbp_template", handle:$handle}){
            handle
            updatedAt
            nameField: field(key:"name"){ value }
            fieldsJson: field(key:"fields_json"){ value }
          }
        }`
      const { admin } = await authenticate.admin(request)
      const resp = await admin.graphql(q, { variables: { handle: id } })
      if (resp.ok) {
        const jr = await resp.json()
        const mo = jr?.data?.metaobjectByHandle
        if (mo) {
          let parsed: unknown[] = []
          try {
            const arr = JSON.parse(mo.fieldsJson?.value || '[]')
            if (Array.isArray(arr)) parsed = arr
          } catch {
            /* ignore */
          }
          return json<LoaderData>({
            status: 'orphan',
            id,
            name: mo.nameField?.value || '(Unnamed)',
            lastPublishedAt: mo.updatedAt || null,
            fields: parsed.map((f, i) => {
              const obj = (typeof f === 'object' && f !== null ? f : {}) as Record<string, unknown>
              const typeRaw = obj.type
              const allowedTypes = new Set(['text', 'number', 'boolean', 'select'])
              const type = allowedTypes.has(String(typeRaw))
                ? (String(typeRaw) as LoaderData['fields'][number]['type'])
                : 'text'
              return {
                id: String(obj.id || obj.key || `orphan-${i}`),
                key: String(obj.key || `field_${i}`),
                label: String(obj.label || obj.key || `Field ${i + 1}`),
                type,
                required: Boolean(obj.required) || false,
                position: typeof obj.position === 'number' ? obj.position : i,
                storage: obj.storage === 'CORE' ? 'CORE' : 'METAFIELD',
                coreFieldPath: (obj.coreFieldPath as string) || null,
                metafieldNamespace: (obj.metafieldNamespace as string) || null,
                metafieldKey: (obj.metafieldKey as string) || null,
                metafieldType: (obj.metafieldType as string) || null,
              }
            }),
            orphan: true,
          })
        }
      }
    } catch {
      /* swallow */
    }
    throw new Response('Not Found', { status: 404 })
  }
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
  let lastPublishedAt: string | null = null
  try {
    const q = `#graphql
      query GetTpl($handle: String!) {
        metaobjectByHandle(handle: {handle: $handle, type: "rbp_template"}) { updatedAt }
      }
    `
    const resp = await admin.graphql(q, { variables: { handle: tpl.id } })
    const jr = await resp.json()
    lastPublishedAt = jr?.data?.metaobjectByHandle?.updatedAt || null
  } catch {
    lastPublishedAt = null
  }
  // Compute diff vs last published snapshot (latest version)
  let diff: LoaderData['diff'] | undefined
  try {
    const published = await loadPublishedSnapshot(tpl.id)
    const current = await loadTemplateSnapshotData(tpl.id)
    const d = diffTemplate(published, current)
    if (d.added.length || d.removed.length || d.changed.length) {
      diff = { added: d.added.length, removed: d.removed.length, changed: d.changed.length }
    }
  } catch {
    /* ignore diff errors */
  }
  // <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 -->
  // Removed template-level cost default; cost is now a core field like price
  // <!-- END RBP GENERATED: importer-templates-orphans-v1 -->
  // <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 -->
  const productImageUrl = (tpl as unknown as { productImageUrl?: string | null }).productImageUrl ?? null
  const supplierAvailability = (tpl as unknown as { supplierAvailability?: string | null }).supplierAvailability ?? null
  // <!-- END RBP GENERATED: importer-templates-orphans-v1 -->
  return json<LoaderData>(
    {
      status: 'ok',
      id: tpl.id,
      name: tpl.name,
      // <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 -->
      productImageUrl,
      supplierAvailability,
      // <!-- END RBP GENERATED: importer-templates-orphans-v1 -->
      fields,
      lastPublishedAt,
      orphan: false,
      diff,
    },
    { headers: isNew ? { 'X-Tpl-New': '1' } : undefined },
  )
}

const coreFieldOptions = [
  { label: 'title', value: 'title' },
  { label: 'bodyHtml', value: 'bodyHtml' },
  { label: 'vendor', value: 'vendor' },
  { label: 'productType', value: 'productType' },
  { label: 'tags', value: 'tags' },
  { label: 'variants[0].sku', value: 'variants[0].sku' },
  { label: 'variants[0].price', value: 'variants[0].price' },
  { label: 'variants[0].inventoryItem.cost', value: 'variants[0].inventoryItem.cost' },
]

export default function TemplateDetail() {
  const data = useLoaderData<LoaderData>()
  // Detect if this is a freshly created template via query param (not persisted in state)
  const isNew = typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('new') === '1' : false
  if (data.status === 'orphan') {
    return (
      <Frame>
        <div className="p-m">
          <Banner tone="warning" title="Orphan template">
            <p>
              This template exists remotely as a metaobject but has no local record. You can restore it locally (which
              recreates the draft) or delete the remote metaobject if it is no longer needed.
            </p>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <RestoreOrphanButtons id={data.id} />
            </div>
          </Banner>
        </div>
      </Frame>
    )
  }
  const renameFetcher = useFetcher()
  const addFetcher = useFetcher()
  const revalidator = useRevalidator()
  const [name, setName] = useState(data.name)
  const [editing, setEditing] = useState<LoaderData['fields'][number] | null>(null)
  const [dirty, setDirty] = useState(false)
  // <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 -->
  const [productImageUrl, setProductImageUrl] = useState<string>(data.productImageUrl || '')
  const imageUrlFetcher = useFetcher()
  const onProductImageUrlChange = (v: string) => {
    setProductImageUrl(v)
    const trimmed = v.trim()
    if (trimmed && !/^https?:\/\//i.test(trimmed)) return
    const form = new FormData()
    form.append('_action', 'updateProductImageUrl')
    form.append('id', data.id)
    form.append('productImageUrl', trimmed)
    imageUrlFetcher.submit(form, { method: 'post', action: '/resources/spec-templates' })
    setDirty(true)
  }
  // <!-- END RBP GENERATED: importer-templates-orphans-v1 -->
  const publishFetcher = useFetcher()
  type PublishResult = { ok: boolean; error?: string }
  const publishData = publishFetcher.data as PublishResult | undefined
  const publishOk = publishFetcher.state === 'idle' && publishData?.ok === true
  const publishError =
    publishFetcher.state === 'idle' && publishData && publishData.ok === false ? publishData.error : undefined
  const [showToast, setShowToast] = useState(false)
  const coreFieldPathSet = new Set(CORE_SPEC_FIELD_DEFS.map(f => f.coreFieldPath))
  const coreFields = data.fields.filter(
    f => f.storage === 'CORE' && f.coreFieldPath && coreFieldPathSet.has(f.coreFieldPath),
  )
  const metaFields = data.fields.filter(f => !coreFields.includes(f))
  const unified = [...coreFields, ...metaFields]
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(
    unified.filter(f => f.storage === 'METAFIELD'),
    {
      resourceIDResolver: (item: LoaderData['fields'][number]) => item.id,
    },
  )
  const [showAddForm, setShowAddForm] = useState(false)
  // Clear dirty after successful publish; show any server error in the bar
  useEffect(() => {
    if (publishOk) {
      setDirty(false)
      setShowToast(true)
      revalidator.revalidate()
    }
  }, [publishOk, revalidator])

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
    <Frame>
      <HelpBanner id={`template-detail-${data.id}`} title="How this page works" learnMoreHref="/app/docs">
        Name your template, add fields, then Publish. Publishing creates/updates a metaobject entry for this template so
        products can use it. You can map fields to core product properties or to product metafields.
      </HelpBanner>
      {data.lastPublishedAt && (
        <div style={{ margin: '8px 0 4px' }}>
          <Text as="p" tone="subdued" variant="bodySm">
            Last published: {new Date(data.lastPublishedAt).toISOString().replace('T', ' ').replace(/Z$/, '')}
          </Text>
        </div>
      )}
      {data.diff && (
        <div style={{ margin: '4px 0 12px' }}>
          <Banner tone="info" title="Unpublished changes detected">
            <p>
              {data.diff.added} added, {data.diff.removed} removed, {data.diff.changed} modified field
              {data.diff.changed === 1 ? '' : 's'}.
            </p>
          </Banner>
        </div>
      )}
      {dirty && (
        <ContextualSaveBar
          message="You have unpublished changes"
          saveAction={{
            content: 'Publish',
            loading: publishFetcher.state === 'submitting',
            onAction: () => {
              const form = new FormData()
              form.append('_action', 'publishTemplates')
              form.append('templateId', data.id)
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
          {/* <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 --> */}
          {/* Moved Product Image URL and Supplier Availability into the Fields table below Cost */}
          {/* <!-- END RBP GENERATED: importer-templates-orphans-v1 --> */}
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
            {/* Offer re-auth guidance if scope issue detected */}
            {/(access denied|re-auth the shop|metaobject definition)/i.test(publishError) && (
              <p style={{ marginTop: 8 }}>
                Possible missing scopes. Refresh the app (which triggers OAuth) or open a new Admin tab to re-auth.
                After granting the new metaobject definition scopes, retry Publish.
              </p>
            )}
          </Banner>
        </div>
      )}
      <Card>
        <BlockStack>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingMd">
              Fields
            </Text>
            {!showAddForm && (
              <Button variant="primary" onClick={() => setShowAddForm(true)} disabled={!name.trim()}>
                Add field
              </Button>
            )}
          </InlineStack>
          {showAddForm && (
            <AddField
              templateName={name}
              existingKeys={data.fields.map(f => f.key)}
              onSubmit={vals => {
                addFieldSubmit(vals)
                setShowAddForm(false)
              }}
              onCancel={() => setShowAddForm(false)}
            />
          )}
          <IndexTable
            resourceName={{ singular: 'field', plural: 'fields' }}
            itemCount={unified.length}
            selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: 'Label' },
              { title: 'Key' },
              { title: 'Type' },
              { title: 'Required' },
              { title: 'Source' },
              { title: 'Actions' },
            ]}
          >
            {unified.map((f, index) => {
              const selectable = f.storage === 'METAFIELD'
              return (
                <IndexTable.Row
                  id={f.id}
                  key={f.id}
                  position={index}
                  selected={selectable && selectedResources.includes(f.id)}
                  disabled={!selectable}
                >
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
                    <Text as="span">{f.required ? 'Yes' : 'No'}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" tone="subdued">
                      {f.storage === 'CORE' ? 'Core' : 'Metafield'}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    {f.storage === 'METAFIELD' ? (
                      <FieldActions field={f} onEdit={() => setEditing(f)} onDirty={() => setDirty(true)} />
                    ) : (
                      <Text as="span" tone="subdued">
                        —
                      </Text>
                    )}
                  </IndexTable.Cell>
                </IndexTable.Row>
              )
            })}
            {/* <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 --> */}
            {/* Insert core-default rows (Product Image URL, Supplier Availability) directly after Primary Variant Cost */}
            {(() => {
              const costIdx = unified.findIndex(
                ff => ff.storage === 'CORE' && ff.coreFieldPath === 'variants[0].inventoryItem.cost',
              )
              if (costIdx < 0) return null
              const posBase = costIdx + 0.1
              const urlInvalid = productImageUrl && !/^https?:\/\//i.test(productImageUrl)
              // Hide Product Image URL input for brand new templates on initial add page
              const showImgUrl = !isNew
              return (
                <>
                  {showImgUrl ? (
                    <IndexTable.Row id="__tpl_img_url__" key="__tpl_img_url__" position={posBase}>
                      <IndexTable.Cell>
                        <Text as="span">Product Image URL</Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="span" tone="subdued">
                          product_image_url
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="span">text</Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="span">No</Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="span" tone="subdued">
                          Core
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <TextField
                          label=""
                          labelHidden
                          value={productImageUrl}
                          onChange={onProductImageUrlChange}
                          autoComplete="off"
                          type="text"
                          helpText="Optional default image used by importer (http/https)."
                          error={urlInvalid ? 'Use http:// or https:// URL' : undefined}
                        />
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ) : null}
                  <IndexTable.Row id="__tpl_supplier_avail__" key="__tpl_supplier_avail__" position={posBase + 0.1}>
                    <IndexTable.Cell>
                      <Text as="span">Supplier Availability</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" tone="subdued">
                        supplier_availability
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span">text</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span">No</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" tone="subdued">
                        Core
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <TextField
                        label=""
                        labelHidden
                        value={data.supplierAvailability || ''}
                        onChange={() => {}}
                        autoComplete="off"
                        disabled
                        helpText="Auto-updated from supplier feed"
                      />
                    </IndexTable.Cell>
                  </IndexTable.Row>
                </>
              )
            })()}
            {/* <!-- END RBP GENERATED: importer-templates-orphans-v1 --> */}
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

      {showToast && <Toast content="Published" onDismiss={() => setShowToast(false)} />}
      {/* ContextualSaveBar covers save/discard; no inline bar needed */}
    </Frame>
  )
  // END products-workspace-v3-0
}

function AddField({
  templateName,
  existingKeys,
  onSubmit,
  onCancel,
}: {
  templateName: string
  existingKeys: string[]
  onSubmit: (values: Record<string, string | boolean>) => void
  onCancel: () => void
}) {
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  // Simplified rules: type=text, required=true, namespace derived from templateName, metafield type fixed
  const type = 'text' as const
  const required = true
  const storage: 'CORE' | 'METAFIELD' = 'METAFIELD'
  const [metafieldNamespace, setMetaNs] = useState('')
  const metafieldType = 'single_line_text_field'
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

  // No dynamic metafield type mapping needed (always single_line_text_field)

  const keyError = key
    ? /[a-z0-9_]+/.test(key)
      ? undefined
      : 'Use lowercase letters, numbers, and underscores'
    : 'Key is required'
  const labelError = label ? undefined : 'Label is required'

  const duplicateKey = key ? existingKeys.includes(key) : false
  const isValid = !keyError && !labelError && !duplicateKey

  const onLabelChange = (v: string) => {
    setLabel(v)
    if (!keyEdited) {
      const base = `${templateName ? slugify(templateName) + '_' : ''}${slugify(v)}`
      const nextKey = dedupeKey(base)
      setKey(nextKey)
      // metafield key derives from machine key; no separate state here
    }
    if (!metafieldNamespace) setMetaNs(slugify(templateName || 'product_spec'))
  }

  const onKeyChange = (v: string) => {
    setKey(v)
    setKeyEdited(true)
  }

  const submit = () => {
    if (!isValid) return
    const values: Record<string, string | boolean> = { key, label, type, required, storage }
    values.metafieldNamespace = metafieldNamespace
    values.metafieldKey = key
    values.metafieldType = metafieldType
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
            {/* Namespace hidden; informative text instead */}
            <Text tone="subdued" as="span">
              Namespace: {metafieldNamespace || slugify(templateName || 'product_spec')}
            </Text>
          </FormLayout.Group>
          <InlineStack align="end">
            <Button onClick={submit} variant="primary" disabled={!isValid || !templateName.trim()}>
              Save field
            </Button>
            <Button onClick={onCancel} variant="plain">
              Cancel
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

function RestoreOrphanButtons({ id }: { id: string }) {
  const fetcher = useFetcher()
  const restoring = fetcher.state === 'submitting'
  return (
    <>
      <fetcher.Form method="post" action="/resources/spec-templates">
        <input type="hidden" name="_action" value="restoreOrphanTemplate" />
        <input type="hidden" name="id" value={id} />
        <Button submit variant="primary" disabled={restoring} loading={restoring}>
          Restore locally
        </Button>
      </fetcher.Form>
      <fetcher.Form method="post" action="/resources/spec-templates">
        <input type="hidden" name="_action" value="deleteOrphanTemplate" />
        <input type="hidden" name="id" value={id} />
        <Button submit tone="critical" variant="secondary" disabled={restoring}>
          Delete remote
        </Button>
      </fetcher.Form>
      <Button url="/app/products/templates" variant="plain">
        Back
      </Button>
    </>
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
  const [type] = useState<LoaderData['fields'][number]['type']>(field.storage === 'METAFIELD' ? 'text' : field.type)
  const [required] = useState<boolean>(field.storage === 'METAFIELD' ? true : field.required)
  const [storage, setStorage] = useState<'CORE' | 'METAFIELD'>(field.storage)
  const [coreFieldPath, setCoreFieldPath] = useState<string>(field.coreFieldPath || 'title')
  const [metafieldNamespace, setMetaNs] = useState<string>(field.metafieldNamespace || '')
  const [metafieldKey, setMetaKey] = useState<string>(field.metafieldKey || '')
  const [metafieldType] = useState<string>('single_line_text_field')
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')
  // metafieldTypeFor removed; types locked to text

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
                options={[{ label: 'text', value: 'text' }]}
                value={type === 'text' ? 'text' : 'text'}
                onChange={() => {
                  /* locked */
                }}
                disabled={field.storage === 'METAFIELD'}
                helpText={field.storage === 'METAFIELD' ? 'Metafield types locked to text' : undefined}
              />
              <Checkbox
                label="Required"
                checked={true}
                onChange={() => {}}
                disabled
                helpText="Metafields are always required"
              />
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
                    onChange={() => {}}
                    autoComplete="off"
                    disabled
                    helpText="Locked"
                  />
                  <TextField
                    label="Metafield key"
                    value={metafieldKey}
                    onChange={setMetaKey}
                    autoComplete="off"
                    disabled
                    helpText="Locked"
                  />
                  <TextField
                    label="Metafield type"
                    value="single_line_text_field"
                    autoComplete="off"
                    disabled
                    helpText="Locked"
                  />
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
