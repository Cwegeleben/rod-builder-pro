import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData, useFetcher } from '@remix-run/react'
import { Card, IndexTable, InlineStack, Text, Button, BlockStack } from '@shopify/polaris'
import { useEffect } from 'react'
import { authenticate } from '../shopify.server'

type TelemetryRow = {
  id: string
  attempted: number
  created: number
  updated: number
  skipped: number
  failed: number
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
}

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  if (process.env.PRODUCT_DB_ENABLED !== '1') return json({ items: [], disabled: true })
  try {
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') || '50') || 50
    const resp = await fetch(`${url.origin}/api/publish/telemetry?limit=${encodeURIComponent(String(limit))}`)
    const data = (await resp.json()) as { ok?: boolean; items?: TelemetryRow[] }
    return json({ items: data?.items ?? [], disabled: false })
  } catch {
    return json({ items: [], disabled: false })
  }
}

export default function TelemetryIndex() {
  const { items, disabled } = useLoaderData<typeof loader>() as { items: TelemetryRow[]; disabled?: boolean }
  const fetcher = useFetcher<{ ok?: boolean; items?: TelemetryRow[] }>()

  useEffect(() => {
    const timer = setInterval(() => {
      fetcher.load('/api/publish/telemetry?limit=50')
    }, 15000)
    return () => clearInterval(timer)
  }, [fetcher])

  const rows = fetcher.data?.items ?? items

  const formatUtc = (d: string | null) => {
    if (!d) return '-'
    try {
      const dt = new Date(d)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())} ${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:${pad(dt.getUTCSeconds())} UTC`
    } catch {
      return d
    }
  }

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between">
          <Text as="h2" variant="headingLg">
            Publish Telemetry
          </Text>
          <InlineStack gap="200">
            <Button
              onClick={() => fetcher.load('/api/publish/telemetry?limit=50')}
              disabled={fetcher.state === 'loading' || disabled}
            >
              Refresh
            </Button>
          </InlineStack>
        </InlineStack>
        {disabled ? (
          <Text as="p" tone="subdued">
            Disabled (PRODUCT_DB_ENABLED != 1)
          </Text>
        ) : null}
        <IndexTable
          resourceName={{ singular: 'row', plural: 'rows' }}
          itemCount={rows.length}
          headings={[
            { title: 'Started' },
            { title: 'Duration (ms)' },
            { title: 'Attempted' },
            { title: 'Created' },
            { title: 'Updated' },
            { title: 'Skipped' },
            { title: 'Failed' },
            { title: 'Id' },
          ]}
        >
          {rows.map((r, i) => (
            <IndexTable.Row id={r.id} key={r.id} position={i}>
              <IndexTable.Cell>
                <Text as="span">{formatUtc(r.startedAt)}</Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span">{r.durationMs ?? '-'}</Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span">{r.attempted}</Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span">{r.created}</Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span">{r.updated}</Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span">{r.skipped}</Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span">{r.failed}</Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span">{r.id}</Text>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </BlockStack>
    </Card>
  )
}
