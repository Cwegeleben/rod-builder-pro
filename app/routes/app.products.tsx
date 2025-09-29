import type { LoaderFunctionArgs } from '@remix-run/node'
import { Outlet, useLocation, useNavigate } from '@remix-run/react'
import { Page, Layout, Tabs } from '@shopify/polaris'
import { authenticate } from '../shopify.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  return null
}

function useActiveTab(): number {
  const { pathname } = useLocation()
  if (pathname.includes('/products/templates')) return 2
  if (pathname.includes('/products/import')) return 1
  return 0
}

export default function ProductsLayout() {
  const selected = useActiveTab()
  const navigate = useNavigate()
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
            onSelect={index => {
              if (index === 0) navigate('.')
              else if (index === 1) navigate('import')
              else navigate('templates')
            }}
          />
        </Layout.Section>
        <Layout.Section>
          <Outlet />
        </Layout.Section>
      </Layout>
    </Page>
  )
  // END products-workspace-v3-0
}
