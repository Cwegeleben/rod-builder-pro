import type { LoaderFunctionArgs } from '@remix-run/node'
import { Link, Outlet, useLocation } from '@remix-run/react'
import { Page, Layout, Tabs, InlineStack } from '@shopify/polaris'
import { authenticate } from '../shopify.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  return null
}

function useActiveTab(): number {
  const { pathname } = useLocation()
  if (pathname.endsWith('/products/templates')) return 2
  if (pathname.endsWith('/products/import')) return 1
  return 0
}

export default function ProductsLayout() {
  const selected = useActiveTab()
  // SENTINEL: products-workspace-v3-0 (Products workspace layout with tabs)
  // BEGIN products-workspace-v3-0
  return (
    <Page title="Products">
      <Layout>
        <Layout.Section>
          <Tabs
            tabs={[
              { id: 'all', content: 'All', accessibilityLabel: 'All products', panelID: 'all-panel' },
              { id: 'import', content: 'Import', accessibilityLabel: 'Import products', panelID: 'import-panel' },
              {
                id: 'templates',
                content: 'Spec Templates',
                accessibilityLabel: 'Spec Templates',
                panelID: 'templates-panel',
              },
            ]}
            selected={selected}
            onSelect={() => {}}
          >
            <InlineStack gap="200">
              <Link to=".">All</Link>
              <Link to="import">Import</Link>
              <Link to="templates">Spec Templates</Link>
            </InlineStack>
          </Tabs>
        </Layout.Section>
        <Layout.Section>
          <Outlet />
        </Layout.Section>
      </Layout>
    </Page>
  )
  // END products-workspace-v3-0
}
