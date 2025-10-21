// <!-- BEGIN RBP GENERATED: hq-import-settings-ui-v1 -->
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useEffect, useMemo, useState } from 'react'
import { useFetcher, useLoaderData } from '@remix-run/react'
import { requireHQAccess } from '../services/auth/guards.server'
import { listManualSeeds, getSchedule } from '../services/importer/settings.server'
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  IndexTable,
  TextField,
  Checkbox,
  Select,
  Badge,
} from '@shopify/polaris'

// We reuse the existing backend action at /app/admin/import/settings
// This route provides a nicer UI and delegates persistence via fetcher.Form action attribute

type SeedRow = { url: string; label?: string }

type LoaderData = {
  seeds: SeedRow[]
  schedule: { enabled: boolean; cron: string } | null
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  const supplierId = 'batson'
  const [seeds, schedule] = await Promise.all([listManualSeeds(supplierId), getSchedule(supplierId)])
  return json<LoaderData>({ seeds, schedule })
}

export default function ImportSettingsIndex() {
  const { seeds, schedule } = useLoaderData<typeof loader>() as LoaderData

  // Seeds state
  const [seedUrl, setSeedUrl] = useState('')
  const [seedLabel, setSeedLabel] = useState('')

  // Schedule state
  const [enabled, setEnabled] = useState(!!schedule?.enabled)
  const [cron, setCron] = useState(schedule?.cron || '0 3 * * *')

  // Credentials state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [verified, setVerified] = useState(false)

  const seedFetcher = useFetcher<{ ok?: boolean; error?: string }>()
  const scheduleFetcher = useFetcher<{ ok?: boolean; error?: string }>()
  const credsFetcher = useFetcher<{ ok?: boolean; error?: string }>()
  const verifyFetcher = useFetcher<{ ok?: boolean; error?: string }>()

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
  }, [seedFetcher.state])

  useEffect(() => {
    if (scheduleFetcher.state === 'idle') {
      if (scheduleFetcher.data?.ok) {
        toast.success('Schedule saved')
      } else if (scheduleFetcher.data && !scheduleFetcher.data.ok) {
        toast.error('Failed to save schedule')
      }
    }
  }, [scheduleFetcher.state])

  useEffect(() => {
    if (verifyFetcher.state === 'idle' && verifyFetcher.data) {
      if (verifyFetcher.data.ok) {
        setVerified(true)
        toast.success('Credentials verified')
      } else {
        setVerified(false)
        toast.error(verifyFetcher.data.error || 'Verification failed')
      }
    }
  }, [verifyFetcher.state, verifyFetcher.data])

  useEffect(() => {
    if (credsFetcher.state === 'idle' && credsFetcher.data) {
      if (credsFetcher.data.ok) {
        toast.success('Credentials saved')
      } else {
        toast.error(credsFetcher.data.error || 'Save failed')
      }
    }
  }, [credsFetcher.state, credsFetcher.data])

  const cronPresets = [
    { label: 'Hourly', value: '0 * * * *' },
    { label: 'Daily @ 2am', value: '0 2 * * *' },
    { label: 'Weekdays @ 3am', value: '0 3 * * 1-5' },
  ]

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingLg">
          Importer Settings
        </Text>

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

        {/* Schedule Section */}
        <Card roundedAbove="sm">
          <BlockStack gap="300">
            <Text as="h3" variant="headingMd">
              Schedule
            </Text>
            <scheduleFetcher.Form method="post" action="/app/admin/import/settings">
              <input type="hidden" name="intent" value="schedule:set" />
              <InlineStack gap="300" align="start">
                <Checkbox label="Enabled" checked={enabled} onChange={v => setEnabled(Boolean(v))} name="enabled" />
                <div style={{ minWidth: 240 }}>
                  <TextField label="Cron" value={cron} onChange={setCron} name="cron" autoComplete="off" />
                </div>
                <Select
                  label="Presets"
                  options={cronPresets}
                  onChange={v => setCron(v)}
                  value=""
                  placeholder="Choose preset"
                />
                <Button submit disabled={scheduleFetcher.state === 'submitting'}>
                  Save
                </Button>
              </InlineStack>
            </scheduleFetcher.Form>
          </BlockStack>
        </Card>

        {/* Credentials Section */}
        <Card roundedAbove="sm">
          <BlockStack gap="300">
            <Text as="h3" variant="headingMd">
              Credentials
            </Text>
            <InlineStack gap="300" align="start">
              <div style={{ minWidth: 240 }}>
                <TextField label="Username" value={username} onChange={setUsername} autoComplete="username" />
              </div>
              <div style={{ minWidth: 240 }}>
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                />
              </div>
              <div style={{ minWidth: 200 }}>
                <TextField label="TOTP (optional)" value={totp} onChange={setTotp} autoComplete="one-time-code" />
              </div>
              {verified && <Badge tone="success">Verified</Badge>}
            </InlineStack>
            <InlineStack gap="200">
              <verifyFetcher.Form method="post" action="/app/admin/import/settings">
                <input type="hidden" name="intent" value="creds:verify" />
                <input type="hidden" name="username" value={username} />
                <input type="hidden" name="password" value={password} />
                <input type="hidden" name="totp" value={totp} />
                <Button submit disabled={verifyFetcher.state === 'submitting'}>
                  Verify
                </Button>
              </verifyFetcher.Form>
              <credsFetcher.Form method="post" action="/app/admin/import/settings">
                <input type="hidden" name="intent" value="creds:save" />
                <input type="hidden" name="username" value={username} />
                <input type="hidden" name="password" value={password} />
                <input type="hidden" name="totp" value={totp} />
                <Button submit disabled={credsFetcher.state === 'submitting'}>
                  Save
                </Button>
              </credsFetcher.Form>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Card>
  )
}
// <!-- END RBP GENERATED: hq-import-settings-ui-v1 -->
