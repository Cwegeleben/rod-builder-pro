import type { LoaderFunctionArgs } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { Page, Layout, Text } from '@shopify/polaris'
import { authenticate } from '../shopify.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  return null
}

export default function ProductsLayout() {
  // SENTINEL: products-workspace-v3-0 (Products workspace layout with admin frame)
  // BEGIN products-workspace-v3-0
  return (
    <Page title="Products">
      <Layout>
        <Layout.Section>
          <Text as="p" tone="subdued">
            Browse and manage products. Use the left navigation for Import and Spec Templates.
          </Text>
        </Layout.Section>
        <Layout.Section>
          <Outlet />
        </Layout.Section>
      </Layout>
    </Page>
  )
  // END products-workspace-v3-0
}
