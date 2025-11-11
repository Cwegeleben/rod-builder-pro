import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Card, IndexTable, Text } from '@shopify/polaris'
import { prisma } from '../db.server'
import { authenticate } from '../shopify.server'

type VersionRow = {
  id: string
  contentHash: string
  fetchedAt: string
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  if (process.env.PRODUCT_DB_ENABLED !== '1') return json({ items: [] })
  const { id } = params
  if (!id) return json({ items: [] })
  const rows = await prisma.$queryRawUnsafe<Array<VersionRow>>(
    `SELECT id, contentHash, fetchedAt FROM ProductVersion WHERE productId = ? ORDER BY fetchedAt DESC LIMIT 200`,
    id,
  )
  return json({ items: rows })
}

export default function ProductVersionsIndex() {
  const { items } = useLoaderData<typeof loader>() as { items: VersionRow[] }
  const formatUtc = (d: string) => {
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
      <Text as="h2" variant="headingLg">
        Version history
      </Text>
      <IndexTable
        resourceName={{ singular: 'version', plural: 'versions' }}
        itemCount={items.length}
        headings={[{ title: 'Fetched at' }, { title: 'Hash' }]}
      >
        {items.map((v, i) => (
          <IndexTable.Row id={v.id} key={v.id} position={i}>
            <IndexTable.Cell>
              <Text as="span">{formatUtc(v.fetchedAt)}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text as="span">{v.contentHash}</Text>
            </IndexTable.Cell>
          </IndexTable.Row>
        ))}
      </IndexTable>
    </Card>
  )
}
