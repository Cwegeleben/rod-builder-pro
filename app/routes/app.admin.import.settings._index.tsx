// redirect shim only; do not expand.
// <!-- BEGIN RBP GENERATED: hq-import-settings-ui-v1 -->
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useEffect, useMemo, useState } from 'react'
import { useFetcher, useLoaderData, Link, useLocation } from '@remix-run/react'
import { requireHQAccess } from '../services/auth/guards.server'
import { listManualSeeds } from '../services/importer/settings.server'
import { Card, BlockStack, InlineStack, Text, Button, IndexTable, TextField } from '@shopify/polaris'
import { ImportNav } from '../components/importer/ImportNav'

// We reuse the existing backend action at /app/admin/import/settings
// This route provides a nicer UI and delegates persistence via fetcher.Form action attribute

type SeedRow = { url: string; label?: string }

type LoaderData = { seeds: SeedRow[] }

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  const supplierId = 'batson'
  const seeds = await listManualSeeds(supplierId)
  return json<LoaderData>({ seeds })
}

export default function ImportSettingsIndex() {
  const { seeds } = useLoaderData<typeof loader>() as LoaderData
  const location = useLocation()

  // Seeds state
  const [seedUrl, setSeedUrl] = useState('')
  const [seedLabel, setSeedLabel] = useState('')

  const seedFetcher = useFetcher<{ ok?: boolean; error?: string }>()

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

  return (
    <Card>
      <BlockStack gap="400">
        {/* BEGIN RBP GENERATED: admin-link-integrity-v1 */}
        {/* Breadcrumb back to Import Runs; relative link preserves embedded params */}
        <Link to={`/app/admin/import/runs${location.search}`}>← Back to Import Runs</Link>
        {/* END RBP GENERATED: admin-link-integrity-v1 */}
        <ImportNav current="settings" title="Importer Settings" />

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
// <!-- END RBP GENERATED: hq-import-settings-ui-v1 -->
