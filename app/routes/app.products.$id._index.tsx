import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Page, Layout, Card, Text } from '@shopify/polaris'
import { authenticate } from '../shopify.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  const { id } = params
  // Minimal data; future: fetch via Admin API
  return json({ id })
}

export default function ProductDetail() {
  const { id } = useLoaderData<typeof loader>() as { id: string }
  return (
    <Page title="Product" backAction={{ url: '/app/products' }}>
      <Layout>
        <Layout.Section>
          <Card>
            <div className="p-m space-y-m">
              <Text as="h2" variant="headingMd">
                Summary
              </Text>
              <Text as="p" tone="subdued">
                Product ID: {id}
              </Text>
            </div>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <div className="p-m space-y-m">
              <Text as="h2" variant="headingMd">
                Organization
              </Text>
              <Text as="p" tone="subdued">
                Vendor, Type, Tags, Collections
              </Text>
            </div>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <div className="p-m space-y-m">
              <Text as="h2" variant="headingMd">
                Variants
              </Text>
              <Text as="p" tone="subdued">
                Variant list coming soon.
              </Text>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
