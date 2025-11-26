// redirect shim only; do not expand.
// <!-- BEGIN RBP GENERATED: hq-import-settings-ui-v1 -->
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFetcher, useLoaderData, Link, useLocation } from '@remix-run/react'
import { requireHQAccess } from '../services/auth/guards.server'
import { listManualSeeds } from '../services/importer/settings.server'
import { getBatsonSyncState, type BatsonSyncSnapshot } from '../services/suppliers/batsonSync.server'
import { Card, BlockStack, InlineStack, Text, Button, IndexTable, TextField, Badge, Divider } from '@shopify/polaris'
import { ImportNav } from '../components/importer/ImportNav'

// We reuse the existing backend action at /app/admin/import/settings
// This route provides a nicer UI and delegates persistence via fetcher.Form action attribute

type SeedRow = { url: string; label?: string }

type LoaderData = { seeds: SeedRow[]; batsonSync: BatsonSyncSnapshot }
type SyncActionResponse = {
  ok?: boolean
  error?: string
  message?: string
  state?: BatsonSyncSnapshot
  jobId?: string
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  const supplierId = 'batson'
  const [seeds, batsonSync] = await Promise.all([listManualSeeds(supplierId), getBatsonSyncState()])
  return json<LoaderData>({ seeds, batsonSync })
}

export default function ImportSettingsIndex() {
  const { seeds, batsonSync: initialBatsonSync } = useLoaderData<typeof loader>() as LoaderData
  const location = useLocation()
  const [batsonSync, setBatsonSync] = useState(initialBatsonSync)
  const [cookieInput, setCookieInput] = useState('')

  // Seeds state
  const [seedUrl, setSeedUrl] = useState('')
  const [seedLabel, setSeedLabel] = useState('')

  const seedFetcher = useFetcher<{ ok?: boolean; error?: string }>()
  const batsonCookieFetcher = useFetcher<SyncActionResponse>()
  const batsonSyncFetcher = useFetcher<SyncActionResponse>()
  const cookieIntentRef = useRef<string>('')

  const applyBatsonState = (data?: SyncActionResponse) => {
    if (data?.state) setBatsonSync(data.state)
  }

  // Toast helper
  const toast = useMemo(
    () => ({
      success: (m: string) => {
        try {
          const w = window as unknown as { shopifyToast?: { success?: (msg: string) => void } }
          w.shopifyToast?.success?.(m)
        } catch {
          // ignore
        }
      },
      error: (m: string) => {
        try {
          const w = window as unknown as { shopifyToast?: { error?: (msg: string) => void } }
          w.shopifyToast?.error?.(m)
        } catch {
          // ignore
        }
      },
    }),
    [],
  )

  useEffect(() => {
    if (seedFetcher.state === 'idle') {
      if (seedFetcher.data?.ok) {
        setSeedUrl('')
        setSeedLabel('')
        toast.success('Seed updated')
        try {
          window.location.reload()
        } catch {
          // ignore
        }
      } else if (seedFetcher.data && !seedFetcher.data.ok) {
        toast.error('Failed to update seeds')
      }
    }
  }, [seedFetcher.state, seedFetcher.data, toast])

  useEffect(() => {
    if (batsonCookieFetcher.state === 'submitting') {
      cookieIntentRef.current = String(batsonCookieFetcher.formData?.get('intent') || '')
    }
  }, [batsonCookieFetcher.state])

  useEffect(() => {
    if (batsonCookieFetcher.state === 'idle' && batsonCookieFetcher.data) {
      const intent = cookieIntentRef.current
      applyBatsonState(batsonCookieFetcher.data)
      if (batsonCookieFetcher.data.ok) {
        const fallback = intent === 'batson-cookie:validate' ? 'Cookie validated' : 'Cookie saved'
        toast.success(batsonCookieFetcher.data.message || fallback)
        if (intent === 'batson-cookie:save') {
          setCookieInput('')
        }
      } else {
        toast.error(batsonCookieFetcher.data.error || batsonCookieFetcher.data.message || 'Cookie update failed')
      }
      cookieIntentRef.current = ''
    }
  }, [batsonCookieFetcher.state, batsonCookieFetcher.data, toast])

  useEffect(() => {
    if (batsonSyncFetcher.state === 'idle' && batsonSyncFetcher.data) {
      applyBatsonState(batsonSyncFetcher.data)
      if (batsonSyncFetcher.data.ok) {
        const suffix = batsonSyncFetcher.data.jobId ? ` (#${batsonSyncFetcher.data.jobId.slice(0, 8)})` : ''
        toast.success(`Batson sync queued${suffix}`)
      } else {
        toast.error(batsonSyncFetcher.data.error || 'Failed to start sync')
      }
    }
  }, [batsonSyncFetcher.state, batsonSyncFetcher.data, toast])

  const batsonSummary = useMemo<NormalizedSummary | null>(
    () => normalizeSyncSummary(batsonSync.lastSyncSummary),
    [batsonSync.lastSyncSummary],
  )
  const cookieBusy = batsonCookieFetcher.state !== 'idle'
  const syncBusy = batsonSyncFetcher.state !== 'idle'

  return (
    <Card>
      <BlockStack gap="400">
        {/* BEGIN RBP GENERATED: admin-link-integrity-v1 */}
        {/* Breadcrumb back to Import Runs; relative link preserves embedded params */}
        <Link to={`/app/admin/import/runs${location.search}`}>← Back to Import Runs</Link>
        {/* END RBP GENERATED: admin-link-integrity-v1 */}
        <ImportNav current="settings" title="Importer Settings" />

        {/* Batson Sync Section */}
        <Card roundedAbove="sm">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="start">
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Batson sync & cookie
                </Text>
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone={badgeToneForAuth(batsonSync.authStatus)}>
                    {formatStatusLabel(batsonSync.authStatus)}
                  </Badge>
                  <Text as="p" tone="subdued">
                    {batsonSync.authMessage || 'Upload a wholesale session cookie to enable sync runs.'}
                  </Text>
                </InlineStack>
              </BlockStack>
              <InlineStack gap="200">
                <batsonCookieFetcher.Form method="post" action="/app/admin/import/settings">
                  <input type="hidden" name="intent" value="batson-cookie:validate" />
                  <Button submit variant="tertiary" disabled={cookieBusy}>
                    Re-check cookie
                  </Button>
                </batsonCookieFetcher.Form>
                <batsonSyncFetcher.Form method="post" action="/app/admin/import/settings">
                  <input type="hidden" name="intent" value="batson-sync:start" />
                  <Button submit variant="primary" disabled={syncBusy}>
                    {syncBusy ? 'Starting...' : 'Sync Batson catalog'}
                  </Button>
                </batsonSyncFetcher.Form>
              </InlineStack>
            </InlineStack>

            <batsonCookieFetcher.Form method="post" action="/app/admin/import/settings">
              <input type="hidden" name="intent" value="batson-cookie:save" />
              <input type="hidden" name="cookie" value={cookieInput} />
              <TextField
                label="Batson Cookie header"
                value={cookieInput}
                onChange={setCookieInput}
                autoComplete="off"
                multiline
                helpText="Paste the wholesale Cookie header from batsonenterprises.com (e.g., ASP.NET_SessionId=...; .ASPXAUTH=...)."
              />
              <InlineStack gap="200" align="start">
                <Button submit disabled={!cookieInput || cookieBusy}>
                  Save & validate
                </Button>
                <Button onClick={() => setCookieInput('')} disabled={!cookieInput} variant="tertiary">
                  Clear
                </Button>
              </InlineStack>
            </batsonCookieFetcher.Form>

            <Divider />

            <BlockStack gap="200">
              <InlineStack gap="300" align="start">
                <div style={{ minWidth: 180 }}>
                  <Text as="p" tone="subdued">
                    Cookie set
                  </Text>
                  <Text as="p">{formatDateTime(batsonSync.authCookieSetAt)}</Text>
                </div>
                <div style={{ minWidth: 180 }}>
                  <Text as="p" tone="subdued">
                    Validated
                  </Text>
                  <Text as="p">{formatDateTime(batsonSync.authCookieValidatedAt)}</Text>
                </div>
                <div style={{ minWidth: 180 }}>
                  <Text as="p" tone="subdued">
                    Last sync
                  </Text>
                  <Text as="p">{formatDateTime(batsonSync.lastSyncAt)}</Text>
                </div>
                <div style={{ minWidth: 180 }}>
                  <Text as="p" tone="subdued">
                    Sync status
                  </Text>
                  <Badge tone={badgeToneForSync(batsonSync.lastSyncStatus)}>
                    {formatStatusLabel(batsonSync.lastSyncStatus)}
                  </Badge>
                </div>
              </InlineStack>
              {batsonSync.lastSyncError ? (
                <Text as="p" tone="critical">
                  Last error: {batsonSync.lastSyncError}
                </Text>
              ) : null}
              <div>
                <Text as="h4" variant="headingSm">
                  Recent sync
                </Text>
                {batsonSummary ? (
                  <BlockStack gap="150">
                    <Text as="p" tone="subdued">
                      Job {batsonSummary.jobId || '—'} · Started {formatDateTime(batsonSummary.startedAt)}
                      {batsonSummary.finishedAt ? ` · Finished ${formatDateTime(batsonSummary.finishedAt)}` : ''}
                    </Text>
                    {batsonSummary.suppliers.length ? (
                      <BlockStack gap="100">
                        {batsonSummary.suppliers.map(row => (
                          <InlineStack key={row.slug} align="space-between" blockAlign="center">
                            <Text as="p">{formatSupplierLabel(row.slug)}</Text>
                            <InlineStack gap="150" blockAlign="center">
                              <Badge tone={row.ok === false ? 'critical' : 'success'}>
                                {row.ok === false ? 'Failed' : 'Success'}
                              </Badge>
                              <Text as="p" tone="subdued">
                                {row.status || (row.ok === false ? row.error || 'Error' : 'Completed')}
                                {row.durationMs ? ` · ${(row.durationMs / 1000).toFixed(1)}s` : ''}
                              </Text>
                            </InlineStack>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    ) : (
                      <Text as="p" tone="subdued">
                        Suppliers queued but no status recorded yet.
                      </Text>
                    )}
                  </BlockStack>
                ) : (
                  <Text as="p" tone="subdued">
                    No sync run recorded yet.
                  </Text>
                )}
              </div>
            </BlockStack>
          </BlockStack>
        </Card>

        {/* Seeds Section */}
        <Card roundedAbove="sm">
          <BlockStack gap="300">
            <Text as="h3" variant="headingMd">
              Manual Seeds
            </Text>
            <IndexTable
              resourceName={{ singular: 'seed', plural: 'seeds' }}
              itemCount={seeds.length}
              headings={
                [{ title: 'URL' }, { title: 'Label' }, { title: 'Actions' }] as unknown as [
                  { title: string },
                  ...{ title: string }[],
                ]
              }
              selectable={false}
            >
              {seeds.map((s, idx) => (
                <IndexTable.Row id={s.url} key={s.url} position={idx}>
                  <IndexTable.Cell>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.url}
                    </a>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{s.label || '-'}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <seedFetcher.Form method="post" action="/app/admin/import/settings">
                      <input type="hidden" name="intent" value="seed:remove" />
                      <input type="hidden" name="url" value={s.url} />
                      <Button tone="critical" submit disabled={seedFetcher.state === 'submitting'}>
                        Remove
                      </Button>
                    </seedFetcher.Form>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
            <seedFetcher.Form method="post" action="/app/admin/import/settings">
              <input type="hidden" name="intent" value="seed:add" />
              <InlineStack gap="200" align="start">
                <div style={{ minWidth: 360 }}>
                  <TextField label="URL" value={seedUrl} onChange={setSeedUrl} autoComplete="off" />
                </div>
                <div style={{ minWidth: 240 }}>
                  <TextField label="Label" value={seedLabel} onChange={setSeedLabel} autoComplete="off" />
                </div>
                <Button submit disabled={!seedUrl || seedFetcher.state === 'submitting'}>
                  Add
                </Button>
              </InlineStack>
            </seedFetcher.Form>
          </BlockStack>
        </Card>

        {null}
      </BlockStack>
    </Card>
  )
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function formatStatusLabel(status?: string | null) {
  if (!status) return 'Unknown'
  return status
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function badgeToneForAuth(
  status?: string | null,
): 'success' | 'critical' | 'warning' | 'attention' | 'info' | undefined {
  switch ((status || '').toLowerCase()) {
    case 'valid':
      return 'success'
    case 'pending':
      return 'attention'
    case 'expired':
      return 'warning'
    case 'invalid':
      return 'critical'
    case 'missing':
      return 'info'
    default:
      return undefined
  }
}

function badgeToneForSync(status?: string | null): 'success' | 'critical' | 'warning' | 'info' | undefined {
  switch ((status || '').toLowerCase()) {
    case 'success':
      return 'success'
    case 'running':
      return 'info'
    case 'error':
      return 'critical'
    default:
      return undefined
  }
}

type SupplierSummaryRow = {
  slug: string
  ok?: boolean
  status?: string
  durationMs?: number
  error?: string | null
}

type NormalizedSummary = {
  jobId?: string
  startedAt?: string
  finishedAt?: string
  suppliers: SupplierSummaryRow[]
}

type UnknownSummary = Record<string, unknown> & { suppliers?: unknown }

function normalizeSyncSummary(summary: BatsonSyncSnapshot['lastSyncSummary']): NormalizedSummary | null {
  if (!summary || typeof summary !== 'object') return null
  const base = summary as UnknownSummary
  const suppliersRaw = Array.isArray(base.suppliers) ? base.suppliers : []
  const suppliers: SupplierSummaryRow[] = suppliersRaw
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const row = item as Record<string, unknown>
      return {
        slug: typeof row.slug === 'string' ? row.slug : 'unknown',
        ok: typeof row.ok === 'boolean' ? row.ok : undefined,
        status: typeof row.status === 'string' ? row.status : undefined,
        durationMs: typeof row.durationMs === 'number' ? row.durationMs : undefined,
        error: typeof row.error === 'string' ? row.error : null,
      }
    })
  return {
    jobId: typeof base.jobId === 'string' ? base.jobId : undefined,
    startedAt: typeof base.startedAt === 'string' ? base.startedAt : undefined,
    finishedAt: typeof base.finishedAt === 'string' ? base.finishedAt : undefined,
    suppliers,
  }
}

function formatSupplierLabel(slug?: string) {
  if (!slug) return 'Supplier'
  return slug
    .replace(/^batson-/, '')
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
// <!-- END RBP GENERATED: hq-import-settings-ui-v1 -->
